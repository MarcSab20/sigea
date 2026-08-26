import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { SharedCryptoModule } from '@sigea/shared-crypto';
import { IntegrityModule } from '@sigea/shared-integrity';
import { VerificationController } from './verification.controller';
import { NumeroAdminController } from './numero-admin.controller';
import { AuthenticiteService } from './authenticite.service';
import { NumeroControleService } from './numero-controle.service';

/**
 * Le module exporte AuthenticiteService : PdfModule / ManifesteDataService
 * s'en servent pour composer le cartouche imprimé.
 *
 * NumeroControleService n'est PAS exporté. Il est le seul détenteur du clair,
 * et rien en dehors de ce module n'a de raison légitime d'y accéder : le
 * cartouche passe par AuthenticiteService, l'administration par son propre
 * contrôleur, ici même.
 */
@Module({
  imports: [
    SharedDatabaseModule,
    SharedCryptoModule,
    IntegrityModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  controllers: [VerificationController, NumeroAdminController],
  providers:   [AuthenticiteService, NumeroControleService],
  exports:     [AuthenticiteService],
})
export class VerificationModule {}