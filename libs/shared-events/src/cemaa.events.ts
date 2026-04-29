export const CEMAA_EVENTS = {
  CONSIGNE_CREATED: 'cemaa.consigne_created',
  CONSIGNE_UPDATED: 'cemaa.consigne_updated',
  PDF_GENERATE:     'pdf.generate',
} as const;

export interface CemaaConsigneCreatedEvent {
  consigne_id: string;
  vol_id:      string;
  base_id?:    string;
  timestamp:   string;
}
