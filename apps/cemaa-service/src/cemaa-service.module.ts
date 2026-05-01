import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { SharedCryptoModule } from '@sigea/shared-crypto';
import { AuditModule } from '@sigea/shared-audit';
import { ConsigneModule } from './consignes/consigne.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedDatabaseModule,
    SharedCryptoModule,
    AuditModule,
    ConsigneModule,
    HealthModule,
  ],
})
export class CemaaServiceModule {}