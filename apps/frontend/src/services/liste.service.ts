// apps/frontend/src/services/liste.service.ts
//
// Appels HTTP du domaine « listes ». Aucune logique métier ici : les règles
// (quota, séquencement, qui peut quoi) vivent côté serveur. Ce fichier ne fait
// que typer les échanges — et ce typage est partagé avec le backend via
// @sigea/shared-types, ce qui interdit qu'un écran propose un état que l'API
// ne connaît pas.

import { api } from '@/lib/api';
import type {
  EtapeListe, StatutListe, NatureLigne, Priorite, Rmia,
  CategoriePassager, MentionVisa, StatutPotentialite,
} from '@sigea/shared-types';

// ─── Types de transport ────────────────────────────────────────────────────

export interface Potentialite {
  id: string;
  rmia: Rmia;
  base_id: string;
  nom: string;
  prenom: string;
  grade: string | null;
  matricule: string | null;
  cni: string | null;
  unite: string | null;
  telephone: string;
  categorie: CategoriePassager;
  priorite_proposee: Priorite;
  destination_souhaitee: string | null;
  motif: string | null;
  nb_bagages: number;
  masse_bagages_kg: string | number;
  statut: StatutPotentialite;
  valable_jusqu_au: string | null;
  base?: { code_base: string; nom: string };
}

export interface LigneListe {
  id: string;
  nature: NatureLigne;
  priorite: Priorite;
  rang: number;
  nom: string;
  prenom: string;
  grade: string | null;
  matricule: string | null;
  unite: string | null;
  telephone: string;
  categorie: CategoriePassager;
  destination: string;
  embarquement_ordre: number;
  debarquement_ordre: number;
  nb_bagages: number;
  masse_bagages_kg: string | number;
  origine: string;
  verrouille: boolean;
  motif_decision: string | null;
  discrimine_etape: EtapeListe | null;
}

export interface Fret {
  id: string;
  designation: string;
  proprietaire: string;
  poids_kg: string | number;
  destination: string;
  classe_iata: string | null;
  retire: boolean;
}

export interface Disponibilite {
  places: number;
  masse_kg: number;
  facteur_limitant: 'QUOTA' | 'AERONEF';
}

export interface TableauPriorite {
  priorite: Priorite;
  libelle: string;
  lignes: LigneListe[];
}

export interface ListeDetail {
  liste: {
    id: string;
    statut: StatutListe;
    etape_courante: EtapeListe | null;
    rmia: Rmia;
    version: number;
    motif_rejet: string | null;
    quota_places: number;
    quota_masse_kg: number;
    point: { ordre: number; base_id: string };
    vol: {
      id: string;
      numero_mission: string;
      date_heure: string;
      immatriculation?: string;
      combord_id?: string | null;
    };
  };
  disponibilite: Disponibilite;
  tableaux: TableauPriorite[];
  /** Absente pour les destinataires qui n'y ont pas droit — le COMBORD. */
  liste_attente?: LigneListe[];
  lignes_retirees?: LigneListe[];
  frets: Fret[];
}

export interface ListeResume {
  id: string;
  statut: StatutListe;
  etape_courante: EtapeListe | null;
  rmia: Rmia;
  quota_places: number;
  quota_masse_kg: string | number;
  a_traiter: boolean;
  etape: { ordre: number; base: { code_base: string; nom: string } };
  vol: { numero_mission: string; date_heure: string; immatriculation: string };
  _count: { lignes: number };
}

export interface BlocVisa {
  etape: EtapeListe;
  libelle: string;
  rang: number;
  appose: boolean;
  mention: MentionVisa | null;
  date_heure: string | null;
  signataire: { nom: string; prenom: string; grade: string; titre: string } | null;
  par_delegation: boolean;
  par_interim: boolean;
  hash_court: string | null;
}

export interface Avancement {
  liste_id: string;
  statut: StatutListe;
  etape_courante: EtapeListe | null;
  rang_courant: number;
  total_etapes: number;
  blocs: BlocVisa[];
  consignes_bloquantes: { id: string; autorite: string; statut: string; observation: string | null }[];
  escales_amont_en_attente: { ordre: number; statut: StatutListe }[];
}

export interface Troncon {
  ordre: number;
  places_occupees: number;
  masse_occupee_kg: number;
  capacite_places: number;
  capacite_masse_kg: number;
  places_restantes: number;
  masse_restante_kg: number;
}

// ─── Potentialités ─────────────────────────────────────────────────────────

export const potentialiteService = {
  lister(params: { q?: string; statut?: string; page?: number; taille?: number }) {
    return api
      .get<{ total: number; page: number; taille: number; elements: Potentialite[] }>(
        '/potentialites', { params },
      )
      .then((r) => r.data);
  },

  creer(dto: Record<string, unknown>) {
    return api.post<Potentialite>('/potentialites', dto).then((r) => r.data);
  },

  modifier(id: string, dto: Record<string, unknown>) {
    return api.patch<Potentialite>(`/potentialites/${id}`, dto).then((r) => r.data);
  },

  archiver(id: string, motif: string) {
    return api.patch(`/potentialites/${id}/archiver`, { motif }).then((r) => r.data);
  },
};

// ─── Listes ────────────────────────────────────────────────────────────────

export const listeService = {
  mesListes() {
    return api.get<ListeResume[]>('/listes').then((r) => r.data);
  },

  consulter(id: string) {
    return api.get<ListeDetail>(`/listes/${id}`).then((r) => r.data);
  },

  troncons(vol_id: string) {
    return api.get<Troncon[]>(`/listes/vol/${vol_id}/troncons`).then((r) => r.data);
  },

  /**
   * Porte des personnes du vivier sur la liste.
   *
   * `deborder_en_attente` vaut true par défaut : un secrétaire qui sélectionne
   * quarante noms pour vingt places veut vingt retenus et vingt en attente,
   * pas un message d'erreur et quarante noms à ressaisir.
   */
  selectionner(
    liste_id: string,
    selections: { potentialite_id: string; debarquement_ordre: number; priorite?: Priorite }[],
    deborder = true,
  ) {
    return api
      .post<{ inscrits: number; bascules_en_attente: string[]; disponibilite: Disponibilite }>(
        `/listes/${liste_id}/selection`,
        { selections, deborder_en_attente: deborder },
      )
      .then((r) => r.data);
  },

  ajouterLigne(liste_id: string, dto: Record<string, unknown>) {
    return api.post<LigneListe>(`/listes/${liste_id}/lignes`, dto).then((r) => r.data);
  },

  retirerLigne(liste_id: string, ligne_id: string) {
    return api.delete(`/listes/${liste_id}/lignes/${ligne_id}`).then((r) => r.data);
  },

  ajouterFret(liste_id: string, dto: Record<string, unknown>) {
    return api.post<Fret>(`/listes/${liste_id}/frets`, dto).then((r) => r.data);
  },

  discriminer(
    liste_id: string, ligne_id: string,
    dto: { nature?: NatureLigne; priorite?: Priorite; rang?: number; motif: string },
  ) {
    return api
      .patch<ListeDetail>(`/listes/${liste_id}/lignes/${ligne_id}/discrimination`, dto)
      .then((r) => r.data);
  },

  reordonner(
    liste_id: string,
    dto: { nature: NatureLigne; priorite: Priorite; ordre: string[]; motif: string },
  ) {
    return api.patch<ListeDetail>(`/listes/${liste_id}/ordre`, dto).then((r) => r.data);
  },

  retirerFret(liste_id: string, fret_id: string, motif: string) {
    return api.patch(`/listes/${liste_id}/frets/${fret_id}/retrait`, { motif }).then((r) => r.data);
  },
};

// ─── Circuit ───────────────────────────────────────────────────────────────

export const circuitService = {
  avancement(liste_id: string) {
    return api.get<Avancement>(`/listes/${liste_id}/avancement`).then((r) => r.data);
  },

  viser(liste_id: string, dto: { commentaire?: string; note_delegation?: string }) {
    return api.post(`/listes/${liste_id}/visa`, dto).then((r) => r.data);
  },

  renvoyer(liste_id: string, dto: { motif: string; etape_retour?: EtapeListe }) {
    return api.post(`/listes/${liste_id}/renvoi`, dto).then((r) => r.data);
  },
};

// ─── Messagerie ────────────────────────────────────────────────────────────

export interface EtatMessagerie {
  operateur: string;
  en_attente: number;
  envoyes: number;
  echecs: number;
  detail_echecs: { id: string; telephone: string; nb_tentatives: number; erreur: string | null }[];
}

export const messagerieService = {
  etat(liste_id: string) {
    return api.get<EtatMessagerie>(`/messagerie/listes/${liste_id}`).then((r) => r.data);
  },
  relancer(liste_id: string) {
    return api.post<{ relances: number }>(`/messagerie/listes/${liste_id}/relance`)
      .then((r) => r.data);
  },
};