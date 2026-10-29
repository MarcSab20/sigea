// libs/shared-integrity/src/empreinte.ts
//
// Empreinte du contenu d'un manifeste.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI CHANGE
// ═══════════════════════════════════════════════════════════════════════════
// Le modèle `MarchandiseDangereuse` a disparu : le fret, dangereux ou non,
// passe désormais par FretListe puis Materiel, avec `classe_iata` renseignée
// quand il y a lieu. La projection correspondante est supprimée ici.
//
// Trois champs sont AJOUTÉS, et ce ne sont pas des détails :
//   • priorite et rang — l'ordre d'appel fait partie de l'acte. Deux manifestes
//     portant les mêmes noms dans un ordre différent sont deux documents
//     différents, et l'empreinte doit les distinguer.
//   • retire — un passager retiré par le commandant de bord reste dans le
//     contenu, assorti de son drapeau. L'exclure ferait qu'un manifeste dont on
//     a retiré quelqu'un produirait la même empreinte qu'un manifeste où cette
//     personne n'a jamais figuré : le retrait deviendrait indétectable, alors
//     que c'est précisément une décision qu'il faut pouvoir prouver.
//
// L'exigence générale est inchangée : la même donnée métier doit produire la
// même empreinte, aujourd'hui et dans dix ans, quelle que soit la machine,
// l'ordre de retour de PostgreSQL ou la version de Node. D'où une
// canonicalisation explicite plutôt qu'un JSON.stringify direct.

import { createHash } from 'node:crypto';

/** Contenu métier retenu dans l'empreinte. Rien d'autre n'y entre. */
export interface ContenuManifeste {
  manifeste_id:     string;
  numero_manifeste: string;
  version:          number;
  base_id:          string;
  etape_ordre:      number;
  flag_sensible:    boolean;
  vol: {
    numero_mission:  string;
    immatriculation: string;
    date_heure:      string | Date;
  } | null;
  passagers: Array<{
    nom:       string;
    prenom:    string;
    grade?:    string | null;
    categorie: string;
    unite?:    string | null;
    priorite:  string;
    rang:      number;
    debarquement_ordre: number;
    retire:    boolean;
  }>;
  materiels: Array<{
    designation:        string;
    poids_kg:           unknown;
    debarquement_ordre: number;
    classe_iata?:       string | null;
    retire:             boolean;
  }>;
  equipages: Array<{ nom: string; prenom: string; fonction: string }>;
}

/**
 * Version du format de canonicalisation.
 *
 * Passée à 2 : le format a changé (marchandises retirées, priorité/rang/retrait
 * ajoutés). Une empreinte figée sous le format 1 reste vérifiable avec
 * l'algorithme de son époque — c'est indispensable pour un document à valeur
 * probante, et c'est la seule raison d'être de ce compteur.
 */
export const VERSION_FORMAT = 2;

/** Normalise une valeur numérique Prisma (Decimal | number | string | null). */
function nombre(v: unknown): string {
  if (v === null || v === undefined) return '';
  // On repasse par Number pour neutraliser les zéros de queue : « 12.50 » et
  // « 12.5 » sont la même masse et ne doivent pas produire deux empreintes.
  const n = Number(String(v));
  return Number.isFinite(n) ? n.toString() : '';
}

/**
 * NFC : « é » précomposé et « e » + accent combinant sont visuellement
 * identiques mais ont des octets différents. Sans normalisation, un
 * copier-coller depuis Word suffit à casser une vérification d'intégrité.
 */
function texte(v: string | null | undefined): string {
  return (v ?? '').normalize('NFC').trim();
}

export function canoniser(c: ContenuManifeste): string {
  const lignes: string[] = [];
  const push = (cle: string, valeur: string): void => { lignes.push(`${cle}=${valeur}`); };

  push('fmt', String(VERSION_FORMAT));
  push('manifeste', c.manifeste_id);
  push('numero', texte(c.numero_manifeste));
  push('version', String(c.version));
  push('base', c.base_id);
  push('ordre', String(c.etape_ordre));
  push('sensible', c.flag_sensible ? '1' : '0');

  if (c.vol) {
    push('vol.mission', texte(c.vol.numero_mission));
    push('vol.imma', texte(c.vol.immatriculation));
    // ISO 8601 en UTC : le fuseau du serveur ne doit pas influer sur l'empreinte.
    push('vol.date', new Date(c.vol.date_heure).toISOString());
  } else {
    push('vol', '');
  }

  // Tri stable de chaque collection. PostgreSQL ne garantit AUCUN ordre sans
  // ORDER BY explicite : sans ce tri, deux lectures du même manifeste peuvent
  // produire deux empreintes différentes.
  const trier = (xs: string[]): string[] =>
    [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const pax = c.passagers.map((p) =>
    [
      texte(p.priorite), String(p.rang),
      texte(p.nom), texte(p.prenom), texte(p.grade),
      texte(p.categorie), texte(p.unite),
      String(p.debarquement_ordre),
      p.retire ? '1' : '0',
    ].join('|'),
  );

  const mat = c.materiels.map((m) =>
    [
      texte(m.designation), nombre(m.poids_kg),
      String(m.debarquement_ordre), texte(m.classe_iata),
      m.retire ? '1' : '0',
    ].join('|'),
  );

  const eqp = c.equipages.map((e) =>
    [texte(e.nom), texte(e.prenom), texte(e.fonction)].join('|'),
  );

  push('pax.n', String(pax.length));
  trier(pax).forEach((l, i) => push(`pax.${i}`, l));
  push('mat.n', String(mat.length));
  trier(mat).forEach((l, i) => push(`mat.${i}`, l));
  push('eqp.n', String(eqp.length));
  trier(eqp).forEach((l, i) => push(`eqp.${i}`, l));

  return lignes.join('\n');
}

/** Empreinte SHA-256 hexadécimale minuscule du contenu canonisé. */
export function empreinte(c: ContenuManifeste): string {
  return createHash('sha256').update(canoniser(c), 'utf8').digest('hex');
}

/**
 * Forme courte imprimée sur le document et transportée par le QR code.
 *
 * 16 caractères hexadécimaux = 64 bits. Suffisant contre une falsification
 * opportuniste : l'empreinte complète reste en base et c'est elle que
 * l'endpoint de vérification recompare. Le tronqué ne sert qu'à ce qu'un
 * militaire puisse lire et recopier le code à la main si le QR est abîmé.
 */
export function empreinteCourte(hash: string): string {
  return hash.slice(0, 16).toUpperCase();
}