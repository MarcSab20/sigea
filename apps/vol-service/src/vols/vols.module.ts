// apps/vol-service/src/vols/vols.module.ts
import { Module } from '@nestjs/common';
import { VolsController } from './vols.controller';
import { VolsService } from './vols.service';
import { SharedDatabaseModule } from '@sigea/shared-database';

@Module({
  imports: [SharedDatabaseModule],
  controllers: [VolsController],
  providers: [VolsService],
})
export class VolsModule {}