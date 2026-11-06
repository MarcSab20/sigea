// libs/shared-types/src/grades.ts
//
// Grades des Forces de Défense camerounaises.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI UN RÉFÉRENTIEL, ET NON UN CHAMP LIBRE
// ═══════════════════════════════════════════════════════════════════════════
// Le grade est imprimé sous chaque signature et à côté de chaque nom sur le
// manifeste. Saisi librement, il arrive sous toutes les formes — « Cne »,
// « Capitaine », « CAPITAINE », « Cpt » — et aucun tri, aucun regroupement,
// aucune comparaison n'est alors possible. Un document militaire qui écrit le
// même grade de quatre façons se discrédite tout seul.
//
// L'ORDRE est porté explicitement et ne se déduit pas de la position dans le
// tableau : il sert à trier une liste par ancienneté, ce qu'une comparaison
// alphabétique ne saurait faire — « Colonel » précéderait « Lieutenant ».
//
// Les quatre armées partagent des grades de même libellé (Capitaine, Colonel,
// Adjudant-chef). La clé est donc le COUPLE armée + grade, jamais le libellé
// seul.
//
// Source : votre référentiel. Je le reconduis tel que vous me l'avez transmis
// et ne l'invente pas ; il reste à faire confirmer par le service compétent
// avant mise en service.

export enum Armee {
  TERRE       = 'TERRE',
  AIR         = 'AIR',
  MARINE      = 'MARINE',
  GENDARMERIE = 'GENDARMERIE',
}

export const LIBELLE_ARMEE: Readonly<Record<Armee, string>> = {
  [Armee.TERRE]:       'Armée de terre',
  [Armee.AIR]:         "Armée de l'air",
  [Armee.MARINE]:      'Marine nationale',
  [Armee.GENDARMERIE]: 'Gendarmerie nationale',
} as const;

export interface Grade {
  /** Rang d'ancienneté croissant au sein de l'armée. */
  ordre:     number;
  libelle:   string;
  categorie: string;
}

const TERRE: Grade[] = [
  { ordre: 1,  libelle: 'Soldat de 2e classe',       categorie: 'Militaire du rang' },
  { ordre: 2,  libelle: 'Soldat de 1re classe',      categorie: 'Militaire du rang' },
  { ordre: 3,  libelle: 'Caporal',                   categorie: 'Militaire du rang' },
  { ordre: 4,  libelle: 'Caporal-chef',              categorie: 'Militaire du rang' },
  { ordre: 5,  libelle: 'Sergent',                   categorie: 'Sous-officier' },
  { ordre: 6,  libelle: 'Sergent-chef',              categorie: 'Sous-officier' },
  { ordre: 7,  libelle: 'Adjudant',                  categorie: 'Sous-officier' },
  { ordre: 8,  libelle: 'Adjudant-chef',             categorie: 'Sous-officier' },
  { ordre: 9,  libelle: 'Adjudant-chef major',       categorie: 'Sous-officier' },
  { ordre: 10, libelle: 'Aspirant',                  categorie: 'Aspirant' },
  { ordre: 11, libelle: 'Sous-lieutenant',           categorie: 'Officier subalterne' },
  { ordre: 12, libelle: 'Lieutenant',                categorie: 'Officier subalterne' },
  { ordre: 13, libelle: 'Capitaine',                 categorie: 'Officier subalterne' },
  { ordre: 14, libelle: 'Chef de bataillon',         categorie: 'Officier supérieur' },
  { ordre: 15, libelle: 'Lieutenant-colonel',        categorie: 'Officier supérieur' },
  { ordre: 16, libelle: 'Colonel',                   categorie: 'Officier supérieur' },
  { ordre: 17, libelle: 'Général de brigade',        categorie: 'Officier général' },
  { ordre: 18, libelle: 'Général de division',       categorie: 'Officier général' },
  { ordre: 19, libelle: "Général de corps d'armée",  categorie: 'Officier général' },
];

const AIR: Grade[] = [
  { ordre: 1,  libelle: 'Soldat de 2e classe',          categorie: 'Militaire du rang' },
  { ordre: 2,  libelle: 'Soldat de 1re classe',         categorie: 'Militaire du rang' },
  { ordre: 3,  libelle: 'Caporal',                      categorie: 'Militaire du rang' },
  { ordre: 4,  libelle: 'Caporal-chef',                 categorie: 'Militaire du rang' },
  { ordre: 5,  libelle: 'Sergent',                      categorie: 'Sous-officier' },
  { ordre: 6,  libelle: 'Sergent-chef',                 categorie: 'Sous-officier' },
  { ordre: 7,  libelle: 'Adjudant',                     categorie: 'Sous-officier' },
  { ordre: 8,  libelle: 'Adjudant-chef',                categorie: 'Sous-officier' },
  { ordre: 9,  libelle: 'Adjudant-chef major',          categorie: 'Sous-officier' },
  { ordre: 10, libelle: 'Aspirant',                     categorie: 'Aspirant' },
  { ordre: 11, libelle: 'Sous-lieutenant',              categorie: 'Officier subalterne' },
  { ordre: 12, libelle: 'Lieutenant',                   categorie: 'Officier subalterne' },
  { ordre: 13, libelle: 'Capitaine',                    categorie: 'Officier subalterne' },
  { ordre: 14, libelle: 'Commandant',                   categorie: 'Officier supérieur' },
  { ordre: 15, libelle: 'Lieutenant-colonel',           categorie: 'Officier supérieur' },
  { ordre: 16, libelle: 'Colonel',                      categorie: 'Officier supérieur' },
  { ordre: 17, libelle: 'Général de brigade aérienne',  categorie: 'Officier général' },
  { ordre: 18, libelle: 'Général de division aérienne', categorie: 'Officier général' },
  { ordre: 19, libelle: "Général de corps d'armée",     categorie: 'Officier général' },
];

const MARINE: Grade[] = [
  { ordre: 1,  libelle: 'Matelot de 2e classe',              categorie: 'Militaire du rang' },
  { ordre: 2,  libelle: 'Matelot de 1re classe',             categorie: 'Militaire du rang' },
  { ordre: 3,  libelle: 'Quartier-maître de 2e classe',      categorie: 'Militaire du rang' },
  { ordre: 4,  libelle: 'Quartier-maître de 1re classe',     categorie: 'Militaire du rang' },
  { ordre: 5,  libelle: 'Second-maître',                     categorie: 'Officier marinier' },
  { ordre: 6,  libelle: 'Premier-maître',                    categorie: 'Officier marinier' },
  { ordre: 7,  libelle: 'Maître',                            categorie: 'Officier marinier' },
  { ordre: 8,  libelle: 'Maître-principal',                  categorie: 'Officier marinier' },
  { ordre: 9,  libelle: 'Maître-principal major',            categorie: 'Officier marinier' },
  { ordre: 10, libelle: 'Aspirant',                          categorie: 'Aspirant' },
  { ordre: 11, libelle: 'Enseigne de vaisseau de 2e classe', categorie: 'Officier subalterne' },
  { ordre: 12, libelle: 'Enseigne de vaisseau de 1re classe',categorie: 'Officier subalterne' },
  { ordre: 13, libelle: 'Lieutenant de vaisseau',            categorie: 'Officier subalterne' },
  { ordre: 14, libelle: 'Capitaine de corvette',             categorie: 'Officier supérieur' },
  { ordre: 15, libelle: 'Capitaine de frégate',              categorie: 'Officier supérieur' },
  { ordre: 16, libelle: 'Capitaine de vaisseau',             categorie: 'Officier supérieur' },
  { ordre: 17, libelle: 'Contre-amiral',                     categorie: 'Officier général' },
  { ordre: 18, libelle: 'Vice-amiral',                       categorie: 'Officier général' },
  { ordre: 19, libelle: 'Amiral',                            categorie: 'Officier général' },
];

const GENDARMERIE: Grade[] = [
  { ordre: 1,  libelle: 'Élève-gendarme',               categorie: 'Élève' },
  { ordre: 2,  libelle: 'Gendarme',                     categorie: 'Militaire de la Gendarmerie' },
  { ordre: 3,  libelle: 'Gendarme-major',               categorie: 'Militaire de la Gendarmerie' },
  { ordre: 4,  libelle: 'Maréchal des logis',           categorie: 'Sous-officier' },
  { ordre: 5,  libelle: 'Maréchal des logis-chef',      categorie: 'Sous-officier' },
  { ordre: 6,  libelle: 'Adjudant',                     categorie: 'Sous-officier' },
  { ordre: 7,  libelle: 'Adjudant-chef',                categorie: 'Sous-officier' },
  { ordre: 8,  libelle: 'Adjudant-chef major',          categorie: 'Sous-officier' },
  { ordre: 9,  libelle: 'Aspirant',                     categorie: 'Aspirant' },
  { ordre: 10, libelle: 'Sous-lieutenant',              categorie: 'Officier subalterne' },
  { ordre: 11, libelle: 'Lieutenant',                   categorie: 'Officier subalterne' },
  { ordre: 12, libelle: 'Capitaine',                    categorie: 'Officier subalterne' },
  { ordre: 13, libelle: "Chef d'escadron",              categorie: 'Officier supérieur' },
  { ordre: 14, libelle: 'Lieutenant-colonel',           categorie: 'Officier supérieur' },
  { ordre: 15, libelle: 'Colonel',                      categorie: 'Officier supérieur' },
  { ordre: 16, libelle: 'Général de brigade',           categorie: 'Officier général' },
  { ordre: 17, libelle: 'Général de division',          categorie: 'Officier général' },
  { ordre: 18, libelle: "Général de corps d'armée",     categorie: 'Officier général' },
];

export const GRADES_PAR_ARMEE: Readonly<Record<Armee, readonly Grade[]>> = {
  [Armee.TERRE]:       TERRE,
  [Armee.AIR]:         AIR,
  [Armee.MARINE]:      MARINE,
  [Armee.GENDARMERIE]: GENDARMERIE,
} as const;

export const ARMEES_ORDONNEES: readonly Armee[] = [
  Armee.AIR, Armee.TERRE, Armee.MARINE, Armee.GENDARMERIE,
] as const;

/**
 * Tous les libellés, dédoublonnés.
 *
 * Utile pour valider un grade existant dont on ignore l'armée — cas des
 * comptes créés avant l'introduction de ce référentiel, et des potentialités
 * saisies en texte libre.
 */
export const TOUS_LES_GRADES: readonly string[] = [
  ...new Set(ARMEES_ORDONNEES.flatMap((a) => GRADES_PAR_ARMEE[a].map((g) => g.libelle))),
].sort();

/**
 * Retrouve un grade par son libellé.
 *
 * `armee` restreint la recherche quand elle est connue. Sans elle, le premier
 * grade trouvé est renvoyé — « Capitaine » existe dans trois armées avec des
 * rangs voisins, et pour un tri d'affichage cette approximation est acceptable.
 * Elle ne l'est PAS pour un acte signé, où l'armée doit être renseignée.
 */
export function trouverGrade(libelle: string, armee?: Armee): Grade | null {
  const cible = libelle.trim().toLowerCase();
  const armees = armee ? [armee] : ARMEES_ORDONNEES;
  for (const a of armees) {
    const g = GRADES_PAR_ARMEE[a].find((x) => x.libelle.toLowerCase() === cible);
    if (g) return g;
  }
  return null;
}

/**
 * Clé de tri par ancienneté décroissante.
 *
 * Les grades inconnus — saisies anciennes, personnels civils — reçoivent 0 et
 * se retrouvent en fin de liste. Les écarter serait pire : un nom disparu
 * d'une liste d'embarquement est un passager oublié au sol.
 */
export function rangGrade(libelle: string | null | undefined, armee?: Armee): number {
  if (!libelle) return 0;
  return trouverGrade(libelle, armee)?.ordre ?? 0;
}