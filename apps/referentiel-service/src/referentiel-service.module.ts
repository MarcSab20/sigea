import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedDatabaseModule } from '@sigea/shared-database';
import { BasesModule } from './bases/bases.module';
import { AeronefsModule } from './aeronefs/aeronefs.module';
import { PersonnelsModule } from './personnels/personnels.module';
import { UnitesModule } from './unites/unites.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedDatabaseModule,
    BasesModule,
    AeronefsModule,
    PersonnelsModule,
    UnitesModule,
    HealthModule,
  ],
})
export class ReferentielServiceModule {}