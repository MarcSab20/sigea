// apps/frontend/src/services/vol.service.ts

import { api } from '@/lib/api';
import type { StatutVol, TypeMission, Rmia } from '@sigea/shared-types';

export interface PointItineraire {
  id: string;
  ordre: number;
  base_id: string;
  rmia: Rmia;
  quota_places: number | null;
  quota_masse_kg: string | number | null;
  base: { code_base: string; nom: string };
  listes?: { id: string; statut: string; etape_courante: string | null }[];
}

export interface Vol {
  id: string;
  numero_mission: string;
  immatriculation: string;
  date_heure: string;
  type_mission: TypeMission;
  statut: StatutVol;
  capacite_places: number;
  capacite_cargo_kg: string | number;
  combord_grade: string;
  combord_nom: string;
  combord_prenom: string;
  diffuse_le: string | null;
  itineraire: PointItineraire[];
  aeronef?: { immatriculation: string; type: string; capacite_places?: number };
}

export const volService = {
  lister() {
    return api.get<Vol[]>('/vols').then((r) => r.data);
  },

  consulter(id: string) {
    return api.get<Vol>(`/vols/${id}`).then((r) => r.data);
  },

  /** File d'attente du SCOPS : vols planifiés, non encore diffusés. */
  aDiffuser() {
    return api.get<Vol[]>('/vols/a-diffuser').then((r) => r.data);
  },

  creer(dto: Record<string, unknown>) {
    return api.post<Vol>('/vols', dto).then((r) => r.data);
  },

  annuler(id: string, motif?: string) {
    return api.patch(`/vols/${id}/annuler`, { motif }).then((r) => r.data);
  },

  /**
   * Allocation des quotas par le SCOPS.
   *
   * Tout-ou-rien : l'API exige un quota pour CHAQUE point d'embarquement.
   * Une allocation partielle laisserait des RMIA notifiées d'un vol sans
   * quota, donc devant un écran de saisie vide.
   */
  diffuser(
    vol_id: string,
    quotas: { etape_id: string; quota_places: number; quota_masse_kg: number }[],
    observation?: string,
  ) {
    return api.post<Vol>(`/vols/${vol_id}/diffusion`, { quotas, observation })
      .then((r) => r.data);
  },

  ajusterQuota(
    vol_id: string, etape_id: string,
    dto: { quota_places: number; quota_masse_kg: number; motif: string },
  ) {
    return api.patch(`/vols/${vol_id}/itineraire/${etape_id}/quota`, dto).then((r) => r.data);
  },
};