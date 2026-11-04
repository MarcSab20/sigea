// apps/notification-service/src/events/events-consumer.service.ts
//
// Consomme l'exchange « sigea.events » et traduit chaque évènement métier en
// notification persistée puis diffusée.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI CHANGE DANS CETTE VERSION
// ═══════════════════════════════════════════════════════════════════════════
//
// 1. À LA DIFFUSION, ON COMPTE LES CANDIDATS DU VIVIER.
//    « Un vol est diffusé » n'est pas actionnable ; « vous avez douze
//    demandeurs qui attendaient ce jour-là » l'est. Sans ce décompte, le
//    secrétaire doit ouvrir l'écran pour savoir s'il a quelque chose à faire,
//    et finit par ne plus ouvrir les notifications du tout.
//
// 2. LES MAILLONS DÉJÀ PASSÉS SONT INFORMÉS DES DÉCISIONS AVAL.
//    La directive veut qu'ils suivent la suite « à titre informatif, sans
//    pouvoir réagir ». Une notification sans destinataire nommé, sur la room
//    RMIA, et dont le titre dit explicitement qu'aucune action n'est attendue.

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { VOL_EVENTS, LISTE_EVENTS, CEMAA_EVENTS, ALERT_EVENTS } from '@sigea/shared-events';
import { SIGEA_EXCHANGE, NOTIFICATION_QUEUE } from '@sigea/shared-messaging';
import {
  TypeNotification, Rmia, EtapeListe,
  LIBELLE_ETAPE_LISTE, rangEtapeListe,
} from '@sigea/shared-types';
import { PrismaService } from '@sigea/shared-database';
import { NotificationGateway } from '../gateway/notification.gateway';
import { NotificationService } from '../notifications/notification.service';

interface EvenementSigea {
  vol_id?:         string;
  numero_mission?: string;
  liste_id?:       string;
  manifeste_id?:   string;
  base_id?:        string;
  rmia?:           Rmia;
  etape?:          EtapeListe;
  etape_suivante?: EtapeListe | null;
  etape_retour?:   EtapeListe;
  motif?:          string;
  nb_passagers?:   number;
  combord_id?:     string;
  rmia_destinataires?: Rmia[];
  listes?: { liste_id: string; base_id: string; rmia: Rmia; ordre: number }[];
  consigne_id?: string;
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
      // Fermeture best-effort : un conteneur qui s'arrête n'a pas à échouer
      // parce qu'une socket était déjà tombée.
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
        // ACK APRÈS persistance et diffusion réussies. En cas d'erreur, nack
        // sans requeue : le message part en dead-letter plutôt que de boucler.
        void this.handle(msg.fields.routingKey, JSON.parse(msg.content.toString()))
          .then(() => this.channel?.ack(msg))
          .catch((e) => {
            this.logger.error(`Traitement échoué (nack) : ${(e as Error).message}`);
            this.channel?.nack(msg, false, false);
          });
      });

      this.logger.log(
        `Consommateur prêt (queue « ${NOTIFICATION_QUEUE} », exchange « ${SIGEA_EXCHANGE} »)`,
      );
    } catch (e) {
      this.logger.warn(
        `RabbitMQ indisponible (${(e as Error).message}) — reconnexion dans 5 s`,
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

  private async handle(routingKey: string, p: EvenementSigea): Promise<void> {
    switch (routingKey) {
      // ── Planification : le SCOPS doit allouer ──
      //
      // Adressée nominativement aux comptes SCOPS, et non diffusée à une base :
      // un vol non diffusé ne doit être connu que de son créateur et du
      // sous-chef opérations. Diffuser à la base de départ révélerait un
      // mouvement que le commandement n'a pas encore arrêté.
      case VOL_EVENTS.VOL_PLANIFIE: {
        if (!p.vol_id) break;
        const scops = await this.prisma.utilisateur.findMany({
          where: { role: 'scops', actif: true },
          select: { id: true, base_id: true },
        });
        await this.notifications.emettrePlusieurs(
          scops.map((s) => ({
            base_id: s.base_id,
            destinataire_id: s.id,
            type: TypeNotification.VOL_DIFFUSE,
            titre: 'Vol à diffuser',
            message:
              `Le vol ${p.numero_mission ?? ''} attend l'allocation des quotas ` +
              `de places et de masse.`,
            vol_id: p.vol_id,
          })),
        );
        break;
      }

      // ── Diffusion : chaque RMIA touchée reçoit sa liste à constituer ──
      case VOL_EVENTS.VOL_DIFFUSE: {
        if (!p.listes?.length) break;

        // La date du vol est lue UNE FOIS, hors de la boucle : elle est la même
        // pour toutes les escales, et l'interroger par liste multiplierait les
        // requêtes sans rien changer au résultat.
        const vol = p.vol_id
          ? await this.prisma.vol.findUnique({
              where: { id: p.vol_id },
              select: { date_heure: true },
            })
          : null;

        const bornes = vol ? this.journeeDe(vol.date_heure) : null;

        for (const l of p.listes) {
          // Nombre de candidats du vivier ayant demandé CE jour, dans CETTE
          // région. C'est l'information qui transforme une notification
          // d'évènement en consigne de travail.
          const candidats = bornes
            ? await this.prisma.potentialite.count({
                where: {
                  rmia: l.rmia,
                  statut: 'DISPONIBLE',
                  date_vol_souhaitee: { gte: bornes.debut, lte: bornes.fin },
                },
              })
            : 0;

          await this.notifications.emettre({
            base_id: l.base_id,
            rmia:    l.rmia,
            type:    TypeNotification.LISTE_A_TRAITER,
            titre:   'Liste à constituer',
            message:
              `Vol ${p.numero_mission ?? ''} — quotas alloués pour l'escale ${l.ordre}` +
              (candidats
                ? `. ${candidats} demandeur(s) de votre vivier attendaient ce jour.`
                : `. Aucun demandeur du vivier n'avait demandé cette date.`),
            vol_id:   p.vol_id,
            liste_id: l.liste_id,
            etape:    EtapeListe.SEC_ADJ_AIR,
          });
        }
        break;
      }

      case VOL_EVENTS.VOL_ANNULE: {
        if (!p.vol_id) break;
        // Annulation : on remonte aux listes pour savoir QUI prévenir. Diffuser
        // à l'aveugle laisserait des régions travailler sur un vol mort.
        const listes = await this.prisma.listeEmbarquement.findMany({
          where: { vol_id: p.vol_id },
          select: { id: true, rmia: true, etape: { select: { base_id: true } } },
        });
        await this.notifications.emettrePlusieurs(
          listes.map((l) => ({
            base_id: l.etape.base_id,
            rmia:    l.rmia as Rmia,
            type:    TypeNotification.ALERTE,
            titre:   'Vol annulé',
            message: `Le vol ${p.numero_mission ?? ''} est annulé.` +
              (p.motif ? ` Motif : ${p.motif}` : ''),
            vol_id:   p.vol_id,
            liste_id: l.id,
          })),
        );
        break;
      }

      // ── Visa apposé : prévenir l'étape suivante, informer les précédentes ──
      case LISTE_EVENTS.LISTE_VISEE: {
        if (!p.liste_id || !p.etape) break;

        const liste = await this.chargerListe(p.liste_id);
        if (!liste) break;

        const suivante = p.etape_suivante;

        if (suivante) {
          // Les étapes COMBASE et COMBORD sortent du périmètre RMIA : la
          // première s'adresse à la base de décollage, la seconde à une
          // personne nommée. Les diffuser à la région serait au mieux du bruit,
          // au pire une fuite vers des officiers non concernés.
          const versBase = suivante === EtapeListe.COMBASE || suivante === EtapeListe.COMBORD;

          await this.notifications.emettre({
            base_id: liste.base_id,
            rmia:    versBase ? null : (liste.rmia as Rmia),
            destinataire_id:
              suivante === EtapeListe.COMBORD ? liste.combord_id ?? null : null,
            type:  TypeNotification.LISTE_A_TRAITER,
            titre: `À viser — ${LIBELLE_ETAPE_LISTE[suivante]}`,
            message:
              `Vol ${liste.numero_mission}, escale ${liste.ordre} : la liste a été visée par ` +
              `${LIBELLE_ETAPE_LISTE[p.etape]}. Elle attend votre discrimination.`,
            vol_id:   liste.vol_id,
            liste_id: p.liste_id,
            etape:    suivante,
          });
        }

        // ── Information des maillons déjà passés ──
        //
        // Sans destinataire nommé et sur la room RMIA : ils ne peuvent plus
        // agir, mais doivent savoir ce qu'est devenue la liste qu'ils ont
        // visée. Le titre dit la décision, le message dit qu'aucune action
        // n'est attendue — sans quoi la notification serait lue comme une
        // convocation.
        //
        // La condition écarte la première étape : quand le secrétaire vise, il
        // n'y a personne en amont à informer.
        if (rangEtapeListe(p.etape) > 1) {
          await this.notifications.emettre({
            base_id: liste.base_id,
            rmia:    liste.rmia as Rmia,
            type:    TypeNotification.LISTE_VISEE,
            titre:   `Liste visée par ${LIBELLE_ETAPE_LISTE[p.etape]}`,
            message:
              `Vol ${liste.numero_mission}, escale ${liste.ordre} : décision prise ` +
              `à l'étape ${LIBELLE_ETAPE_LISTE[p.etape]}. Information, sans action attendue.`,
            vol_id:   liste.vol_id,
            liste_id: p.liste_id,
          });
        }
        break;
      }

      // ── Renvoi : prévenir celui qui doit corriger ──
      case LISTE_EVENTS.LISTE_REJETEE: {
        if (!p.liste_id || !p.etape_retour) break;
        const liste = await this.chargerListe(p.liste_id);
        if (!liste) break;

        await this.notifications.emettre({
          base_id: liste.base_id,
          rmia:    liste.rmia as Rmia,
          type:    TypeNotification.LISTE_REJETEE,
          titre:   'Liste renvoyée',
          message:
            `Vol ${liste.numero_mission}, escale ${liste.ordre} : renvoyée par ` +
            `${p.etape ? LIBELLE_ETAPE_LISTE[p.etape] : 'une autorité'}. ` +
            `Motif : ${p.motif ?? 'non précisé'}`,
          vol_id:   liste.vol_id,
          liste_id: p.liste_id,
          etape:    p.etape_retour,
        });
        break;
      }

      // ── Arrêté : manifeste émis, messages partis ──
      case LISTE_EVENTS.LISTE_ARRETEE: {
        if (!p.liste_id) break;
        const liste = await this.chargerListe(p.liste_id);
        if (!liste) break;

        await this.notifications.emettre({
          base_id: liste.base_id,
          rmia:    liste.rmia as Rmia,
          type:    TypeNotification.LISTE_ARRETEE,
          titre:   'Liste arrêtée — manifeste émis',
          message:
            `Vol ${liste.numero_mission}, escale ${liste.ordre} : ${p.nb_passagers ?? 0} ` +
            `passager(s) portés au manifeste. Les voyageurs retenus sont en cours ` +
            `d'information par message.`,
          vol_id:       liste.vol_id,
          liste_id:     p.liste_id,
          manifeste_id: p.manifeste_id,
        });

        // Le commandant de bord est prévenu nominativement : c'est lui, et
        // personne d'autre, qui doit maintenant agir.
        if (liste.combord_id) {
          await this.notifications.emettre({
            base_id: liste.base_id,
            destinataire_id: liste.combord_id,
            type:  TypeNotification.LISTE_A_TRAITER,
            titre: 'Manifeste à viser',
            message:
              `Vol ${liste.numero_mission}, escale ${liste.ordre} : le manifeste attend ` +
              `votre discrimination et votre visa.`,
            vol_id:       liste.vol_id,
            liste_id:     p.liste_id,
            manifeste_id: p.manifeste_id,
            etape:        EtapeListe.COMBORD,
          });
        }
        break;
      }

      // ── Clôture : document définitif ──
      case LISTE_EVENTS.LISTE_CLOTUREE: {
        if (!p.liste_id) break;
        const liste = await this.chargerListe(p.liste_id);
        if (!liste) break;

        await this.notifications.emettre({
          base_id: liste.base_id,
          rmia:    liste.rmia as Rmia,
          type:    TypeNotification.MANIFESTE_DEFINITIF,
          titre:   'Manifeste définitif',
          message:
            `Vol ${liste.numero_mission}, escale ${liste.ordre} : visa du commandant ` +
            `de bord apposé. Le manifeste est opposable et archivé.`,
          vol_id:       liste.vol_id,
          liste_id:     p.liste_id,
          manifeste_id: p.manifeste_id,
        });
        break;
      }

      // ── Consignes d'autorité centrale ──
      case CEMAA_EVENTS.CONSIGNE_CREATED:
      case CEMAA_EVENTS.CONSIGNE_UPDATED: {
        if (!p.vol_id) break;
        const listes = await this.prisma.listeEmbarquement.findMany({
          where: { vol_id: p.vol_id },
          select: { id: true, rmia: true, etape: { select: { base_id: true } } },
        });
        await this.notifications.emettrePlusieurs(
          listes.map((l) => ({
            base_id: l.etape.base_id,
            rmia:    l.rmia as Rmia,
            type:    TypeNotification.CONSIGNE_AUTORITE,
            titre:   "Consigne d'autorité centrale",
            message:
              `Une consigne a été émise sur ce vol. Le visa du commandant de bord ` +
              `restera bloqué tant que son exécution n'aura pas été confirmée.`,
            vol_id:   p.vol_id,
            liste_id: l.id,
          })),
        );
        break;
      }

      // ── Alertes transverses ──
      //
      // Diffusées à TOUS les clients connectés, sans persistance : une
      // marchandise dangereuse ou une évacuation sanitaire concerne quiconque
      // se trouve sur le trajet. Les persister par base produirait des
      // centaines de lignes pour un évènement unique.
      case ALERT_EVENTS.EVASAN:
      case ALERT_EVENTS.VIP:
      case ALERT_EVENTS.DANGEROUS_GOODS: {
        this.gateway.broadcastToAll('alerte', { type: routingKey, ...p });
        break;
      }

      default:
        // Évènement non traité : silence volontaire. La file est liée à « # »,
        // donc tout passe ici ; journaliser chaque message inconnu noierait les
        // journaux sous le trafic normal.
        break;
    }
  }

  /**
   * Bornes de la journée d'un vol, dans le fuseau du serveur.
   *
   * On construit DEUX dates à partir de l'originale au lieu de muter la même :
   * `setHours` modifie l'objet en place, et réutiliser la même instance pour le
   * début puis la fin donnerait deux fois la fin. C'est une erreur classique,
   * silencieuse, et qui ferait ici remonter zéro candidat.
   */
  private journeeDe(date: Date): { debut: Date; fin: Date } {
    const debut = new Date(date);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(date);
    fin.setHours(23, 59, 59, 999);
    return { debut, fin };
  }

  /** Contexte minimal d'une liste, pour composer un message lisible. */
  private async chargerListe(liste_id: string): Promise<{
    vol_id: string; numero_mission: string; ordre: number;
    base_id: string; rmia: string; combord_id: string | null;
  } | null> {
    const l = await this.prisma.listeEmbarquement.findUnique({
      where: { id: liste_id },
      select: {
        vol_id: true, rmia: true,
        etape: { select: { ordre: true, base_id: true } },
        vol:   { select: { numero_mission: true, combord_id: true } },
      },
    });
    if (!l) return null;
    return {
      vol_id: l.vol_id,
      numero_mission: l.vol.numero_mission,
      ordre: l.etape.ordre,
      base_id: l.etape.base_id,
      rmia: String(l.rmia),
      combord_id: l.vol.combord_id,
    };
  }
}