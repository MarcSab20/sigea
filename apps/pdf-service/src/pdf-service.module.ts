import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { SharedCryptoModule } from '@sigea/shared-crypto';
import { PdfService } from './pdf/pdf.service';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedDatabaseModule,
    SharedCryptoModule,
    HealthModule,
  ],
  providers: [PdfService],
})
export class PdfServiceModule {}