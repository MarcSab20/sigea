// apps/liste-service/src/circuit/circuit.module.ts
import { Module } from '@nestjs/common';
import { IntegrityModule } from '@sigea/shared-integrity';
import { CircuitController } from './circuit.controller';
import { ListeStateMachine } from './liste-state-machine';

@Module({
  imports: [IntegrityModule],
  controllers: [CircuitController],
  providers: [ListeStateMachine],
})
export class CircuitModule {}