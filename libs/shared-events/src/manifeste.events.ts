export const EVENTS = {
  MANIFESTE_SUBMITTED:    'manifeste.submitted',
  MANIFESTE_STEP_VALIDATED: 'manifeste.step_validated',
  MANIFESTE_STEP_REJECTED:  'manifeste.step_rejected',
  MANIFESTE_COMPLETED:    'manifeste.completed',
} as const;

export interface ManifesteSubmittedEvent {
  manifeste_id: string;
  base_id:      string;
  vol_id:       string;
  timestamp:    string;
}

export interface ManifesteCompletedEvent {
  manifeste_id:          string;
  base_id:               string;
  vol_id:                string;
  flag_sensible:         boolean;
  validateur_combase_id: string;
  timestamp:             string;
}

export interface ManifesteStepValidatedEvent {
  manifeste_id: string;
  base_id:      string;
  etape:        string;
  statut:       'APPROUVE' | 'REJETE';
  timestamp:    string;
}
