// apps/frontend/src/services/manifeste.service.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI DISPARAÎT
// ═══════════════════════════════════════════════════════════════════════════
// La création et l'édition d'un manifeste n'existent plus. Le manifeste est
// l'EXTRAIT de la liste hiérarchisée, émis automatiquement à l'arrêté du
// commandant de base. Personne ne le saisit.
//
// Les statuts BROUILLON et SOUMIS, le modèle `etape_vol`, les validations à
// cinq étapes : tout cela appartenait à l'ancien circuit. Le manifeste ne
// connaît plus que EMIS puis DEFINITIF, et une seule signature — celle du
// commandant de bord.
//
// Le mode hors ligne est également retiré : on ne met pas en file d'attente la
// discrimination d'un document qui n'a plus qu'une étape, et dont la validité
// dépend d'un état serveur que le client ne peut pas connaître.

import { api } from '@/lib/api';
import type { Priorite } from '@sigea/shared-types';

export interface PassagerManifeste {
  id: string;
  ligne_liste_id: string;
  priorite: Priorite;
  rang: number;
  nom: string;
  prenom: string;
  grade: string | null;
  categorie: string;
  matricule: string | null;
  cni: string | null;
  unite: string | null;
  telephone: string;
  destination: string;
  debarquement_ordre: number;
  nb_bagages: number;
  masse_bagages_kg: string | number;
  couleur_bagages: string | null;
  origine: string;
  retire: boolean;
  motif_retrait: string | null;
}

export interface MaterielManifeste {
  id: string;
  designation: string;
  proprietaire: string;
  poids_kg: string | number;
  destination: string;
  classe_iata: string | null;
  origine: string;
  retire: boolean;
  motif_retrait: string | null;
}

export interface EquipageManifeste {
  id?: string;
  nom: string;
  prenom: string;
  grade: string;
  fonction: string;
}

export interface ManifesteResume {
  id: string;
  numero_manifeste: string;
  statut: 'EMIS' | 'DEFINITIF' | 'ANNULE';
  emis_le: string;
  definitif_le: string | null;
  base: { code_base: string; nom: string };
  vol: { numero_mission: string; date_heure: string; immatriculation: string };
  etape: { ordre: number };
  _count: { passagers: number };
}

export interface TableauPrioriteManifeste {
  priorite: Priorite;
  libelle: string;
  lignes: PassagerManifeste[];
}

export interface ManifesteDetail {
  manifeste: {
    id: string;
    numero: string;
    statut: 'EMIS' | 'DEFINITIF' | 'ANNULE';
    version: number;
    flag_sensible: boolean;
    emis_le: string;
    definitif_le: string | null;
    base: { code_base: string; nom: string; numero: string };
    point: { ordre: number };
    vol: {
      numero_mission: string;
      immatriculation: string;
      date_heure: string;
      type_mission: string;
      combord_id: string | null;
      combord_grade: string;
      combord_nom: string;
      combord_prenom: string;
      itineraire: { ordre: number; base: { code_base: string } }[];
    };
  };
  tableaux: TableauPrioriteManifeste[];
  passagers_retires: PassagerManifeste[];
  materiels: MaterielManifeste[];
  materiels_retires: MaterielManifeste[];
  equipages: EquipageManifeste[];
  /** Liste d'origine — porte l'identifiant nécessaire au visa du COMBORD. */
  liste: {
    id: string;
    rmia: string;
    statut: string;
    etape_courante: string | null;
    visas: Array<{
      etape: string; mention: string; date_heure: string;
      signataire_nom: string; signataire_grade: string; signataire_titre: string;
      hash_contenu: string;
    }>;
  } | null;
  totaux: { passagers: number; masse_bagages_kg: number; masse_fret_kg: number };
}

export const manifesteService = {
  lister() {
    return api.get<ManifesteResume[]>('/manifestes').then((r) => r.data);
  },

  consulter(id: string) {
    return api.get<ManifesteDetail>(`/manifestes/${id}`).then((r) => r.data);
  },

  retirerPassager(manifeste_id: string, passager_id: string, motif: string) {
    return api
      .patch(`/manifestes/${manifeste_id}/passagers/${passager_id}/retrait`, { motif })
      .then((r) => r.data);
  },

  reintegrerPassager(manifeste_id: string, passager_id: string) {
    return api
      .patch(`/manifestes/${manifeste_id}/passagers/${passager_id}/reintegration`)
      .then((r) => r.data);
  },

  retirerMateriel(manifeste_id: string, materiel_id: string, motif: string) {
    return api
      .patch(`/manifestes/${manifeste_id}/materiels/${materiel_id}/retrait`, { motif })
      .then((r) => r.data);
  },

  definirEquipage(manifeste_id: string, membres: EquipageManifeste[]) {
    return api.put(`/manifestes/${manifeste_id}/equipage`, { membres }).then((r) => r.data);
  },

  /**
   * Visa du commandant de bord.
   *
   * Passe par le circuit de la LISTE et non par le manifeste : c'est la même
   * progression, et la cinquième étape y figure. Le manifeste n'a pas de
   * machine à états propre — en avoir une seconde obligerait à synchroniser
   * deux états sur un même dossier.
   */
  viser(liste_id: string, commentaire?: string) {
    return api.post(`/listes/${liste_id}/visa`, { commentaire }).then((r) => r.data);
  },
};