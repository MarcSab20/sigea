import { Module } from '@nestjs/common';
import { AeronefsController } from './aeronefs.controller';
import { AeronefsService } from './aeronefs.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({ imports: [SharedDatabaseModule], controllers: [AeronefsController], providers: [AeronefsService] })
export class AeronefsModule {}
