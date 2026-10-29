// libs/shared-types/src/rmia.ts
//
// Découpage territorial des Régions Militaires Interarmées, et périmètre
// d'habilitation qui en découle.
//
// Ce fichier est volontairement SANS dépendance à Prisma, à NestJS ou au
// réseau : il est importable par le frontend comme par n'importe quel service,
// et testable sans base de données.

import { Rmia, RoleUtilisateur, ROLES_RMIA, ROLES_PERIMETRE_NATIONAL } from './enums';

// ─── Découpage territorial ─────────────────────────────────────────────────

/**
 * Régions administratives composant chaque RMIA.
 *
 * Les libellés sont NORMALISÉS (voir `normaliserRegion`) : la comparaison se
 * fait sans accents, sans casse et sans variantes de tiret, parce que
 * « Extrême-Nord », « EXTREME NORD » et « Extreme-Nord » désignent la même
 * région et arrivent effectivement sous ces trois formes dans les imports.
 */
export const REGIONS_PAR_RMIA: Readonly<Record<Rmia, readonly string[]>> = {
  [Rmia.RMIA_1]: ['centre', 'sud', 'est'],
  [Rmia.RMIA_2]: ['littoral', 'sud-ouest'],
  [Rmia.RMIA_3]: ['nord', 'adamaoua'],
  [Rmia.RMIA_4]: ['extreme-nord'],
  [Rmia.RMIA_5]: ['ouest', 'nord-ouest'],
} as const;

export const LIBELLE_RMIA: Readonly<Record<Rmia, string>> = {
  [Rmia.RMIA_1]: 'RMIA 1',
  [Rmia.RMIA_2]: 'RMIA 2',
  [Rmia.RMIA_3]: 'RMIA 3',
  [Rmia.RMIA_4]: 'RMIA 4',
  [Rmia.RMIA_5]: 'RMIA 5',
} as const;

export const RMIA_ORDONNEES: readonly Rmia[] = [
  Rmia.RMIA_1, Rmia.RMIA_2, Rmia.RMIA_3, Rmia.RMIA_4, Rmia.RMIA_5,
] as const;

/**
 * Forme canonique d'un nom de région : minuscules, sans diacritiques, tirets
 * et espaces unifiés.
 *
 * Indispensable avant toute comparaison : « Sud-Ouest », « sud ouest » et
 * « SUD‑OUEST » (avec tiret insécable) doivent se rejoindre. Sans cela, une
 * base importée avec un libellé légèrement différent se retrouverait sans
 * RMIA, donc invisible pour la chaîne de commandement censée la couvrir.
 */
export function normaliserRegion(region: string): string {
  return region
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s\u2010-\u2015_]+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-|-$/g, '');
}

/**
 * RMIA d'une région administrative, ou `null` si la région est inconnue.
 *
 * Retourne `null` plutôt que de lever : l'appelant décide s'il s'agit d'une
 * erreur de saisie à refuser (création de base) ou d'une donnée héritée à
 * signaler sans bloquer (reprise de l'existant).
 */
export function rmiaDeRegion(region: string): Rmia | null {
  const cible = normaliserRegion(region);
  for (const rmia of RMIA_ORDONNEES) {
    if (REGIONS_PAR_RMIA[rmia].includes(cible)) return rmia;
  }
  return null;
}

/** Variante stricte, pour les chemins d'écriture : une base DOIT avoir une RMIA. */
export function rmiaDeRegionStrict(region: string): Rmia {
  const rmia = rmiaDeRegion(region);
  if (!rmia) {
    throw new Error(
      `Région « ${region} » hors du découpage RMIA. ` +
        `Régions admises : ${RMIA_ORDONNEES.flatMap((r) => REGIONS_PAR_RMIA[r]).join(', ')}.`,
    );
  }
  return rmia;
}

// ─── Périmètre d'habilitation ──────────────────────────────────────────────

/**
 * Portée des droits d'un rôle.
 *
 * Trois valeurs et pas davantage, parce que trois suffisent à décrire toute
 * l'organisation : on commande une base, une région, ou le territoire.
 */
export enum Perimetre {
  BASE     = 'BASE',
  RMIA     = 'RMIA',
  NATIONAL = 'NATIONAL',
}

export function perimetreDeRole(role: RoleUtilisateur): Perimetre {
  if (ROLES_PERIMETRE_NATIONAL.includes(role)) return Perimetre.NATIONAL;
  if (ROLES_RMIA.includes(role))               return Perimetre.RMIA;
  return Perimetre.BASE;
}

/** Vrai si ce rôle exige qu'une RMIA soit renseignée sur le compte. */
export function exigeRmia(role: RoleUtilisateur): boolean {
  return ROLES_RMIA.includes(role);
}

/**
 * Titre imprimé sous une signature numérique.
 *
 * Figé dans le visa au moment de la signature : une mutation ultérieure ne doit
 * pas réécrire la qualité sous laquelle un officier a signé.
 */
export function titreSignataire(
  role: RoleUtilisateur,
  contexte: { rmia?: Rmia | null; code_base?: string | null },
): string {
  switch (role) {
    case RoleUtilisateur.COMRMIA:
      return `COMMANDANT ${LIBELLE_RMIA[contexte.rmia as Rmia] ?? 'RMIA'}`;
    case RoleUtilisateur.ADJ_AIR:
      return `ADJOINT AIR / ${LIBELLE_RMIA[contexte.rmia as Rmia] ?? 'RMIA'}`;
    case RoleUtilisateur.SEC_ADJ_AIR:
      return `SECRETAIRE ADJOINT AIR / ${LIBELLE_RMIA[contexte.rmia as Rmia] ?? 'RMIA'}`;
    case RoleUtilisateur.COMBASE:
      return `COMMANDANT DE BASE${contexte.code_base ? ` / ${contexte.code_base}` : ''}`;
    case RoleUtilisateur.COMSECBASE:
      return `COMMANDANT EN SECOND${contexte.code_base ? ` / ${contexte.code_base}` : ''}`;
    case RoleUtilisateur.COMGMO:
      return `COMGMO${contexte.code_base ? ` / ${contexte.code_base}` : ''}`;
    case RoleUtilisateur.COMBORD:
      return 'COMMANDANT DE BORD';
    case RoleUtilisateur.SCOPS:
      return 'SOUS-CHEF OPERATIONS';
    case RoleUtilisateur.COMEA:
      return `COMMANDANT D'ESCADRON${contexte.code_base ? ` / ${contexte.code_base}` : ''}`;
    default:
      return role.toUpperCase();
  }
}