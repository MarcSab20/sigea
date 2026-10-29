// libs/shared-types/src/interfaces.ts

import {
  RoleUtilisateur, Rmia, StatutManifeste, StatutListe, EtapeListe,
  NatureLigne, Priorite, ROLES_AUTORITE_CENTRALE,
} from './enums';
import { Perimetre, perimetreDeRole } from './rmia';

export interface DelegationJwt {
  id:    string;
  role:  RoleUtilisateur;
  /** RMIA de la délégation, pour les rôles de la chaîne RMIA. */
  rmia?: Rmia | null;
}

export interface JwtPayload {
  sub:     string;
  role:    RoleUtilisateur;
  base_id: string;
  jti:     string;
  iat:     number;
  exp:     number;
  /**
   * RMIA de rattachement. Présente pour comrmia / adj_air / sec_adj_air,
   * absente ailleurs. Portée par le jeton pour que le cloisonnement RMIA
   * n'exige pas une lecture en base à chaque requête — exactement comme
   * `base_id` l'est depuis l'origine.
   */
  rmia?:        Rmia | null;
  escadron_id?: string | null;
  interims?:    DelegationJwt[];
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

/**
 * Périmètre le plus large détenu par l'utilisateur, intérims compris.
 *
 * On retient le PLUS LARGE et non celui du rôle propre : un officier assurant
 * l'intérim d'un rôle national doit disposer du périmètre national, sans quoi
 * la délégation serait purement décorative.
 */
export function perimetreEffectif(user: Pick<JwtPayload, 'role' | 'interims'>): Perimetre {
  const ordre: Record<Perimetre, number> = {
    [Perimetre.BASE]: 0, [Perimetre.RMIA]: 1, [Perimetre.NATIONAL]: 2,
  };
  return rolesEffectifs(user)
    .map(perimetreDeRole)
    .reduce((a, b) => (ordre[b] > ordre[a] ? b : a), Perimetre.BASE);
}

/**
 * RMIA couvertes par l'utilisateur.
 *
 * Tableau vide = périmètre national (aucune restriction) OU périmètre base
 * (la restriction porte alors sur `base_id`). L'appelant distingue les deux
 * par `perimetreEffectif` ; renvoyer un tableau vide dans les deux cas évite
 * une valeur sentinelle dont on finirait par oublier le sens.
 */
export function rmiasCouvertes(user: Pick<JwtPayload, 'role' | 'rmia' | 'interims'>): Rmia[] {
  const set = new Set<Rmia>();
  if (user.rmia) set.add(user.rmia);
  for (const d of user.interims ?? []) if (d.rmia) set.add(d.rmia);
  return [...set];
}

// ─── Vues de synthèse ──────────────────────────────────────────────────────

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

export interface ListeSummary {
  id:             string;
  vol_id:         string;
  etape_id:       string;
  ordre:          number;
  base_code:      string;
  rmia:           Rmia;
  statut:         StatutListe;
  etape_courante: EtapeListe | null;
  quota_places:   number;
  quota_masse_kg: number;
  nb_hierarchisee: number;
  nb_attente:      number;
}

export interface LigneListeVue {
  id:                 string;
  nature:             NatureLigne;
  priorite:           Priorite;
  rang:               number;
  nom:                string;
  prenom:             string;
  grade:              string | null;
  matricule:          string | null;
  unite:              string | null;
  telephone:          string;
  destination:        string;
  embarquement_ordre: number;
  debarquement_ordre: number;
  masse_bagages_kg:   number;
  verrouille:         boolean;
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