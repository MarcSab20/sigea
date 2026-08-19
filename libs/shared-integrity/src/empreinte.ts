// libs/shared-integrity/src/empreinte.ts
//
// Calcul de l'empreinte d'un manifeste : la brique commune à l'historisation
// du contenu signé et à la vérification par QR code.
//
// L'exigence est simple à énoncer et facile à rater : la même donnée métier
// doit produire la même empreinte, aujourd'hui et dans dix ans, quelle que
// soit la machine, l'ordre de retour de PostgreSQL ou la version de Node.
// D'où une canonicalisation explicite plutôt qu'un JSON.stringify direct.

import { createHash } from 'node:crypto';

/** Contenu métier retenu dans l'empreinte. Rien d'autre n'y entre. */
export interface ContenuManifeste {
  manifeste_id: string;
  version: number;
  vol: {
    numero_mission: string;
    immatriculation: string;
    date_heure: string | Date;
    base_depart_id: string;
    base_arrivee_id: string;
  } | null;
  base_id: string;
  flag_sensible: boolean;
  passagers: Array<{
    nom: string; prenom: string; grade?: string | null;
    categorie: string; unite?: string | null;
  }>;
  materiels: Array<{ designation: string; poids_kg?: unknown }>;
  marchandises: Array<{ nature?: string | null; classe_iata?: string | null; poids_kg?: unknown }>;
  equipages: Array<{ nom: string; prenom: string; fonction: string }>;
}

/** Normalise une valeur numérique Prisma (Decimal | number | string | null). */
function nombre(v: unknown): string {
  if (v === null || v === undefined) return '';
  // Decimal.js expose toString() ; Number.toString() convient aussi. On repasse
  // par Number pour neutraliser les zéros de queue ('12.50' et '12.5' sont la
  // même masse et ne doivent pas produire deux empreintes différentes).
  const n = Number(v.toString());
  return Number.isFinite(n) ? n.toString() : '';
}

function texte(v: string | null | undefined): string {
  // NFC : 'é' précomposé et 'e' + accent combinant sont visuellement identiques
  // mais ont des octets différents. Sans normalisation, un copier-coller depuis
  // Word peut suffire à casser une vérification d'intégrité.
  return (v ?? '').normalize('NFC').trim();
}

/**
 * Projette le contenu dans une chaîne canonique, déterministe et lisible.
 *
 * Le format textuel à séparateurs (plutôt qu'un JSON) est délibéré : il est
 * inspectable à l'œil lors d'une expertise, et son évolution est visible en
 * revue de code. `VERSION_FORMAT` est incrémenté à tout changement de format —
 * une empreinte ancienne reste alors vérifiable avec l'algorithme de son
 * époque, ce qui est indispensable pour un document à valeur probante.
 */
export const VERSION_FORMAT = 1;

export function canoniser(c: ContenuManifeste): string {
  const lignes: string[] = [];
  const push = (cle: string, valeur: string): void => { lignes.push(`${cle}=${valeur}`); };

  push('fmt', String(VERSION_FORMAT));
  push('manifeste', c.manifeste_id);
  push('version', String(c.version));
  push('base', c.base_id);
  push('sensible', c.flag_sensible ? '1' : '0');

  if (c.vol) {
    push('vol.mission', texte(c.vol.numero_mission));
    push('vol.imma', texte(c.vol.immatriculation));
    // ISO 8601 en UTC : le fuseau du serveur ne doit pas influer sur l'empreinte.
    push('vol.date', new Date(c.vol.date_heure).toISOString());
    push('vol.dep', texte(c.vol.base_depart_id));
    push('vol.arr', texte(c.vol.base_arrivee_id));
  } else {
    push('vol', '');
  }

  // Tri stable de chaque collection. PostgreSQL ne garantit AUCUN ordre sans
  // ORDER BY explicite : sans ce tri, deux lectures du même manifeste peuvent
  // produire deux empreintes différentes.
  const trier = (xs: string[]): string[] => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const pax = c.passagers.map((p) =>
    [texte(p.nom), texte(p.prenom), texte(p.grade), texte(p.categorie), texte(p.unite)].join('|'),
  );
  const mat = c.materiels.map((m) => [texte(m.designation), nombre(m.poids_kg)].join('|'));
  const mdg = c.marchandises.map((m) =>
    [texte(m.nature), texte(m.classe_iata), nombre(m.poids_kg)].join('|'),
  );
  const eqp = c.equipages.map((e) => [texte(e.nom), texte(e.prenom), texte(e.fonction)].join('|'));

  push('pax.n', String(pax.length));
  trier(pax).forEach((l, i) => push(`pax.${i}`, l));
  push('mat.n', String(mat.length));
  trier(mat).forEach((l, i) => push(`mat.${i}`, l));
  push('mdg.n', String(mdg.length));
  trier(mdg).forEach((l, i) => push(`mdg.${i}`, l));
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
 * opportuniste : l'empreinte complète reste stockée en base et c'est elle que
 * l'endpoint de vérification recompare. Le tronqué ne sert qu'à ce qu'un
 * militaire puisse lire et recopier le code à la main si le QR est abîmé.
 */
export function empreinteCourte(hash: string): string {
  return hash.slice(0, 16).toUpperCase();
}
