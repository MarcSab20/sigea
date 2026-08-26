export enum RoleUtilisateur {
  CHEF_ESCALE = 'chef_escale',
  COMEA       = 'comea',
  COMESO      = 'comeso',
  COMGMO      = 'comgmo',
  COMBORD     = 'combord',
  COMBASE     = 'combase',
  CEMAA       = 'cemaa',
  MAGE        = 'mage',
  ADMIN       = 'admin',
}

export const ROLES_CREATION_VOL: readonly RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.COMEA,
  RoleUtilisateur.COMGMO,
] as const;

export const ROLES_AUTORITE_CENTRALE: readonly RoleUtilisateur[] = [
  RoleUtilisateur.CEMAA,
  RoleUtilisateur.MAGE,
] as const;

export const ROLES_AVEC_ESCADRON: readonly RoleUtilisateur[] = [
  RoleUtilisateur.COMEA,
] as const;

export enum StatutManifeste {
  BROUILLON     = 'BROUILLON',
  SOUMIS        = 'SOUMIS',
  EN_VALIDATION = 'EN_VALIDATION',
  VALIDE        = 'VALIDE',
  REJETE        = 'REJETE',
}

export enum EtapeValidation {
  CHEF_ESCALE    = 'CHEF_ESCALE',
  COMESO         = 'COMESO',
  COMGMO         = 'COMGMO',
  COMBORD        = 'COMBORD',
  CEMAA_SENSIBLE = 'CEMAA_SENSIBLE',
  /**
   * Étape HISTORIQUE, jamais produite depuis le lot 4.
   *
   * Déclarée uniquement pour rester alignée sur l'enum PostgreSQL et pour que
   * les manifestes signés avant le lot 4 restent lisibles. Voir
   * ETAPES_HISTORIQUES (circuit.ts) : toute valeur listée là ne peut plus
   * apposer de tampon — composerTampon() lève une exception si on essaie.
   */
  MAGE_SENSIBLE  = 'MAGE_SENSIBLE',
  COMBASE        = 'COMBASE',
}

/**
 * Autorité centrale émettrice d'une consigne.
 *
 * Distincte de RoleUtilisateur à dessein : le rôle dit QUI se connecte,
 * l'autorité dit AU NOM DE QUOI une consigne est émise. Les deux se
 * correspondent aujourd'hui un pour un (AUTORITE_TO_ROLE, circuit.ts), mais
 * les confondre interdirait plus tard qu'un officier délégué émette au nom
 * du MAGE — exactement le cas que le gestionnaire d'intérim doit couvrir.
 */
export enum AutoriteCentrale {
  CEMAA = 'CEMAA',
  MAGE  = 'MAGE',
}

export enum MentionSignature {
  VU     = 'VU',
  ACCORD = 'ACCORD',
}

export enum StatutVol {
  PLANIFIE = 'PLANIFIE',
  EN_COURS = 'EN_COURS',
  CLOTURE  = 'CLOTURE',
  ANNULE   = 'ANNULE',
}

export enum StatutValidation {
  EN_ATTENTE = 'EN_ATTENTE',
  APPROUVE   = 'APPROUVE',
  REJETE     = 'REJETE',
}

export enum TypeMouvement {
  MUTATION      = 'MUTATION',
  DEPART        = 'DEPART',
  SUSPENSION    = 'SUSPENSION',
  REINTEGRATION = 'REINTEGRATION',
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

export enum TypeMission {
  PROJECTION     = 'PROJECTION',
  PARA           = 'PARA',
  LIAISON        = 'LIAISON',
  LOGISTIQUE     = 'LOGISTIQUE',
  EVASAN         = 'EVASAN',
  VIP            = 'VIP',
  OP_SENSIBLE    = 'OP_SENSIBLE',
}

export enum TypeConsigne {
  PERSONNEL = 'PERSONNEL',
  MATERIEL  = 'MATERIEL',
}

export enum OrigineEnregistrement {
  SAISIE = 'SAISIE',
  CEMAA  = 'CEMAA',
  /** Ligne imposée par le MAGE. Cloisonnée de celle du CEMAA. */
  MAGE   = 'MAGE',
}

export enum NiveauConfidentialite {
  NON_CLASSIFIE         = 'NON_CLASSIFIE',
  DIFFUSION_RESTREINTE  = 'DIFFUSION_RESTREINTE',
  CONFIDENTIEL_DEFENSE  = 'CONFIDENTIEL_DEFENSE',
  SENSIBLE_CEMAA        = 'SENSIBLE_CEMAA',
}

export enum TypeMissionLogistique {
  AA              = 'AA',
  IA              = 'IA',
  INTERMINISTERIEL = 'INTERMINISTERIEL',
  INDIVIDUEL      = 'INDIVIDUEL',
  SENSIBLE_CEMAA  = 'SENSIBLE_CEMAA',
}

export enum FonctionEquipage {
  COMBORD    = 'COMBORD',
  COPILOTE   = 'COPILOTE',
  MECANICIEN = 'MECANICIEN',
  AUTRE      = 'AUTRE',
}

/** Suivi d'exécution d'une consigne d'autorité centrale. */
export enum StatutConsigne {
  EMISE        = 'EMISE',
  REALISEE     = 'REALISEE',
  NON_REALISEE = 'NON_REALISEE',
  ANNULEE      = 'ANNULEE',
}