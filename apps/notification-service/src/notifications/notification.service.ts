// apps/notification-service/src/notifications/notification.service.ts
//
// Persiste une notification PUIS la diffuse en WebSocket. L'ordre importe :
// on écrit d'abord en base (source de vérité, rattrapable à la reconnexion),
// puis on émet. Si l'émission WS échoue, la notif reste récupérable ; si la
// persistance échoue, on n'émet pas une notif fantôme non rattrapable.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { NotificationGateway } from '../gateway/notification.gateway';

type TypeNotification =
  | 'MANIFESTE_SOUMIS' | 'ETAPE_VALIDEE' | 'ETAPE_REJETEE'
  | 'MANIFESTE_COMPLETE' | 'CONSIGNE_CEMAA' | 'ALERTE';

export interface CreerNotification {
  base_id:         string;
  /** NULL = toute la base. Sinon, destinataire nominatif. */
  destinataire_id?: string | null;
  type:            TypeNotification;
  titre:           string;
  message:         string;
  manifeste_id?:   string;
  vol_id?:         string;
  etape?:          string;
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
   * Diffusion :
   *   • destinataire_id renseigné → room user:<destinataire_id> ;
   *   • sinon → room base:<base_id> (tous les utilisateurs de la base).
   */
  async emettre(n: CreerNotification): Promise<void> {
    let persistee;
    try {
      persistee = await this.prisma.notification.create({
        data: {
          base_id:         n.base_id,
          destinataire_id: n.destinataire_id ?? null,
          type:            n.type,
          titre:           n.titre,
          message:         n.message,
          manifeste_id:    n.manifeste_id ?? null,
          vol_id:          n.vol_id ?? null,
          etape:           n.etape ?? null,
        },
      });
    } catch (e) {
      // Une base_id ou destinataire_id inconnu (FK) ne doit pas tuer le
      // consumer : on loggue et on abandonne cette notification.
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
      etape:        persistee.etape,
      createdAt:    persistee.createdAt,
    };

    if (n.destinataire_id) {
      this.gateway.broadcastToUser(n.destinataire_id, 'notification', payload);
    } else {
      this.gateway.broadcastToBase(n.base_id, 'notification', payload);
    }
  }

  /** Émet plusieurs notifications (ex. tous les acteurs d'un rejet). */
  async emettrePlusieurs(list: CreerNotification[]): Promise<void> {
    for (const n of list) {
      await this.emettre(n);
    }
  }

  /**
   * Notifications non lues d'un utilisateur, pour rattrapage à la reconnexion.
   * Inclut les notifs de sa base (destinataire NULL) ET celles qui le ciblent.
   */
  async nonLues(user_id: string, base_id: string): Promise<unknown[]> {
    return this.prisma.notification.findMany({
      where: {
        lu: false,
        OR: [
          { destinataire_id: user_id },
          { destinataire_id: null, base_id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async marquerLu(id: string, user_id: string, base_id: string): Promise<void> {
    // Ne marque que si la notif appartient au périmètre de l'utilisateur.
    await this.prisma.notification.updateMany({
      where: {
        id,
        OR: [
          { destinataire_id: user_id },
          { destinataire_id: null, base_id },
        ],
      },
      data: { lu: true, lu_le: new Date() },
    });
  }

  async marquerToutLu(user_id: string, base_id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        lu: false,
        OR: [
          { destinataire_id: user_id },
          { destinataire_id: null, base_id },
        ],
      },
      data: { lu: true, lu_le: new Date() },
    });
  }
}