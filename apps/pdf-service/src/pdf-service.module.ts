// apps/pdf-service/src/pdf-service.module.ts
//
// ── Corrections par rapport à la version du dépôt ──
//
// 1. `./archives/archive-consumer.service` : le fichier s'appelle
//    `archive-consummer.service.ts` (double « m »). Deux fichiers l'importaient
//    sous le nom correct — module introuvable, service inconstruisible.
//    Corrigé par renommage du fichier (voir scripts/correctifs-lot4.sh),
//    et non par altération des imports : c'est le nom du fichier qui est faux.
//
// 2. `VerificationModule` importe désormais SharedDatabaseModule et
//    SharedCryptoModule, dont NumeroControleService a besoin. La version de
//    `src/verification/` ne les déclarait pas — elle date d'avant le besoin 7.
//    Le module correct était écrit dans `apps/pdf-service/verification/`,
//    c'est-à-dire HORS de `src/` : jamais compilé, jamais monté.
//
// Note : SharedDatabaseModule est @Global, donc PrismaService serait résolu
// même sans import explicite. On le déclare quand même dans VerificationModule
// pour que le module reste autonome — un module qui ne fonctionne que grâce à
// une globalité déclarée ailleurs est un piège au prochain découpage.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { SharedCryptoModule } from '@sigea/shared-crypto';
import { PdfService } from './pdf/pdf.service';
import { PdfController } from './pdf/pdf.controller';
import { ManifesteDataService } from './pdf/manifeste-data.service';
import { HealthModule } from './health/health.module';
import { VerificationModule } from './verification/verification.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ArchiveController } from './archives/archive.controller';
import { ArchiveService } from './archives/archive.service';
import { ArchiveConsumer } from './archives/archive-consumer.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      publicKey: process.env.JWT_PUBLIC_KEY
        ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8')
        : '',
      verifyOptions: { algorithms: ['RS256'] },
    }),
    SharedDatabaseModule,
    SharedCryptoModule,
    // Expose l'endpoint public /verification et l'administration du numéro de
    // contrôle (/pdf/controle), et fournit AuthenticiteService, dont
    // ManifesteDataService a besoin pour composer le cartouche QR.
    VerificationModule,
    HealthModule,
  ],
  controllers: [PdfController, ArchiveController],
  providers: [
    PdfService, ManifesteDataService, JwtStrategy,
    // Archivage : une seule instance de PdfService est partagée avec le rendu
    // à la demande. Un module séparé en créerait une seconde, donc un second
    // Chromium — environ 300 Mo de RSS pour rien sur le T360.
    ArchiveService, ArchiveConsumer,
  ],
})
export class PdfServiceModule {}