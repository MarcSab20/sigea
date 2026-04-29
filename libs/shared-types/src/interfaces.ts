import { RoleUtilisateur, CategoriePassager, OrigineEnregistrement, StatutManifeste, EtapeValidation, StatutValidation } from './enums';

export interface JwtPayload {
  sub:     string;
  role:    RoleUtilisateur;
  base_id: string;
  jti:     string;
  iat:     number;
  exp:     number;
}

export interface ManifesteSummary {
  id:            string;
  vol_id:        string;
  base_id:       string;
  statut:        StatutManifeste;
  flag_sensible: boolean;
  etape_vol:     string;
  version:       number;
  createdAt:     Date;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv:         string;
  authTag:    string;
}

export interface AuditEntry {
  user_id:   string;
  base_id:   string;
  role:      RoleUtilisateur;
  action:    string;
  resource:  string;
  timestamp: string;
  ip?:       string;
}
