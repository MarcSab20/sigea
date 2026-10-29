// libs/shared-messaging/src/event-routing.ts
//
// Exchange et clés de routage RabbitMQ. Les clés RÉUTILISENT les constantes de
// @sigea/shared-events : source de vérité unique.

import { EVENTS, VOL_EVENTS, LISTE_EVENTS, CEMAA_EVENTS, ALERT_EVENTS } from '@sigea/shared-events';

/** Exchange topic unique pour tous les évènements métier SIGEA. */
export const SIGEA_EXCHANGE = 'sigea.events';

/** File durable consommée par le notification-service. */
export const NOTIFICATION_QUEUE = 'sigea.notifications';

/**
 * File durable consommée par la passerelle de messagerie opérateur.
 *
 * Séparée de NOTIFICATION_QUEUE à dessein : l'envoi d'un SMS passe par un tiers
 * facturé et parfois indisponible. Mélanger ces messages aux notifications
 * internes ferait prendre à celles-ci le retard d'un opérateur téléphonique.
 */
export const MESSAGERIE_QUEUE = 'sigea.messagerie';

export const ROUTING = {
  MANIFESTE_SUBMITTED:      EVENTS.MANIFESTE_SUBMITTED,
  MANIFESTE_STEP_VALIDATED: EVENTS.MANIFESTE_STEP_VALIDATED,
  MANIFESTE_STEP_REJECTED:  EVENTS.MANIFESTE_STEP_REJECTED,
  MANIFESTE_COMPLETED:      EVENTS.MANIFESTE_COMPLETED,

  VOL_PLANIFIE:     VOL_EVENTS.VOL_PLANIFIE,
  VOL_DIFFUSE:      VOL_EVENTS.VOL_DIFFUSE,
  VOL_QUOTA_AJUSTE: VOL_EVENTS.VOL_QUOTA_AJUSTE,
  VOL_ANNULE:       VOL_EVENTS.VOL_ANNULE,

  LISTE_OUVERTE:  LISTE_EVENTS.LISTE_OUVERTE,
  LISTE_VISEE:    LISTE_EVENTS.LISTE_VISEE,
  LISTE_REJETEE:  LISTE_EVENTS.LISTE_REJETEE,
  LISTE_ARRETEE:  LISTE_EVENTS.LISTE_ARRETEE,
  LISTE_CLOTUREE: LISTE_EVENTS.LISTE_CLOTUREE,

  CEMAA_CONSIGNE_CREATED: CEMAA_EVENTS.CONSIGNE_CREATED,
  CEMAA_CONSIGNE_UPDATED: CEMAA_EVENTS.CONSIGNE_UPDATED,

  ALERT_EVASAN:          ALERT_EVENTS.EVASAN,
  ALERT_VIP:             ALERT_EVENTS.VIP,
  ALERT_DANGEROUS_GOODS: ALERT_EVENTS.DANGEROUS_GOODS,
} as const;

export type RoutingKey = (typeof ROUTING)[keyof typeof ROUTING];