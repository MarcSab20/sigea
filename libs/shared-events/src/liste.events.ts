// libs/shared-events/src/liste.events.ts

import type { Rmia, EtapeListe, MentionVisa } from '@sigea/shared-types';

export const LISTE_EVENTS = {
  /** Liste ouverte à la saisie : le quota vient d'être alloué. */
  LISTE_OUVERTE:   'liste.ouverte',
  /** Un visa vient d'être apposé ; la liste passe à l'étape suivante. */
  LISTE_VISEE:     'liste.visee',
  /** Renvoi en arrière par une autorité. */
  LISTE_REJETEE:   'liste.rejetee',
  /**
   * Arrêté du COMBASE. Déclenche l'émission du manifeste ET l'envoi des
   * messages aux voyageurs retenus.
   */
  LISTE_ARRETEE:   'liste.arretee',
  /** Visa du COMBORD : manifeste définitif. */
  LISTE_CLOTUREE:  'liste.cloturee',
} as const;

export interface ListeOuverteEvent {
  liste_id:  string;
  vol_id:    string;
  etape_id:  string;
  ordre:     number;
  base_id:   string;
  rmia:      Rmia;
  quota_places:   number;
  quota_masse_kg: number;
  timestamp: string;
}

export interface ListeViseeEvent {
  liste_id:       string;
  vol_id:         string;
  rmia:           Rmia;
  etape:          EtapeListe;
  mention:        MentionVisa;
  etape_suivante: EtapeListe | null;
  signataire_id:  string;
  /** Renseigné à l'étape COMBASE lorsque la discrimination a été déléguée. */
  delegataire_id: string | null;
  hash_contenu:   string;
  timestamp:      string;
}

export interface ListeRejeteeEvent {
  liste_id:   string;
  vol_id:     string;
  rmia:       Rmia;
  etape:      EtapeListe;
  etape_retour: EtapeListe;
  motif:      string;
  rejete_par: string;
  timestamp:  string;
}

export interface ListeArreteeEvent {
  liste_id:     string;
  vol_id:       string;
  manifeste_id: string;
  base_id:      string;
  rmia:         Rmia;
  /** Lignes hiérarchisées portées au manifeste. */
  nb_passagers: number;
  /** Destinataires des messages pratiques. */
  destinataires: { ligne_id: string; telephone: string; nom: string; prenom: string }[];
  date_heure_vol: string;
  timestamp:      string;
}

export interface ListeClotureeEvent {
  liste_id:     string;
  vol_id:       string;
  manifeste_id: string;
  base_id:      string;
  combord_id:   string;
  timestamp:    string;
}