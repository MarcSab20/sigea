import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { AuditModule } from '@sigea/shared-audit';
import { VolsModule } from './vols/vols.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedDatabaseModule,
    AuditModule,
    VolsModule,
    HealthModule,
  ],
})
export class VolServiceModule {}