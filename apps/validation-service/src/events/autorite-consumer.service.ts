// apps/validation-service/src/events/autorite-consumer.service.ts
//
// Remplace `cemaa-consumer.service.ts`.
//
// Écoute les consignes des DEUX autorités centrales et les applique aux
// manifestes du vol concerné : pose le drapeau `consignes_<autorite>_appliquees`
// (→ bandeau PDF) et franchit le verrou correspondant du circuit pour les
// manifestes sensibles.

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { AutoriteCentrale } from '@sigea/shared-types';
import { TOUTES_CLES_CONSIGNE } from '@sigea/shared-events';
import { SIGEA_EXCHANGE } from '@sigea/shared-messaging';
import { ValidationStateMachine } from '../state-machine/validation-state-machine';

/**
 * Nom de queue CHANGÉ (`…cemaa` → `…autorites`).
 *
 * Volontaire, et c'est le piège principal de ce lot. Une queue RabbitMQ
 * conserve ses bindings d'origine : `assertQueue` sur un nom existant n'en
 * ajoute AUCUN. Réutiliser `sigea.validation.cemaa` ferait donc silencieusement
 * disparaître toutes les consignes MAGE — sans erreur, sans log, sans rien.
 *
 * Au déploiement : vérifier que `sigea.validation.cemaa` est vide, puis la
 * supprimer une fois le nouveau consumer en service. Si elle ne l'est pas,
 * les consignes en attente seront perdues.
 */
const QUEUE_AUTORITES = 'sigea.validation.autorites';

interface ConsigneEventRecu {
  consigne_id?: string;
  autorite?: AutoriteCentrale;
  vol_id?: string;
  manifestes?: Array<{ id: string; base_id: string }>;
}

@Injectable()
export class AutoriteConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutoriteConsumer.name);
  private readonly url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';

  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;
  private closed = false;

  constructor(private readonly stateMachine: ValidationStateMachine) {}

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
      await channel.assertQueue(QUEUE_AUTORITES, { durable: true });

      // Bindings dérivés de TOUTES_CLES_CONSIGNE : déclarer une autorité dans
      // shared-events suffit à la faire écouter ici. Aucune liste à tenir à
      // jour en double — c'est précisément ce qui manquait dans la version
      // précédente, où les deux clés étaient liées à la main.
      for (const cle of TOUTES_CLES_CONSIGNE) {
        await channel.bindQueue(QUEUE_AUTORITES, SIGEA_EXCHANGE, cle);
      }
      await channel.prefetch(10);

      await channel.consume(QUEUE_AUTORITES, (msg) => {
        if (!msg) return;
        void this.handle(JSON.parse(msg.content.toString()) as ConsigneEventRecu)
          .then(() => this.channel?.ack(msg))
          .catch((e) => {
            this.logger.error(`Consigne non appliquée (nack) : ${(e as Error).message}`);
            // requeue=false : un message empoisonné part en dead-letter plutôt
            // que de boucler. Une consigne ratée est tracée, pas rejouée à l'infini.
            this.channel?.nack(msg, false, false);
          });
      });

      this.logger.log(
        `Consumer autorités connecté (queue ${QUEUE_AUTORITES}, ` +
        `${TOUTES_CLES_CONSIGNE.length} clés liées)`,
      );
    } catch (e) {
      this.logger.error(`Connexion RabbitMQ échouée : ${(e as Error).message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    setTimeout(() => void this.connect(), 5000);
  }

  private async handle(payload: ConsigneEventRecu): Promise<void> {
    // Repli sur CEMAA si le champ manque : messages émis par l'ancienne version
    // du service et encore en file au moment du déploiement. Sans ce repli, ils
    // partiraient tous en dead-letter au redémarrage.
    const autorite = payload.autorite ?? AutoriteCentrale.CEMAA;

    const manifestes = payload.manifestes ?? [];
    if (!manifestes.length) {
      this.logger.debug(`Consigne ${payload.consigne_id} sans manifeste rattaché`);
      return;
    }

    // Séquentiel volontaire : chaque application ouvre une transaction courte,
    // et le volume par vol est faible. On privilégie la lisibilité des logs et
    // l'ordre à un parallélisme inutile ici.
    for (const m of manifestes) {
      await this.stateMachine.appliquerConsigneAutorite(m.id, autorite);
    }
  }
}