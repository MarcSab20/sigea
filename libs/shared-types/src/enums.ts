export enum RoleUtilisateur {
  CHEF_ESCALE = 'chef_escale',
  COMESO      = 'comeso',
  COMGMO      = 'comgmo',
  COMBORD     = 'combord',
  COMBASE     = 'combase',
  CEMAA       = 'cemaa',
  ADMIN       = 'admin',
}

export enum StatutManifeste {
  BROUILLON     = 'BROUILLON',
  SOUMIS        = 'SOUMIS',
  EN_VALIDATION = 'EN_VALIDATION',
  VALIDE        = 'VALIDE',
  REJETE        = 'REJETE',
}

export enum EtapeValidation {
  COMESO         = 'COMESO',
  COMGMO         = 'COMGMO',
  COMBORD        = 'COMBORD',
  CEMAA_SENSIBLE = 'CEMAA_SENSIBLE',
  COMBASE        = 'COMBASE',
}

export enum StatutValidation {
  EN_ATTENTE = 'EN_ATTENTE',
  APPROUVE   = 'APPROUVE',
  REJETE     = 'REJETE',
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
