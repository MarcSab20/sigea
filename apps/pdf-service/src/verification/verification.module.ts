// apps/pdf-service/src/verification/verification.module.ts
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { IntegrityModule } from '@sigea/shared-integrity';
import { VerificationController } from './verification.controller';
import { AuthenticiteService } from './authenticite.service';

@Module({
  imports: [
    IntegrityModule,
    // Limite propre au service : l'endpoint de vérification est public et doit
    // être bridé indépendamment du quota de la gateway, qu'il ne traverse pas
    // forcément (le QR peut pointer directement sur ce service via le reverse
    // proxy public).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [VerificationController],
  providers: [AuthenticiteService],
  exports: [AuthenticiteService],
})
export class VerificationModule {}
