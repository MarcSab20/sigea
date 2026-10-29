// apps/vol-service/src/diffusion/diffusion.module.ts
import { Module } from '@nestjs/common';
import { DiffusionController } from './diffusion.controller';
import { DiffusionService } from './diffusion.service';

@Module({
  controllers: [DiffusionController],
  providers: [DiffusionService],
})
export class DiffusionModule {}