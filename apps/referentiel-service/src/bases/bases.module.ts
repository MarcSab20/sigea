import { Module } from '@nestjs/common';
import { BasesController } from './bases.controller';
import { BasesService } from './bases.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({ imports: [SharedDatabaseModule], controllers: [BasesController], providers: [BasesService] })
export class BasesModule {}
