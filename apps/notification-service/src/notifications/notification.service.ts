// apps/notification-service/src/notifications/notification.service.ts
//
// Persiste une notification PUIS la diffuse en WebSocket. L'ordre importe : on
// écrit d'abord en base (source de vérité, rattrapable à la reconnexion), puis
// on émet. Si l'émission échoue, la notification reste récupérable ; si la
// persistance échoue, on n'émet pas une notification fantôme non rattrapable.
//
// ── Ce qui change : la base devient facultative ──
// La chaîne RMIA n'est plus rattachée à une base. Une notification qui lui est
// adressée n'a donc pas de `base_id`, et le champ passe à `string | null`
// partout — y compris dans la clause de lecture, où `base_id: null` ne doit
// surtout pas être confondu avec « toutes les bases ».

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { TypeNotification, Rmia } from '@sigea/shared-types';
import { NotificationGateway } from '../gateway/notification.gateway';

export interface CreerNotification {
  /**
   * Base porteuse. NULLE pour une notification adressée à une RMIA : ses
   * destinataires n'ont pas de base.
   */
  base_id: string | null;
  /**
   * RMIA destinataire. Renseignée → diffusion à toute la chaîne régionale.
   * C'est le cas des listes à traiter : elles concernent une région.
   */
  rmia?: Rmia | null;
  /** NULL = toute la base, ou toute la RMIA si `rmia` est renseignée. */
  destinataire_id?: string | null;
  type:    TypeNotification;
  titre:   string;
  message: string;
  manifeste_id?: string;
  vol_id?:       string;
  liste_id?:     string;
  etape?:        string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationGateway,
  ) {}

  /**
   * Crée et diffuse une notification.
   *
   * Priorité de diffusion, du plus précis au plus large :
   *   1. destinataire_id → room user ;
   *   2. rmia            → room rmia ;
   *   3. base_id         → room base.
   *
   * L'ordre n'est pas arbitraire : une notification nominative adressée AUSSI à
   * toute la région serait lue par des dizaines de personnes qu'elle ne
   * concerne pas, et l'on cesserait vite de les lire — c'est ainsi que meurt un
   * système de notification.
   *
   * Sans aucun des trois, la notification est persistée mais n'est diffusée à
   * personne. C'est une erreur d'appel, et elle est journalisée comme telle :
   * sans ce signalement, elle resterait invisible jusqu'à ce que quelqu'un
   * s'étonne de n'avoir rien reçu.
   */
  async emettre(n: CreerNotification): Promise<void> {
    let persistee;
    try {
      persistee = await this.prisma.notification.create({
        data: {
          base_id:         n.base_id ?? null,
          rmia:            n.rmia ?? null,
          destinataire_id: n.destinataire_id ?? null,
          type:            n.type,
          titre:           n.titre,
          message:         n.message,
          manifeste_id:    n.manifeste_id ?? null,
          vol_id:          n.vol_id ?? null,
          liste_id:        n.liste_id ?? null,
          etape:           n.etape ?? null,
        },
      });
    } catch (e) {
      // Un destinataire_id inconnu (violation de clé étrangère) ne doit pas
      // tuer le consumer : on journalise et on abandonne CETTE notification,
      // pas le flux.
      this.logger.error(`Persistance notification échouée : ${(e as Error).message}`);
      return;
    }

    const payload = {
      id:           persistee.id,
      type:         persistee.type,
      titre:        persistee.titre,
      message:      persistee.message,
      manifeste_id: persistee.manifeste_id,
      vol_id:       persistee.vol_id,
      liste_id:     persistee.liste_id,
      etape:        persistee.etape,
      createdAt:    persistee.createdAt,
    };

    if (n.destinataire_id) {
      this.gateway.broadcastToUser(n.destinataire_id, 'notification', payload);
    } else if (n.rmia) {
      this.gateway.broadcastToRmia(String(n.rmia), 'notification', payload);
    } else if (n.base_id) {
      this.gateway.broadcastToBase(n.base_id, 'notification', payload);
    } else {
      this.logger.warn(
        `Notification ${persistee.id} sans destinataire, sans RMIA et sans base : ` +
          'persistée mais diffusée à personne.',
      );
    }
  }

  async emettrePlusieurs(list: CreerNotification[]): Promise<void> {
    for (const n of list) await this.emettre(n);
  }

  /**
   * Notifications non lues d'un utilisateur.
   *
   * Trois sources réunies : les siennes, celles de sa base, celles de sa RMIA.
   * La RMIA et la base sont relues EN BASE plutôt que prises dans le jeton :
   * cette méthode est appelée à la reconnexion, et un jeton de quinze minutes
   * peut refléter une affectation déjà changée.
   */
  async nonLues(user_id: string, base_id: string | null): Promise<unknown[]> {
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: user_id },
      select: { rmia: true, base_id: true },
    });
    const base = u?.base_id ?? base_id;

    return this.prisma.notification.findMany({
      where: {
        lu: false,
        OR: [
          { destinataire_id: user_id },
          // `base` peut être nul pour la chaîne RMIA. La clause n'est donc
          // ajoutée que s'il y a une base : sans cette précaution,
          // `base_id: null` remonterait toutes les notifications régionales,
          // toutes régions confondues.
          ...(base ? [{ destinataire_id: null, rmia: null, base_id: base }] : []),
          ...(u?.rmia ? [{ destinataire_id: null, rmia: u.rmia }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async marquerLu(id: string, user_id: string, base_id: string | null): Promise<void> {
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: user_id }, select: { rmia: true, base_id: true },
    });
    const base = u?.base_id ?? base_id;

    // updateMany et non update : la clause de périmètre fait partie du filtre.
    // Un `update` par identifiant seul permettrait de marquer lue la
    // notification d'un autre.
    await this.prisma.notification.updateMany({
      where: {
        id,
        OR: [
          { destinataire_id: user_id },
          ...(base ? [{ destinataire_id: null, base_id: base }] : []),
          ...(u?.rmia ? [{ destinataire_id: null, rmia: u.rmia }] : []),
        ],
      },
      data: { lu: true, lu_le: new Date() },
    });
  }

  async marquerToutLu(user_id: string, base_id: string | null): Promise<void> {
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: user_id }, select: { rmia: true, base_id: true },
    });
    const base = u?.base_id ?? base_id;

    await this.prisma.notification.updateMany({
      where: {
        lu: false,
        OR: [
          { destinataire_id: user_id },
          ...(base ? [{ destinataire_id: null, rmia: null, base_id: base }] : []),
          ...(u?.rmia ? [{ destinataire_id: null, rmia: u.rmia }] : []),
        ],
      },
      data: { lu: true, lu_le: new Date() },
    });
  }
}