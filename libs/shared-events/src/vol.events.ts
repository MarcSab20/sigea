// libs/shared-events/src/vol.events.ts

import type { Rmia } from '@sigea/shared-types';

export const VOL_EVENTS = {
  /** Vol planifié, NON diffusé. Destiné au seul SCOPS. */
  VOL_PLANIFIE: 'vol.planifie',
  /** Quotas alloués : le vol devient visible des RMIA touchées. */
  VOL_DIFFUSE:  'vol.diffuse',
  /** Quota d'un point d'itinéraire réajusté après diffusion. */
  VOL_QUOTA_AJUSTE: 'vol.quota_ajuste',
  VOL_ANNULE:   'vol.annule',
} as const;

export interface VolPlanifieEvent {
  vol_id:         string;
  numero_mission: string;
  base_depart_id: string;
  cree_par:       string;
  /** Points de l'itinéraire, dans l'ordre. */
  itineraire:     { ordre: number; base_id: string; code_base: string; rmia: Rmia }[];
  timestamp:      string;
}

export interface VolDiffuseEvent {
  vol_id:         string;
  numero_mission: string;
  diffuse_par:    string;
  /**
   * RMIA destinataires. Déduites des points d'EMBARQUEMENT (ordre < n) et non
   * de tout l'itinéraire : la RMIA du point d'arrivée final n'a personne à
   * inscrire, la notifier serait du bruit.
   */
  rmia_destinataires: Rmia[];
  /** Une liste ouverte par point d'embarquement. */
  listes: { liste_id: string; etape_id: string; ordre: number; base_id: string; rmia: Rmia }[];
  timestamp: string;
}

export interface VolQuotaAjusteEvent {
  vol_id:    string;
  etape_id:  string;
  rmia:      Rmia;
  quota_places_avant:   number | null;
  quota_places_apres:   number;
  quota_masse_kg_avant: number | null;
  quota_masse_kg_apres: number;
  ajuste_par: string;
  timestamp:  string;
}

export interface VolAnnuleEvent {
  vol_id:    string;
  motif:     string | null;
  annule_par: string;
  timestamp: string;
}