// apps/pdf-service/src/archives/archive-consumer.service.ts
//
// Déclenche l'archivage à la clôture du circuit.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI CHANGE
// ═══════════════════════════════════════════════════════════════════════════
// L'évènement écouté n'est plus `manifeste.completed` mais `liste.cloturee` :
// la clôture est prononcée par le visa du commandant de bord sur la liste, et
// c'est elle qui rend le manifeste définitif. Le `manifeste_id` est toujours
// porté par la charge utile — c'est lui qui est archivé.
//
// ── Pourquoi un consumer d'évènement, et non un appel direct ──
// L'archivage ne doit JAMAIS faire échouer une signature. Si Chromium est
// indisponible, le commandant de bord doit pouvoir viser quand même, et
// l'archive être produite plus tard. Le découplage par file donne exactement
// cette propriété — et le nack en dead-letter conserve la trace des archivages
// ratés au lieu de les perdre.

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { LISTE_EVENTS } from '@sigea/shared-events';
import { SIGEA_EXCHANGE } from '@sigea/shared-messaging';
import { ArchiveService } from './archive.service';

const QUEUE_ARCHIVES = 'sigea.pdf.archives';

interface ClotureEvent {
  liste_id?:     string;
  manifeste_id?: string;
  vol_id?:       string;
  base_id?:      string;
  combord_id?:   string;
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
      // Fermeture best-effort : un conteneur qui s'arrête n'a pas à échouer
      // parce qu'une socket était déjà tombée.
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
      await channel.bindQueue(QUEUE_ARCHIVES, SIGEA_EXCHANGE, LISTE_EVENTS.LISTE_CLOTUREE);

      // prefetch=2 et non 10 : chaque archivage lance un rendu Chromium,
      // gourmand en mémoire. Dix rendus concurrents satureraient le conteneur.
      // La file absorbe les pointes, c'est son rôle.
      await channel.prefetch(2);

      await channel.consume(QUEUE_ARCHIVES, (msg) => {
        if (!msg) return;

        let payload: ClotureEvent;
        try {
          payload = JSON.parse(msg.content.toString()) as ClotureEvent;
        } catch {
          // Message illisible : il ne le deviendra pas en le rejouant.
          this.logger.error('Message de clôture illisible — mis en dead-letter');
          this.channel?.nack(msg, false, false);
          return;
        }

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
            // que de boucler. L'archive manquante reste rattrapable par
            // l'endpoint de régénération exposé par ArchiveController.
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