// libs/shared-integrity/src/liste-empreinte.ts
//
// Empreinte du contenu d'une liste d'embarquement.
//
// L'exigence est simple à énoncer et facile à rater : la même liste doit
// produire la même empreinte, aujourd'hui et dans dix ans, quelle que soit la
// machine, l'ordre de retour de PostgreSQL ou la version de Node. D'où une
// canonicalisation explicite plutôt qu'un JSON.stringify direct.
//
// Ce que l'empreinte doit capter, et pourquoi :
//   • l'identité des personnes — une substitution de nom après signature est
//     exactement la fraude que l'on cherche à rendre détectable ;
//   • la NATURE, la PRIORITÉ et le RANG — un déclassement de la liste
//     hiérarchisée vers la liste d'attente après le visa de l'ADJ_AIR est une
//     modification de fond, même si les noms sont inchangés ;
//   • le TRAJET — déplacer le point de débarquement d'un passager change
//     l'occupation d'un tronçon, donc le nombre de places ailleurs.
//
// Ce qu'elle ne capte PAS, délibérément : les horodatages, les identifiants
// techniques des lignes, et les champs de traçabilité de la discrimination.
// Les y inclure ferait diverger l'empreinte à chaque relecture technique sans
// qu'aucune donnée de fond n'ait bougé.

import { createHash } from 'node:crypto';

export interface ContenuListe {
  liste_id:       string;
  version:        number;
  vol: {
    numero_mission:  string;
    immatriculation: string;
    date_heure:      string | Date;
  } | null;
  etape_ordre:    number;
  base_id:        string;
  rmia:           string;
  quota_places:   number;
  quota_masse_kg: unknown;
  lignes: Array<{
    nature:   string;
    priorite: string;
    rang:     number;
    nom:      string;
    prenom:   string;
    grade?:   string | null;
    matricule?: string | null;
    categorie: string;
    embarquement_ordre: number;
    debarquement_ordre: number;
    masse_bagages_kg:   unknown;
    origine:  string;
  }>;
  frets: Array<{
    designation:        string;
    proprietaire:       string;
    poids_kg:           unknown;
    embarquement_ordre: number;
    debarquement_ordre: number;
    retire:             boolean;
    origine:            string;
  }>;
}

/**
 * Version du format de canonicalisation.
 *
 * Incrémentée à tout changement de format : une empreinte ancienne reste alors
 * vérifiable avec l'algorithme de son époque, ce qui est indispensable pour un
 * document à valeur probante.
 */
export const VERSION_FORMAT_LISTE = 1;

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

export function canoniserListe(c: ContenuListe): string {
  const lignes: string[] = [];
  const push = (cle: string, valeur: string): void => { lignes.push(`${cle}=${valeur}`); };

  push('fmt', String(VERSION_FORMAT_LISTE));
  push('liste', c.liste_id);
  push('version', String(c.version));
  push('ordre', String(c.etape_ordre));
  push('base', c.base_id);
  push('rmia', c.rmia);
  push('quota.places', String(c.quota_places));
  push('quota.masse', nombre(c.quota_masse_kg));

  if (c.vol) {
    push('vol.mission', texte(c.vol.numero_mission));
    push('vol.imma', texte(c.vol.immatriculation));
    // ISO 8601 en UTC : le fuseau du serveur ne doit pas influer sur l'empreinte.
    push('vol.date', new Date(c.vol.date_heure).toISOString());
  } else {
    push('vol', '');
  }

  // Tri stable. PostgreSQL ne garantit AUCUN ordre sans ORDER BY explicite :
  // sans ce tri, deux lectures de la même liste peuvent produire deux
  // empreintes différentes.
  const trier = (xs: string[]): string[] =>
    [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const pax = c.lignes.map((l) =>
    [
      texte(l.nature), texte(l.priorite), String(l.rang),
      texte(l.nom), texte(l.prenom), texte(l.grade), texte(l.matricule),
      texte(l.categorie),
      String(l.embarquement_ordre), String(l.debarquement_ordre),
      nombre(l.masse_bagages_kg), texte(l.origine),
    ].join('|'),
  );

  const frt = c.frets.map((f) =>
    [
      texte(f.designation), texte(f.proprietaire), nombre(f.poids_kg),
      String(f.embarquement_ordre), String(f.debarquement_ordre),
      f.retire ? '1' : '0', texte(f.origine),
    ].join('|'),
  );

  push('pax.n', String(pax.length));
  trier(pax).forEach((l, i) => push(`pax.${i}`, l));
  push('frt.n', String(frt.length));
  trier(frt).forEach((l, i) => push(`frt.${i}`, l));

  return lignes.join('\n');
}

/** Empreinte SHA-256 hexadécimale minuscule du contenu canonisé. */
export function empreinteListe(c: ContenuListe): string {
  return createHash('sha256').update(canoniserListe(c), 'utf8').digest('hex');
}

/**
 * Forme courte, imprimée sous une signature.
 *
 * 16 caractères hexadécimaux = 64 bits. Suffisant contre une falsification
 * opportuniste : l'empreinte complète reste en base et c'est elle qui fait foi.
 * Le tronqué ne sert qu'à ce qu'un officier puisse comparer de visu.
 */
export function empreinteCourteListe(hash: string): string {
  return hash.slice(0, 16).toUpperCase();
}