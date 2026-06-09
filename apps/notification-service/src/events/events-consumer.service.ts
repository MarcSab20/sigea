// apps/notification-service/src/events/events-consumer.service.ts
// Consomme l'exchange topic "sigea.events" et traduit chaque évènement métier
// en diffusion WebSocket vers les rooms de base concernées. Les noms d'évènements
// émis correspondent EXACTEMENT à ceux écoutés par le front (useWebSocket.ts).

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { EVENTS, CEMAA_EVENTS, ALERT_EVENTS } from '@sigea/shared-events';
import { SIGEA_EXCHANGE, NOTIFICATION_QUEUE } from '@sigea/shared-messaging';
import { NotificationGateway } from '../gateway/notification.gateway';

interface BaseScopedEvent {
  manifeste_id?: string;
  base_id?: string;
  vol_id?: string;
  etape?: string;
  statut?: string;
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

  private connection?: amqp.Connection;
  private channel?: amqp.Channel;
  private connecting = false;
  private closed = false;

  constructor(private readonly gateway: NotificationGateway) {}

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
      this.connection = await amqp.connect(this.url);
      this.connection.on('error', (e: Error) =>
        this.logger.error(`Connexion RabbitMQ en erreur : ${e.message}`),
      );
      this.connection.on('close', () => {
        this.channel = undefined;
        this.connection = undefined;
        if (!this.closed) this.scheduleReconnect();
      });

      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(SIGEA_EXCHANGE, 'topic', { durable: true });
      await this.channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });
      await this.channel.bindQueue(NOTIFICATION_QUEUE, SIGEA_EXCHANGE, '#');
      await this.channel.prefetch(20);

      await this.channel.consume(NOTIFICATION_QUEUE, (msg) => {
        if (!msg) return;
        try {
          this.handle(msg.fields.routingKey, JSON.parse(msg.content.toString()));
        } catch (e) {
          this.logger.error(`Message illisible (drop) : ${(e as Error).message}`);
        } finally {
          this.channel?.ack(msg);
        }
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

  private handle(routingKey: string, payload: BaseScopedEvent & CemaaEvent): void {
    switch (routingKey) {
      case EVENTS.MANIFESTE_SUBMITTED:
        if (payload.base_id)
          this.gateway.broadcastToBase(payload.base_id, 'manifeste.submitted', {
            vol_id: payload.vol_id,
          });
        break;

      case EVENTS.MANIFESTE_STEP_VALIDATED:
        if (payload.base_id)
          this.gateway.broadcastToBase(payload.base_id, 'manifeste.step_validated', {
            manifeste_id: payload.manifeste_id,
            etape: payload.etape,
          });
        break;

      case EVENTS.MANIFESTE_STEP_REJECTED:
        if (payload.base_id)
          this.gateway.broadcastToBase(payload.base_id, 'manifeste.step_rejected', {
            manifeste_id: payload.manifeste_id,
          });
        break;

      case EVENTS.MANIFESTE_COMPLETED:
        if (payload.base_id)
          this.gateway.broadcastToBase(payload.base_id, 'manifeste.step_validated', {
            manifeste_id: payload.manifeste_id,
            etape: 'COMBASE',
          });
        break;

      case CEMAA_EVENTS.CONSIGNE_CREATED:
      case CEMAA_EVENTS.CONSIGNE_UPDATED:
        (payload.manifestes ?? []).forEach((m) =>
          this.gateway.broadcastToBase(m.base_id, 'cemaa.consigne_updated', {
            manifeste_id: m.id,
          }),
        );
        break;

      case ALERT_EVENTS.EVASAN:
        if (payload.base_id)
          this.gateway.broadcastToBase(payload.base_id, 'alert.evasan', {
            manifeste_id: payload.manifeste_id,
          });
        break;

      case ALERT_EVENTS.VIP:
        if (payload.base_id)
          this.gateway.broadcastToBase(payload.base_id, 'alert.vip_detected', {
            manifeste_id: payload.manifeste_id,
          });
        break;

      case ALERT_EVENTS.DANGEROUS_GOODS:
        if (payload.base_id)
          this.gateway.broadcastToBase(payload.base_id, 'alert.dangerous_goods', {
            manifeste_id: payload.manifeste_id,
          });
        break;

      default:
        this.logger.debug(`Routing key non gérée : ${routingKey}`);
    }
  }
}
