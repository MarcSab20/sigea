
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { SharedCryptoModule } from '@sigea/shared-crypto';
import { IntegrityModule } from '@sigea/shared-integrity';
import { PdfService } from './pdf/pdf.service';
import { PdfController } from './pdf/pdf.controller';
import { ManifesteDataService } from './pdf/manifeste-data.service';
import { ListeDataService } from './pdf/liste-data.service';
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
    IntegrityModule,
    VerificationModule,
    HealthModule,
  ],
  controllers: [PdfController, ArchiveController],
  providers: [
    PdfService, ManifesteDataService, ListeDataService, JwtStrategy,
    ArchiveService, ArchiveConsumer,
  ],
})
export class PdfServiceModule {}