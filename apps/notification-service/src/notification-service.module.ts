// apps/notification-service/src/notification-service.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { HealthModule } from './health/health.module';
import { NotificationGatewayModule } from './gateway/notification-gateway.module';
import { EventsConsumerModule } from './events/events-consumer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // JwtModule global : JwtService disponible pour la gateway WebSocket.
    // Correction : décodage UTF-8 de la clé publique (bug précédent : Buffer brut).
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        publicKey: process.env.JWT_PUBLIC_KEY
          ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8')
          : '',
        verifyOptions: { algorithms: ['RS256'] },
      }),
    }),
    HealthModule,
    NotificationGatewayModule,
    EventsConsumerModule,
  ],
})
export class NotificationServiceModule {}
