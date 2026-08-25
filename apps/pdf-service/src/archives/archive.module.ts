import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { ArchiveController } from './archive.controller';
import { ArchiveService } from './archive.service';
import { ArchiveConsumer } from './archive-consumer.service';
import { PdfService } from '../pdf/pdf.service';
import { ManifesteDataService } from '../pdf/manifeste-data.service';
import { VerificationModule } from '../verification/verification.module';

/**
 * PdfService et ManifesteDataService sont RE-DÉCLARÉS ici plutôt qu'importés
 * d'un PdfModule : le pdf-service actuel les fournit directement au module
 * racine, sans module intermédiaire. Les redéclarer créerait deux instances de
 * PdfService — donc deux navigateurs Chromium, et le double de mémoire.
 *
 * Deux options, à votre main :
 *   (a) extraire un `PdfModule` exportant les deux services, et l'importer ici
 *       — c'est la solution propre, et ce que je recommande ;
 *   (b) déclarer ArchiveController/Service directement dans PdfServiceModule,
 *       où les providers existent déjà.
 *
 * Le patch de `pdf-service.module.ts` retient l'option (b) : moins de
 * remaniement, aucun risque de double instance. Ce fichier est fourni pour
 * l'option (a), si vous préférez assainir la structure.
 */
@Module({
  imports: [SharedDatabaseModule, VerificationModule],
  controllers: [ArchiveController],
  providers: [ArchiveService, ArchiveConsumer, PdfService, ManifesteDataService],
  exports: [ArchiveService],
})
export class ArchiveModule {}