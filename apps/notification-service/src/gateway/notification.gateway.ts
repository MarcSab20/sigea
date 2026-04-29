import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect,
  SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/notifications' })
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth['token'] as string | undefined;
      if (!token) { client.disconnect(); return; }
      const payload = this.jwtService.verify(token) as { base_id: string; sub: string };
      client.join(`base:${payload.base_id}`);
      client.data['user'] = payload;
      this.logger.log(`Client connecté : ${payload.sub} → base:${payload.base_id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client déconnecté : ${String(client.data?.['user']?.sub ?? 'inconnu')}`);
  }

  broadcastToBase(base_id: string, event: string, data: unknown): void {
    this.server.to(`base:${base_id}`).emit(event, data);
  }

  broadcastToAll(event: string, data: unknown): void {
    this.server.emit(event, data);
  }
}
