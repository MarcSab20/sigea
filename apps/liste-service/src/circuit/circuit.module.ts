// apps/liste-service/src/circuit/circuit.module.ts
import { Module } from '@nestjs/common';
import { IntegrityModule } from '@sigea/shared-integrity';
import { CircuitController } from './circuit.controller';
import { ListeStateMachine } from './liste-state-machine';
import { DelegationController } from './delegation.controller';
import { DelegationService } from './delegation.service';

@Module({
  imports: [IntegrityModule],
  controllers: [CircuitController, DelegationController],
  providers: [ListeStateMachine, DelegationService],
})
export class CircuitModule {}