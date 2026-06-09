// libs/shared-messaging/src/event-publisher.service.ts
// Publication d'évènements vers RabbitMQ (exchange topic), en mode BEST-EFFORT :
// si le broker est indisponible, la publication échoue silencieusement (log)
// SANS jamais interrompre le flux métier appelant.

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { SIGEA_EXCHANGE } from './event-routing';

@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private readonly url = process.env.RABBITMQ_URL ?? 'amqp://sigea:sigea@localhost:5672';

  // Types volontairement souples : selon la version d'amqplib (>=0.10),
  // connect() peut renvoyer un ChannelModel ; on conserve les API communes.
  private connection?: amqp.Connection;
  private channel?: amqp.Channel;
  private connecting = false;
  private closed = false;

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      /* fermeture best-effort */
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
      this.logger.log(`Publisher connecté à RabbitMQ (exchange "${SIGEA_EXCHANGE}")`);
    } catch (e) {
      this.logger.warn(
        `RabbitMQ indisponible (${(e as Error).message}) — publication désactivée, reconnexion programmée`,
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

  /**
   * Publie un évènement. Ne lève jamais : en cas d'échec, l'action métier
   * appelante reste valide (notification simplement non émise).
   */
  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    try {
      if (!this.channel) {
        this.logger.warn(`Évènement "${routingKey}" non publié (canal indisponible)`);
        return;
      }
      const body = Buffer.from(JSON.stringify(payload));
      const ok = this.channel.publish(SIGEA_EXCHANGE, routingKey, body, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
      });
      if (!ok) this.logger.warn(`Backpressure lors de la publication de "${routingKey}"`);
    } catch (e) {
      this.logger.error(`Échec de publication "${routingKey}" : ${(e as Error).message}`);
    }
  }
}
