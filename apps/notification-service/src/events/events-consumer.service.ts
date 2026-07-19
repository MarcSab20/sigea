// apps/notification-service/src/events/events-consumer.service.ts
// Consomme l'exchange topic "sigea.events" et traduit chaque évènement métier
// en diffusion WebSocket vers les rooms de base concernées. Les noms d'évènements
// émis correspondent EXACTEMENT à ceux écoutés par le front (useWebSocket.ts).

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { EVENTS, CEMAA_EVENTS, ALERT_EVENTS } from '@sigea/shared-events';
import { SIGEA_EXCHANGE, NOTIFICATION_QUEUE } from '@sigea/shared-messaging';
import { LIBELLE_ETAPE, EtapeValidation } from '@sigea/shared-types';
import { PrismaService } from '@sigea/shared-database';
import { NotificationGateway } from '../gateway/notification.gateway';
import { NotificationService } from '../notifications/notification.service';

interface BaseScopedEvent {
  manifeste_id?: string;
  base_id?: string;
  vol_id?: string;
  etape?: string;
  etape_suivante?: string | null;
  statut?: string;
  motif?: string;
}

interface CemaaEvent {
  consigne_id: string;
  vol_id: string;
  manifestes?: Array<{ id: string; base_id: string }>;
}

@Injectable()
export class EventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsConsumer.name);
  private readonly url = process.env.RABBITMQ_URL ?? 'amqp://sigea:sigea@localhost:5672';

  // @types/amqplib 0.10.x : connect() renvoie ChannelModel, pas Connection.
  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;
  private connecting = false;
  private closed = false;

  constructor(
    private readonly gateway: NotificationGateway,
    private readonly notifications: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      /* best-effort */
    }
  }

  private async connect(): Promise<void> {
    if (this.connecting || this.closed) return;
    this.connecting = true;
    try {
      const connection = await amqp.connect(this.url);
      this.connection = connection;

      connection.on('error', (e: Error) =>
        this.logger.error(`Connexion RabbitMQ en erreur : ${e.message}`),
      );
      connection.on('close', () => {
        this.channel = undefined;
        this.connection = undefined;
        if (!this.closed) this.scheduleReconnect();
      });

      const channel = await connection.createChannel();
      this.channel = channel;
      await channel.assertExchange(SIGEA_EXCHANGE, 'topic', { durable: true });
      await channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });
      await channel.bindQueue(NOTIFICATION_QUEUE, SIGEA_EXCHANGE, '#');
      await channel.prefetch(20);

      await channel.consume(NOTIFICATION_QUEUE, (msg) => {
        if (!msg) return;
        // Traitement async : on ack APRÈS persistance/diffusion réussies.
        // En cas d'erreur, nack sans requeue (le message part en dead-letter
        // plutôt que de boucler indéfiniment).
        void this.handle(msg.fields.routingKey, JSON.parse(msg.content.toString()))
          .then(() => this.channel?.ack(msg))
          .catch((e) => {
            this.logger.error(`Traitement échoué (nack) : ${(e as Error).message}`);
            this.channel?.nack(msg, false, false);
          });
      });

      this.logger.log(`Consommateur prêt (queue "${NOTIFICATION_QUEUE}", exchange "${SIGEA_EXCHANGE}")`);
    } catch (e) {
      this.logger.warn(
        `RabbitMQ indisponible (${(e as Error).message}) — reconnexion dans 5s`,
      );
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    setTimeout(() => void this.connect(), 5000);
  }

  private async handle(routingKey: string, payload: BaseScopedEvent & CemaaEvent): Promise<void> {
    switch (routingKey) {
      // ── Soumission : le circuit démarre, toute la base est informée ──
      case EVENTS.MANIFESTE_SUBMITTED: {
        if (!payload.base_id) break;
        const suivante = this.libelle(payload.etape ?? payload.etape_suivante);
        await this.notifications.emettre({
          base_id: payload.base_id,
          type: 'MANIFESTE_SOUMIS',
          titre: 'Manifeste soumis',
          message: suivante
            ? `Un manifeste attend la validation de ${suivante}.`
            : 'Un manifeste a été soumis au circuit de validation.',
          manifeste_id: payload.manifeste_id,
          vol_id: payload.vol_id,
          etape: payload.etape_suivante ?? undefined,
        });
        break;
      }

      // ── Étape validée : la base voit l'avancement ──
      case EVENTS.MANIFESTE_STEP_VALIDATED: {
        if (!payload.base_id) break;
        const etape = this.libelle(payload.etape);
        const suivante = this.libelle(payload.etape_suivante);
        await this.notifications.emettre({
          base_id: payload.base_id,
          type: 'ETAPE_VALIDEE',
          titre: `Validation ${etape ?? ''}`.trim(),
          message: suivante
            ? `${etape} a validé. En attente de ${suivante}.`
            : `${etape} a validé le manifeste.`,
          manifeste_id: payload.manifeste_id,
          vol_id: payload.vol_id,
          etape: payload.etape,
        });
        break;
      }

      // ── Rejet : notifier TOUS les acteurs déjà passés + le suivant ──
      // "Le suivant" après un rejet, c'est le chef d'escale qui doit corriger.
      case EVENTS.MANIFESTE_STEP_REJECTED: {
        if (!payload.base_id || !payload.manifeste_id) break;
        const etape = this.libelle(payload.etape);
        const message = payload.motif
          ? `Manifeste rejeté à l'étape ${etape} : ${payload.motif}`
          : `Manifeste rejeté à l'étape ${etape}.`;

        // Acteurs déjà passés : les validateurs des étapes approuvées.
        const acteurs = await this.acteursPasses(payload.manifeste_id);
        if (acteurs.length) {
          await this.notifications.emettrePlusieurs(
            acteurs.map((uid) => ({
              base_id: payload.base_id!,
              destinataire_id: uid,
              type: 'ETAPE_REJETEE' as const,
              titre: 'Manifeste rejeté',
              message,
              manifeste_id: payload.manifeste_id,
              vol_id: payload.vol_id,
              etape: payload.etape,
            })),
          );
        } else {
          // Aucun acteur identifié : au moins informer la base.
          await this.notifications.emettre({
            base_id: payload.base_id,
            type: 'ETAPE_REJETEE',
            titre: 'Manifeste rejeté',
            message,
            manifeste_id: payload.manifeste_id,
            vol_id: payload.vol_id,
            etape: payload.etape,
          });
        }
        break;
      }

      // ── Circuit terminé ──
      case EVENTS.MANIFESTE_COMPLETED: {
        if (!payload.base_id) break;
        await this.notifications.emettre({
          base_id: payload.base_id,
          type: 'MANIFESTE_COMPLETE',
          titre: 'Manifeste validé',
          message: 'Le circuit de validation est terminé : manifeste signé par le commandant de base.',
          manifeste_id: payload.manifeste_id,
          vol_id: payload.vol_id,
          etape: 'COMBASE',
        });
        break;
      }

      // ── Consignes CEMAA appliquées ──
      case CEMAA_EVENTS.CONSIGNE_CREATED:
      case CEMAA_EVENTS.CONSIGNE_UPDATED: {
        for (const m of payload.manifestes ?? []) {
          await this.notifications.emettre({
            base_id: m.base_id,
            type: 'CONSIGNE_CEMAA',
            titre: 'Consignes CEMAA',
            message: 'Des consignes CEMAA ont été appliquées à un manifeste de votre base.',
            manifeste_id: m.id,
            vol_id: payload.vol_id,
          });
        }
        break;
      }

      // ── Alertes ──
      case ALERT_EVENTS.EVASAN:
        await this.alerte(payload, 'Passager EVASAN à bord');
        break;
      case ALERT_EVENTS.VIP:
        await this.alerte(payload, 'Passager VIP à bord');
        break;
      case ALERT_EVENTS.DANGEROUS_GOODS:
        await this.alerte(payload, 'Marchandise dangereuse déclarée');
        break;

      default:
        this.logger.debug(`Routing key non gérée : ${routingKey}`);
    }
  }

  private async alerte(payload: BaseScopedEvent, message: string): Promise<void> {
    if (!payload.base_id) return;
    await this.notifications.emettre({
      base_id: payload.base_id,
      type: 'ALERTE',
      titre: 'Alerte manifeste',
      message,
      manifeste_id: payload.manifeste_id,
      vol_id: payload.vol_id,
    });
  }

  /** Libellé lisible d'une étape, tolérant aux valeurs inconnues/nulles. */
  private libelle(etape?: string | null): string | undefined {
    if (!etape) return undefined;
    return LIBELLE_ETAPE[etape as EtapeValidation] ?? etape;
  }

  /**
   * Identifiants des validateurs ayant APPROUVÉ une étape de ce manifeste :
   * ce sont "les acteurs déjà passés" à notifier lors d'un rejet.
   */
  private async acteursPasses(manifeste_id: string): Promise<string[]> {
    const etapes = await this.prisma.validationEtape.findMany({
      where: { manifeste_id, statut: 'APPROUVE', validateur_id: { not: null } },
      select: { validateur_id: true },
    });
    // Dédoublonnage (un même agent peut théoriquement avoir signé 2 étapes).
    return [...new Set(etapes.map((e) => e.validateur_id).filter((x): x is string => !!x))];
  }
}