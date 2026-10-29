// apps/liste-service/src/potentialites/potentialites.module.ts
import { Module } from '@nestjs/common';
import { PotentialitesController } from './potentialites.controller';
import { PotentialitesService } from './potentialites.service';

@Module({
  controllers: [PotentialitesController],
  providers: [PotentialitesService],
})
export class PotentialitesModule {}