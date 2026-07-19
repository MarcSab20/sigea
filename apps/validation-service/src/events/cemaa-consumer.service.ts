// apps/validation-service/src/events/cemaa-consumer.service.ts
//
// Écoute les consignes CEMAA et les applique aux manifestes du vol concerné :
// pose le flag `consignes_cemaa_appliquees` (→ bandeau PDF) et franchit le
// verrou CEMAA_SENSIBLE du circuit pour les manifestes sensibles.
//
// File dédiée (distincte de celle des notifications) : chaque consumer a sa
// propre queue liée à l'exchange, pour ne pas se voler les messages.

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { CEMAA_EVENTS } from '@sigea/shared-events';
import { SIGEA_EXCHANGE } from '@sigea/shared-messaging';
import { ValidationStateMachine } from '../state-machine/validation-state-machine';

const CEMAA_QUEUE = 'sigea.validation.cemaa';

interface ConsigneEvent {
  consigne_id?: string;
  vol_id?: string;
  manifestes?: Array<{ id: string; base_id: string }>;
}

@Injectable()
export class CemaaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CemaaConsumer.name);
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
      await channel.assertQueue(CEMAA_QUEUE, { durable: true });
      // On ne lie que les routing keys CEMAA : ce consumer ne voit pas le reste.
      await channel.bindQueue(CEMAA_QUEUE, SIGEA_EXCHANGE, CEMAA_EVENTS.CONSIGNE_CREATED);
      await channel.bindQueue(CEMAA_QUEUE, SIGEA_EXCHANGE, CEMAA_EVENTS.CONSIGNE_UPDATED);
      await channel.prefetch(10);

      await channel.consume(CEMAA_QUEUE, (msg) => {
        if (!msg) return;
        void this.handle(JSON.parse(msg.content.toString()))
          .then(() => this.channel?.ack(msg))
          .catch((e) => {
            this.logger.error(`Consigne non appliquée (nack) : ${(e as Error).message}`);
            // requeue=false : un message empoisonné part en dead-letter plutôt
            // que de boucler. Une consigne ratée est tracée, pas rejouée à l'infini.
            this.channel?.nack(msg, false, false);
          });
      });

      this.logger.log('Consumer CEMAA connecté (queue sigea.validation.cemaa)');
    } catch (e) {
      this.logger.error(`Connexion RabbitMQ échouée : ${(e as Error).message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    setTimeout(() => void this.connect(), 5000);
  }

  private async handle(payload: ConsigneEvent): Promise<void> {
    const manifestes = payload.manifestes ?? [];
    if (!manifestes.length) {
      this.logger.debug(`Consigne ${payload.consigne_id} sans manifeste rattaché`);
      return;
    }
    // Séquentiel volontaire : chaque application ouvre une transaction courte,
    // et le volume par vol est faible (quelques manifestes). On privilégie la
    // lisibilité des logs et l'ordre à un parallélisme inutile ici.
    for (const m of manifestes) {
      await this.stateMachine.appliquerConsigneCemaa(m.id);
    }
  }
}