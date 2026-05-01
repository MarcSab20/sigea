import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { AuditModule } from '@sigea/shared-audit';
import { ValidationStateMachine } from './state-machine/validation-state-machine';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedDatabaseModule,
    AuditModule,
    HealthModule,
  ],
  providers: [ValidationStateMachine],
})
export class ValidationServiceModule {}