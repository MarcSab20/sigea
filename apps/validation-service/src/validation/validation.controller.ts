// apps/validation-service/src/validation/validation.controller.ts
import {
  Controller, Post, Get, Param, Body, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard, CurrentUser } from '@sigea/shared-auth';
import { Audit } from '@sigea/shared-audit';
import { JwtPayload, StatutValidation } from '@sigea/shared-types';
import { ValidationStateMachine, AvancementCircuit } from '../state-machine/validation-state-machine';

class ValidationActionDto {
  @IsEnum(StatutValidation, { message: 'statut doit valoir APPROUVE ou REJETE' })
  statut!: StatutValidation.APPROUVE | StatutValidation.REJETE;

  @IsOptional() @IsString() @MaxLength(1000)
  commentaire?: string;

  // Le motif est obligatoire pour un rejet ; la state machine le revérifie,
  // car cette classe ne peut pas conditionner une règle à un autre champ.
  @IsOptional() @IsString() @MinLength(3) @MaxLength(1000)
  motif?: string;
}

// NOTE — le rôle n'est PAS lu depuis le corps de la requête.
// L'ancienne version acceptait un champ `role` fourni par le client :
// n'importe qui pouvait signer à la place du COMBASE. Le rôle vient
// exclusivement du JWT.
@Controller('validations')
@UseGuards(JwtAuthGuard)
export class ValidationController {
  constructor(private readonly stateMachine: ValidationStateMachine) {}

  /** Avancement du circuit : alimente l'IHM et l'impression des 5 blocs. */
  @Get(':manifesteId')
  @Audit('validation.avancement')
  avancement(
    @Param('manifesteId', ParseUUIDPipe) manifesteId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AvancementCircuit> {
    return this.stateMachine.avancement(manifesteId, user);
  }

  @Post(':manifesteId')
  @HttpCode(HttpStatus.OK)
  @Audit('validation.action')
  async action(
    @Param('manifesteId', ParseUUIDPipe) manifesteId: string,
    @Body() dto: ValidationActionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    if (dto.statut === StatutValidation.APPROUVE) {
      return this.stateMachine.valider(manifesteId, user, dto.commentaire);
    }
    return this.stateMachine.rejeter(manifesteId, user, dto.motif ?? dto.commentaire ?? '');
  }
}