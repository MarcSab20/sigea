import { Module } from '@nestjs/common';
import { UnitesController } from './unites.controller';
import { UnitesService } from './unites.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({ imports: [SharedDatabaseModule], controllers: [UnitesController], providers: [UnitesService] })
export class UnitesModule {}
