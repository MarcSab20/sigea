// apps/notification-service/src/gateway/notification.gateway.ts
// Gateway WebSocket : authentifie les clients par JWT, les place dans la room
// de leur base (et de leur utilisateur) et expose des helpers de diffusion.

import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const WS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

@WebSocketGateway({ cors: { origin: WS_ORIGINS, credentials: true }, namespace: '/notifications' })
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth?.['token'] as string | undefined;
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token) as { base_id: string; sub: string };
      void client.join(`base:${payload.base_id}`);
      void client.join(`user:${payload.sub}`);
      client.data['user'] = payload;
      this.logger.log(`Client connecté : ${payload.sub} → base:${payload.base_id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client déconnecté : ${String(client.data?.['user']?.sub ?? 'inconnu')}`);
  }

  /** Diffuse un évènement à tous les clients d'une base. */
  broadcastToBase(base_id: string, event: string, data: unknown): void {
    this.server.to(`base:${base_id}`).emit(event, data);
  }

  /** Diffuse un évènement à un utilisateur précis (toutes ses sessions). */
  broadcastToUser(user_id: string, event: string, data: unknown): void {
    this.server.to(`user:${user_id}`).emit(event, data);
  }

  /** Diffuse à tous les clients connectés (alertes globales). */
  broadcastToAll(event: string, data: unknown): void {
    this.server.emit(event, data);
  }
}
