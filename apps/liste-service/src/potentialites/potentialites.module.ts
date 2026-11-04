// apps/liste-service/src/potentialites/potentialites.module.ts
import { Module } from '@nestjs/common';
import { PotentialitesController } from './potentialites.controller';
import { PotentialitesService } from './potentialites.service';
import { PiecesService } from './pieces.service';

@Module({
  controllers: [PotentialitesController],
  providers: [PotentialitesService, PiecesService],
  exports: [PiecesService],
})
export class PotentialitesModule {}