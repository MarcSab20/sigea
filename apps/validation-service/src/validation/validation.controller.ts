// apps/validation-service/src/validation/validation.controller.ts
import { Controller, Post, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '@sigea/shared-auth';
import { JwtPayload, RoleUtilisateur } from '@sigea/shared-types';
import { ValidationStateMachine } from '../state-machine/validation-state-machine';

class ValidationActionDto {
  statut!: 'APPROUVE' | 'REJETE';
  commentaire?: string;
  role!: string;
}

@Controller('validations')
@UseGuards(JwtAuthGuard)
export class ValidationController {
  constructor(private readonly stateMachine: ValidationStateMachine) {}

  @Post(':manifesteId')
  async valider(
    @Param('manifesteId', ParseUUIDPipe) manifesteId: string,
    @Body() dto: ValidationActionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    if (dto.statut === 'APPROUVE') {
      return this.stateMachine.valider(manifesteId, user.role, user.base_id, dto.commentaire);
    }
    return this.stateMachine.rejeter(manifesteId, user.role, user.base_id, dto.commentaire ?? '');
  }
}