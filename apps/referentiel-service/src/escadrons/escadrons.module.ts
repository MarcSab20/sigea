import { Module } from '@nestjs/common';
import { EscadronsController } from './escadrons.controller';
import { EscadronsService } from './escadrons.service';

@Module({
  controllers: [EscadronsController],
  providers:   [EscadronsService],
  exports:     [EscadronsService],
})
export class EscadronsModule {}