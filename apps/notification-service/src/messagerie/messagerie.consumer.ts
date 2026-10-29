// apps/notification-service/src/messagerie/messagerie.consumer.ts
//
// Déclenche une vidange immédiate à l'arrêté d'une liste.
//
// ── Pourquoi un consumer, alors qu'une boucle périodique tourne déjà ──
// La boucle garantit que rien ne reste coincé ; elle ne garantit pas la
// réactivité. Un commandant de base qui arrête sa liste à 05 h 40 pour un vol
// à 08 h 00 ne peut pas attendre une minute de plus que nécessaire : chaque
// minute perdue est prise sur le temps de route des voyageurs.
//
// File DÉDIÉE (MESSAGERIE_QUEUE) et non partagée avec les notifications :
// l'envoi passe par un tiers facturé et parfois indisponible. Mêler ces
// messages aux notifications internes ferait prendre à celles-ci le retard d'un
// opérateur téléphonique.

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { LISTE_EVENTS } from '@sigea/shared-events';
import { SIGEA_EXCHANGE, MESSAGERIE_QUEUE } from '@sigea/shared-messaging';
import { MessagerieService } from './messagerie.service';

interface ArreteeEvent {
  liste_id?:     string;
  vol_id?:       string;
  nb_passagers?: number;
}

@Injectable()
export class MessagerieConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagerieConsumer.name);
  private readonly url = process.env.RABBITMQ_URL ?? 'amqp://sigea:sigea@localhost:5672';

  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;
  private closed = false;

  constructor(private readonly messagerie: MessagerieService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // Fermeture best-effort.
    }
  }

  private async connect(): Promise<void> {
    if (this.closed) return;
    try {
      const connection = await amqp.connect(this.url);
      this.connection = connection;

      connection.on('error', (e: Error) =>
        this.logger.error(`Connexion RabbitMQ en erreur : ${e.message}`),
      );
      connection.on('close', () => {
        this.channel = undefined;
        this.connection = undefined;
        if (!this.closed) setTimeout(() => void this.connect(), 5000);
      });

      const channel = await connection.createChannel();
      this.channel = channel;

      await channel.assertExchange(SIGEA_EXCHANGE, 'topic', { durable: true });
      await channel.assertQueue(MESSAGERIE_QUEUE, { durable: true });
      await channel.bindQueue(MESSAGERIE_QUEUE, SIGEA_EXCHANGE, LISTE_EVENTS.LISTE_ARRETEE);
      await channel.prefetch(1);

      await channel.consume(MESSAGERIE_QUEUE, (msg) => {
        if (!msg) return;

        let payload: ArreteeEvent;
        try {
          payload = JSON.parse(msg.content.toString()) as ArreteeEvent;
        } catch {
          this.logger.error('Évènement d\'arrêté illisible — mis en dead-letter');
          this.channel?.nack(msg, false, false);
          return;
        }

        // ACK IMMÉDIAT, avant la vidange. C'est délibéré : les messages sont
        // déjà persistés en base par la transaction d'arrêté, et la boucle
        // périodique les reprendra de toute façon. Rejouer l'évènement
        // n'apporterait rien et risquerait des envois en double.
        this.channel?.ack(msg);

        if (!payload.liste_id) {
          this.logger.warn('Évènement d\'arrêté sans liste_id — vidange globale');
          void this.messagerie.vidanger();
          return;
        }

        this.logger.log(
          `Arrêté reçu pour la liste ${payload.liste_id} ` +
            `(${payload.nb_passagers ?? '?'} passager(s)) — vidange immédiate`,
        );
        void this.messagerie.vidanger(payload.liste_id).catch((e) =>
          this.logger.error(`Vidange immédiate échouée : ${(e as Error).message}`),
        );
      });

      this.logger.log(`Consumer messagerie connecté (queue ${MESSAGERIE_QUEUE})`);
    } catch (e) {
      this.logger.warn(
        `RabbitMQ indisponible (${(e as Error).message}) — reconnexion dans 5 s`,
      );
      setTimeout(() => void this.connect(), 5000);
    }
  }
}