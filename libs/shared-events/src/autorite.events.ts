// libs/shared-events/src/autorite.events.ts
//
// Remplace `cemaa.events.ts`, dont le nom ne couvrait plus que la moitié du
// domaine depuis l'arrivée du MAGE.
//
// ── Pourquoi des routing keys distinctes par autorité ──
// On aurait pu conserver `cemaa.consigne_created` et discriminer sur un champ
// `autorite` du corps. C'est plus simple à écrire, et c'est un piège :
// RabbitMQ ne sait filtrer que sur la routing key. Un consumer voulant traiter
// les seules consignes MAGE devrait alors recevoir TOUT le flux et jeter la
// moitié des messages. Des clés distinctes gardent cette porte ouverte sans
// rien coûter aujourd'hui.

import { AutoriteCentrale } from '@sigea/shared-types';

export const CEMAA_EVENTS = {
  CONSIGNE_CREATED: 'cemaa.consigne_created',
  CONSIGNE_UPDATED: 'cemaa.consigne_updated',
  PDF_GENERATE:     'pdf.generate',
} as const;

export const MAGE_EVENTS = {
  CONSIGNE_CREATED: 'mage.consigne_created',
  CONSIGNE_UPDATED: 'mage.consigne_updated',
} as const;

/**
 * Clés indexées par autorité — utilisées par le service émetteur.
 *
 * Un Record complet et non un `switch` : ajouter une autorité fera échouer la
 * compilation ici tant que ses clés ne sont pas déclarées, au lieu de laisser
 * passer un `default` silencieux qui publierait sous la mauvaise clé.
 */
export const CONSIGNE_EVENTS: Readonly<
  Record<AutoriteCentrale, { CREATED: string; UPDATED: string }>
> = {
  [AutoriteCentrale.CEMAA]: {
    CREATED: CEMAA_EVENTS.CONSIGNE_CREATED,
    UPDATED: CEMAA_EVENTS.CONSIGNE_UPDATED,
  },
  [AutoriteCentrale.MAGE]: {
    CREATED: MAGE_EVENTS.CONSIGNE_CREATED,
    UPDATED: MAGE_EVENTS.CONSIGNE_UPDATED,
  },
} as const;

/** Toutes les clés de consigne — pour les bindings du consumer. */
export const TOUTES_CLES_CONSIGNE: readonly string[] = Object.values(CONSIGNE_EVENTS)
  .flatMap((c) => [c.CREATED, c.UPDATED]);

export interface ConsigneEvent {
  consigne_id: string;
  /**
   * Autorité émettrice.
   *
   * Présent DANS le corps en plus de la routing key : un consumer lié à
   * plusieurs clés reçoit les messages sans savoir par quel binding ils sont
   * arrivés. Sans ce champ, il devrait le déduire — et le déduire à tort un
   * jour où une clé changera.
   */
  autorite:    AutoriteCentrale;
  vol_id:      string;
  escale_base_id: string | null;
  manifestes:  Array<{ id: string; base_id: string }>;
  timestamp:   string;
}

/** @deprecated Conservé pour les appelants existants. Utilisez ConsigneEvent. */
export interface CemaaConsigneCreatedEvent {
  consigne_id: string;
  vol_id:      string;
  base_id?:    string;
  timestamp:   string;
}