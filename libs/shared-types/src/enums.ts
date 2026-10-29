// libs/shared-types/src/enums.ts
//
// Miroir TypeScript des enums PostgreSQL. Les valeurs DOIVENT correspondre
// caractère pour caractère à prisma/schema.prisma.

export enum RoleUtilisateur {
  COMBASE     = 'combase',
  COMEA       = 'comea',
  SCOPS       = 'scops',
  COMRMIA     = 'comrmia',
  ADJ_AIR     = 'adj_air',
  SEC_ADJ_AIR = 'sec_adj_air',
  COMSECBASE  = 'comsecbase',
  COMGMO      = 'comgmo',
  COMBORD     = 'combord',
  CEMAA       = 'cemaa',
  MAGE        = 'mage',
  ADMIN       = 'admin',
}

/** Planification d'un vol. */
export const ROLES_CREATION_VOL: readonly RoleUtilisateur[] = [
  RoleUtilisateur.COMBASE,
  RoleUtilisateur.COMEA,
  RoleUtilisateur.ADMIN,
] as const;

/**
 * SEUL rôle habilité à SAISIR — potentialités, lignes de liste, fret.
 *
 * Constante à un élément, et non test direct sur le rôle, pour deux raisons :
 * elle est lue par l'IHM, qui n'affiche les formulaires que pour ces rôles ;
 * et si une délégation devait un jour ouvrir la saisie à un autre poste, le
 * changement tiendrait en une ligne, au lieu d'être dispersé dans cinq
 * contrôleurs.
 */
export const ROLES_SAISIE: readonly RoleUtilisateur[] = [
  RoleUtilisateur.SEC_ADJ_AIR,
] as const;

/** Chaîne RMIA. Périmètre = une RMIA, jamais une base. */
export const ROLES_RMIA: readonly RoleUtilisateur[] = [
  RoleUtilisateur.COMRMIA,
  RoleUtilisateur.ADJ_AIR,
  RoleUtilisateur.SEC_ADJ_AIR,
] as const;

/** Périmètre national. */
export const ROLES_PERIMETRE_NATIONAL: readonly RoleUtilisateur[] = [
  RoleUtilisateur.SCOPS,
  RoleUtilisateur.CEMAA,
  RoleUtilisateur.MAGE,
  RoleUtilisateur.ADMIN,
] as const;

export const ROLES_AUTORITE_CENTRALE: readonly RoleUtilisateur[] = [
  RoleUtilisateur.CEMAA,
  RoleUtilisateur.MAGE,
] as const;

export const ROLES_AVEC_ESCADRON: readonly RoleUtilisateur[] = [
  RoleUtilisateur.COMEA,
] as const;

/**
 * Rôles auxquels le COMBASE peut déléguer la discrimination de son étape.
 * La signature imprimée reste celle du COMBASE ; seule la note de délégation,
 * non imprimée, mentionne le délégataire.
 */
export const ROLES_DELEGATAIRES_COMBASE: readonly RoleUtilisateur[] = [
  RoleUtilisateur.COMGMO,
  RoleUtilisateur.COMSECBASE,
] as const;

// ─── Régions militaires interarmées ────────────────────────────────────────

export enum Rmia {
  RMIA_1 = 'RMIA_1',
  RMIA_2 = 'RMIA_2',
  RMIA_3 = 'RMIA_3',
  RMIA_4 = 'RMIA_4',
  RMIA_5 = 'RMIA_5',
}

// ─── Vol ───────────────────────────────────────────────────────────────────

export enum StatutVol {
  PLANIFIE = 'PLANIFIE',
  DIFFUSE  = 'DIFFUSE',
  EN_COURS = 'EN_COURS',
  CLOTURE  = 'CLOTURE',
  ANNULE   = 'ANNULE',
}

export enum TypeMission {
  PROJECTION  = 'PROJECTION',
  PARA        = 'PARA',
  LIAISON     = 'LIAISON',
  LOGISTIQUE  = 'LOGISTIQUE',
  EVASAN      = 'EVASAN',
  VIP         = 'VIP',
  OP_SENSIBLE = 'OP_SENSIBLE',
}

// ─── Listes ────────────────────────────────────────────────────────────────

export enum EtapeListe {
  SEC_ADJ_AIR = 'SEC_ADJ_AIR',
  ADJ_AIR     = 'ADJ_AIR',
  COMRMIA     = 'COMRMIA',
  COMBASE     = 'COMBASE',
  COMBORD     = 'COMBORD',
}

export enum StatutListe {
  OUVERTE       = 'OUVERTE',
  EN_VALIDATION = 'EN_VALIDATION',
  ARRETEE       = 'ARRETEE',
  CLOTUREE      = 'CLOTUREE',
  REJETEE       = 'REJETEE',
}

export enum NatureLigne {
  HIERARCHISEE = 'HIERARCHISEE',
  ATTENTE      = 'ATTENTE',
  RETIREE      = 'RETIREE',
}

export enum Priorite {
  P1 = 'P1', P2 = 'P2', P3 = 'P3',
  P4 = 'P4', P5 = 'P5', P6 = 'P6',
}

/** Ordre d'impression et d'appel. Source unique : ne jamais trier sur la chaîne. */
export const PRIORITES_ORDONNEES: readonly Priorite[] = [
  Priorite.P1, Priorite.P2, Priorite.P3,
  Priorite.P4, Priorite.P5, Priorite.P6,
] as const;

export enum StatutPotentialite {
  DISPONIBLE = 'DISPONIBLE',
  RETENUE    = 'RETENUE',
  ARCHIVEE   = 'ARCHIVEE',
}

/** Enum de mention UNIQUE : visas de liste et visa du manifeste. */
export enum MentionVisa {
  VU        = 'VU',
  SIGNATURE = 'SIGNATURE',
  ACCORD    = 'ACCORD',
  VISA      = 'VISA',
}

// ─── Manifeste ─────────────────────────────────────────────────────────────

export enum StatutManifeste {
  /** Émis à l'arrêté du COMBASE, en attente du visa du commandant de bord. */
  EMIS      = 'EMIS',
  /** Visé par le COMBORD. Document opposable. */
  DEFINITIF = 'DEFINITIF',
  ANNULE    = 'ANNULE',
}

export enum StatutMessage {
  EN_ATTENTE = 'EN_ATTENTE',
  ENVOYE     = 'ENVOYE',
  ECHEC      = 'ECHEC',
}

// ─── Autorités centrales et divers ─────────────────────────────────────────

export enum OrigineEnregistrement {
  SAISIE = 'SAISIE',
  CEMAA  = 'CEMAA',
  MAGE   = 'MAGE',
}

export enum AutoriteCentrale {
  CEMAA = 'CEMAA',
  MAGE  = 'MAGE',
}

export enum StatutConsigne {
  EMISE        = 'EMISE',
  REALISEE     = 'REALISEE',
  NON_REALISEE = 'NON_REALISEE',
  ANNULEE      = 'ANNULEE',
}

export enum TypeConsigne {
  PERSONNEL = 'PERSONNEL',
  MATERIEL  = 'MATERIEL',
}

export enum CategoriePassager {
  TROUPES      = 'TROUPES',
  TROUPES_PARA = 'TROUPES_PARA',
  CHEF_MIL     = 'CHEF_MIL',
  MISSION      = 'MISSION',
  PERMISSION   = 'PERMISSION',
  EVASAN       = 'EVASAN',
  VIP          = 'VIP',
  CIVIL        = 'CIVIL',
  OP_SENSIBLE  = 'OP_SENSIBLE',
}

export enum TypeMissionLogistique {
  AA               = 'AA',
  IA               = 'IA',
  INTERMINISTERIEL = 'INTERMINISTERIEL',
  INDIVIDUEL       = 'INDIVIDUEL',
  SENSIBLE_CEMAA   = 'SENSIBLE_CEMAA',
}

export enum FonctionEquipage {
  COMBORD    = 'COMBORD',
  COPILOTE   = 'COPILOTE',
  MECANICIEN = 'MECANICIEN',
  AUTRE      = 'AUTRE',
}

export enum TypeMouvement {
  MUTATION      = 'MUTATION',
  DEPART        = 'DEPART',
  SUSPENSION    = 'SUSPENSION',
  REINTEGRATION = 'REINTEGRATION',
}

export enum NiveauConfidentialite {
  NON_CLASSIFIE        = 'NON_CLASSIFIE',
  DIFFUSION_RESTREINTE = 'DIFFUSION_RESTREINTE',
  CONFIDENTIEL_DEFENSE = 'CONFIDENTIEL_DEFENSE',
  SENSIBLE_CEMAA       = 'SENSIBLE_CEMAA',
}