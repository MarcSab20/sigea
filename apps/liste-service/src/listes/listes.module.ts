// apps/liste-service/src/listes/listes.module.ts
import { Module } from '@nestjs/common';
import { ListesController } from './listes.controller';
import { ListesService } from './listes.service';

@Module({
  controllers: [ListesController],
  providers: [ListesService],
  exports: [ListesService],
})
export class ListesModule {}