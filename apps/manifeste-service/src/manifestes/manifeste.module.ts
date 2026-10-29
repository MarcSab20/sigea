// apps/manifeste-service/src/manifestes/manifeste.module.ts
import { Module } from '@nestjs/common';
import { ManifesteController } from './manifeste.controller';
import { ManifesteService } from './manifeste.service';

@Module({
  controllers: [ManifesteController],
  providers: [ManifesteService],
  exports: [ManifesteService],
})
export class ManifesteModule {}