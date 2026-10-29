// apps/notification-service/src/notification-service.module.ts
//
// Ajout du lot 5 : MessagerieModule, qui porte l'envoi des messages aux
// voyageurs. Il vit dans ce service et non dans un service distinct parce
// qu'il partage le même métier — prévenir des gens — et que séparer deux
// processus pour une file de quelques dizaines de messages par jour coûterait
// plus en exploitation qu'il ne rapporterait.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { AuditModule } from '@sigea/shared-audit';
import { HealthModule } from './health/health.module';
import { NotificationModule } from './notifications/notification.module';
import { EventsConsumerModule } from './events/events-consumer.module';
import { MessagerieModule } from './messagerie/messagerie.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // JwtModule global : JwtService disponible pour la gateway WebSocket.
    // La clé publique est décodée en UTF-8 — un Buffer brut était refusé par
    // la vérification RS256.
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        publicKey: process.env.JWT_PUBLIC_KEY
          ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8')
          : '',
        verifyOptions: { algorithms: ['RS256'] },
      }),
    }),
    // PrismaService (@Global), requis par HealthController, NotificationService,
    // EventsConsumer et MessagerieService.
    SharedDatabaseModule,
    AuditModule,
    HealthModule,
    NotificationModule,
    EventsConsumerModule,
    MessagerieModule,
  ],
})
export class NotificationServiceModule {}