import { Module } from '@nestjs/common';
import { InterimController } from './interim.controller';
import { InterimService } from './interim.service';

@Module({
  controllers: [InterimController],
  providers:   [InterimService],
  exports:     [InterimService],
})
export class InterimModule {}