import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { AuditModule } from '@sigea/shared-audit';
import { ManifesteModule } from './manifestes/manifeste.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedDatabaseModule,
    AuditModule,
    ManifesteModule,
    HealthModule,
  ],
})
export class ManifesteServiceModule {}