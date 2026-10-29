// apps/notification-service/src/gateway/notification.gateway.ts
//
// Gateway WebSocket : authentifie les clients par JWT, les place dans leurs
// rooms et expose des helpers de diffusion.
//
// ── Ce qui change : la room RMIA ──
// La chaîne RMIA — COMRMIA, ADJ_AIR, SEC_ADJ_AIR — ne travaille pas à l'échelle
// d'une base mais d'une région. Sans room dédiée, l'Adjoint Air de la RMIA 2 ne
// recevrait que les évènements de sa base d'affectation, c'est-à-dire une
// fraction de ce qu'il doit suivre. La room base est conservée pour tous les
// autres rôles.

import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationService } from '../notifications/notification.service';

const WS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

interface JetonWs {
  sub:     string;
  base_id: string;
  rmia?:   string | null;
}

@WebSocketGateway({ cors: { origin: WS_ORIGINS, credentials: true }, namespace: '/notifications' })
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notifications: NotificationService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth?.['token'] as string | undefined;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token) as JetonWs;
      void client.join(`base:${payload.base_id}`);
      void client.join(`user:${payload.sub}`);
      // La RMIA vient du JETON, jamais du client : sans cela, n'importe qui
      // rejoindrait la room d'une autre région en modifiant sa requête.
      if (payload.rmia) void client.join(`rmia:${payload.rmia}`);

      client.data['user'] = payload;
      this.logger.log(
        `Client connecté : ${payload.sub} → base:${payload.base_id}` +
          (payload.rmia ? `, rmia:${payload.rmia}` : ''),
      );

      // Rattrapage : renvoyer les notifications non lues accumulées hors ligne.
      void this.notifications
        .nonLues(payload.sub, payload.base_id)
        .then((list) => {
          if (list.length) client.emit('notifications.backlog', list);
        })
        .catch((e) => this.logger.error(`Backlog échoué : ${(e as Error).message}`));
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client déconnecté : ${String(client.data?.['user']?.sub ?? 'inconnu')}`);
  }

  /** Diffuse à tous les clients d'une base. */
  broadcastToBase(base_id: string, event: string, data: unknown): void {
    this.server.to(`base:${base_id}`).emit(event, data);
  }

  /** Diffuse à toute la chaîne d'une région militaire interarmées. */
  broadcastToRmia(rmia: string, event: string, data: unknown): void {
    this.server.to(`rmia:${rmia}`).emit(event, data);
  }

  /** Diffuse à un utilisateur précis (toutes ses sessions). */
  broadcastToUser(user_id: string, event: string, data: unknown): void {
    this.server.to(`user:${user_id}`).emit(event, data);
  }

  /** Diffuse à tous les clients connectés (alertes globales). */
  broadcastToAll(event: string, data: unknown): void {
    this.server.emit(event, data);
  }
}