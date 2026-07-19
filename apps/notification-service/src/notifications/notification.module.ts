// apps/notification-service/src/notifications/notification.module.ts
//
// Regroupe le service, le controller REST et la gateway WebSocket.
// Service ↔ gateway se référencent mutuellement (le service diffuse via la
// gateway ; la gateway lit le backlog via le service) : ils vivent donc dans
// le MÊME module, et le cycle est brisé par forwardRef côté gateway.

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from '../gateway/notification.gateway';
import { JwtStrategy } from '../strategies/jwt.strategy';

@Module({
  imports: [PassportModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway, JwtStrategy],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}