// libs/shared-types/src/interfaces.ts

import {
  RoleUtilisateur, Rmia, StatutManifeste, StatutListe, EtapeListe,
  NatureLigne, Priorite, ROLES_AUTORITE_CENTRALE,
} from './enums';
import { Perimetre, perimetreDeRole } from './rmia';

export interface DelegationJwt {
  id:    string;
  role:  RoleUtilisateur;
  rmia?: Rmia | null;
}

export interface JwtPayload {
  sub:  string;
  role: RoleUtilisateur;
  /**
   * Base d'affectation. NULLE pour la chaîne RMIA — comrmia, adj_air,
   * sec_adj_air — qui relève d'une région et non d'une base.
   *
   * Le champ reste présent dans le jeton pour tous les autres rôles : c'est
   * lui qui porte leur cloisonnement. Les deux champs sont exclusifs, et
   * `perimetreDeRole` dit lequel s'applique.
   */
  base_id: string | null;
  /** RMIA de rattachement. Présente pour la chaîne régionale, absente ailleurs. */
  rmia?:   Rmia | null;
  jti:  string;
  iat:  number;
  exp:  number;
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
 * par `perimetreEffectif`.
 */
export function rmiasCouvertes(user: Pick<JwtPayload, 'role' | 'rmia' | 'interims'>): Rmia[] {
  const set = new Set<Rmia>();
  if (user.rmia) set.add(user.rmia);
  for (const d of user.interims ?? []) if (d.rmia) set.add(d.rmia);
  return [...set];
}

/**
 * Base du compte, lorsqu'elle existe.
 *
 * Fonction plutôt qu'accès direct à `user.base_id` : depuis que la chaîne RMIA
 * n'a plus de base, tout code qui lisait ce champ sans se poser la question
 * manipule désormais un `null`. Passer par ici force l'appelant à traiter le
 * cas, et la recherche du symbole donne la liste exhaustive des endroits
 * concernés — ce qu'un `user.base_id` disséminé ne permettait pas.
 */
export function baseDuCompte(user: Pick<JwtPayload, 'base_id'>): string | null {
  return user.base_id ?? null;
}

/** Vrai si l'utilisateur est rattaché à cette base. Faux s'il n'en a aucune. */
export function estDeLaBase(user: Pick<JwtPayload, 'base_id'>, base_id: string): boolean {
  return Boolean(user.base_id) && user.base_id === base_id;
}

// ─── Vues de synthèse ──────────────────────────────────────────────────────

export interface ManifesteSummary {
  id:            string;
  vol_id:        string;
  base_id:       string;
  statut:        StatutManifeste;
  flag_sensible: boolean;
  version:       number;
  createdAt:     Date;
}

export interface ListeSummary {
  id:              string;
  vol_id:          string;
  etape_id:        string;
  ordre:           number;
  base_code:       string;
  rmia:            Rmia;
  statut:          StatutListe;
  etape_courante:  EtapeListe | null;
  quota_places:    number;
  quota_masse_kg:  number;
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