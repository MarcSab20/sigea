// apps/pdf-service/src/archives/archive-consumer.service.ts
//
// Déclenche l'archivage à la clôture du circuit.
//
// ── Pourquoi un consumer d'évènement, et non un appel direct ──
// La state machine publie MANIFESTE_COMPLETED. Elle pourrait appeler le
// pdf-service en HTTP, mais l'archivage ne doit JAMAIS faire échouer une
// signature : si Chromium est indisponible, le COMBORD doit pouvoir signer
// quand même, et l'archive être produite plus tard. Le découplage par file
// donne exactement cette propriété — et le nack en dead-letter conserve la
// trace des archivages ratés au lieu de les perdre.

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { EVENTS } from '@sigea/shared-events';
import { SIGEA_EXCHANGE } from '@sigea/shared-messaging';
import { ArchiveService } from './archive.service';

const QUEUE_ARCHIVES = 'sigea.pdf.archives';

interface CompletedEvent {
  manifeste_id?: string;
  vol_id?: string;
  base_id?: string;
}

@Injectable()
export class ArchiveConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArchiveConsumer.name);
  private readonly url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';

  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;
  private closed = false;

  constructor(private readonly archives: ArchiveService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // fermeture best-effort
    }
  }

  private async connect(): Promise<void> {
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
      await channel.assertQueue(QUEUE_ARCHIVES, { durable: true });
      await channel.bindQueue(QUEUE_ARCHIVES, SIGEA_EXCHANGE, EVENTS.MANIFESTE_COMPLETED);

      // prefetch=2 et non 10 : chaque archivage lance un rendu Chromium, gourmand
      // en mémoire. Dix rendus concurrents satureraient le conteneur. La file
      // absorbe les pointes, c'est son rôle.
      await channel.prefetch(2);

      await channel.consume(QUEUE_ARCHIVES, (msg) => {
        if (!msg) return;
        const payload = JSON.parse(msg.content.toString()) as CompletedEvent;
        if (!payload.manifeste_id) {
          this.logger.warn('Évènement de clôture sans manifeste_id — ignoré');
          this.channel?.ack(msg);
          return;
        }
        void this.archives
          .archiver(payload.manifeste_id)
          .then(() => this.channel?.ack(msg))
          .catch((e) => {
            this.logger.error(
              `Archivage échoué pour ${payload.manifeste_id} : ${(e as Error).message}`,
            );
            // requeue=false : un message empoisonné part en dead-letter plutôt
            // que de boucler. L'archive manquante reste rattrapable — voir la
            // commande de rattrapage dans le README du lot.
            this.channel?.nack(msg, false, false);
          });
      });

      this.logger.log(`Consumer d'archivage connecté (queue ${QUEUE_ARCHIVES})`);
    } catch (e) {
      this.logger.error(`Connexion RabbitMQ échouée : ${(e as Error).message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    setTimeout(() => void this.connect(), 5000);
  }
}