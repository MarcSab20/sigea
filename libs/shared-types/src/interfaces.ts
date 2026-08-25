import {
  RoleUtilisateur, StatutManifeste, ROLES_AUTORITE_CENTRALE,
} from './enums';

export interface DelegationJwt {
  id:   string;
  role: RoleUtilisateur;
}

export interface JwtPayload {
  sub:     string;
  role:    RoleUtilisateur;
  base_id: string;
  jti:     string;
  iat:     number;
  exp:     number;
  escadron_id?: string | null;
  interims?: DelegationJwt[];
}

export function rolesEffectifs(user: Pick<JwtPayload, 'role' | 'interims'>): RoleUtilisateur[] {
  const roles = new Set<RoleUtilisateur>([user.role]);
  for (const d of user.interims ?? []) roles.add(d.role);
  return [...roles];
}

export function delegationPourRole(
  user: Pick<JwtPayload, 'role' | 'interims'>,
  role: RoleUtilisateur,
): DelegationJwt | undefined {
  if (user.role === role) return undefined;
  return (user.interims ?? []).find((d) => d.role === role);
}

export function estAutoriteCentrale(role: RoleUtilisateur): boolean {
  return ROLES_AUTORITE_CENTRALE.includes(role);
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