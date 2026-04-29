import { Module } from '@nestjs/common';
import { PersonnelsController } from './personnels.controller';
import { PersonnelsService } from './personnels.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({ imports: [SharedDatabaseModule], controllers: [PersonnelsController], providers: [PersonnelsService] })
export class PersonnelsModule {}
