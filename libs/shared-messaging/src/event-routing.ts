// libs/shared-messaging/src/event-routing.ts
// Définition centralisée de l'exchange et des clés de routage RabbitMQ.
// Les clés de routage RÉUTILISENT les constantes déjà déclarées dans
// @sigea/shared-events afin de garder une source de vérité unique.

import { EVENTS, CEMAA_EVENTS, ALERT_EVENTS } from '@sigea/shared-events';

/** Exchange topic unique pour tous les évènements métier SIGEA. */
export const SIGEA_EXCHANGE = 'sigea.events';

/** File durable consommée par le notification-service. */
export const NOTIFICATION_QUEUE = 'sigea.notifications';

/**
 * Clés de routage utilisées comme topics.
 * Un consommateur peut binder '#' (tout), 'manifeste.*', 'cemaa.*', 'alert.*'.
 */
export const ROUTING = {
  MANIFESTE_SUBMITTED: EVENTS.MANIFESTE_SUBMITTED,
  MANIFESTE_STEP_VALIDATED: EVENTS.MANIFESTE_STEP_VALIDATED,
  MANIFESTE_STEP_REJECTED: EVENTS.MANIFESTE_STEP_REJECTED,
  MANIFESTE_COMPLETED: EVENTS.MANIFESTE_COMPLETED,
  CEMAA_CONSIGNE_CREATED: CEMAA_EVENTS.CONSIGNE_CREATED,
  CEMAA_CONSIGNE_UPDATED: CEMAA_EVENTS.CONSIGNE_UPDATED,
  ALERT_EVASAN: ALERT_EVENTS.EVASAN,
  ALERT_VIP: ALERT_EVENTS.VIP,
  ALERT_DANGEROUS_GOODS: ALERT_EVENTS.DANGEROUS_GOODS,
} as const;

export type RoutingKey = (typeof ROUTING)[keyof typeof ROUTING];
