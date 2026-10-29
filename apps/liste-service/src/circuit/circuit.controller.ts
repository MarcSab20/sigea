// apps/liste-service/src/circuit/circuit.controller.ts

import {
  Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard, PerimetreGuard, CurrentUser } from '@sigea/shared-auth';
import { Audit } from '@sigea/shared-audit';
import { JwtPayload, EtapeListe } from '@sigea/shared-types';
import { ListeStateMachine, AvancementListe } from './liste-state-machine';

class ViserRequeteDto {
  @IsOptional() @IsString() @MaxLength(1000) commentaire?: string;

  /**
   * Obligatoire lorsque le COMGMO ou le COMSECBASE signe pour le COMBASE.
   * La machine à états revérifie cette condition : cette classe ne peut pas
   * conditionner une règle à l'identité de l'appelant.
   */
  @IsOptional() @IsString() @MinLength(10) @MaxLength(500) note_delegation?: string;
}

class RejeterRequeteDto {
  @IsString() @MinLength(3) @MaxLength(1000) motif!: string;

  /** Étape de retour. Par défaut : le secrétaire, pour reconstitution complète. */
  @IsOptional() @IsEnum(EtapeListe) etape_retour?: EtapeListe;
}

/**
 * Le rôle n'est JAMAIS lu dans le corps de la requête : il vient exclusivement
 * du jeton. Une version antérieure de SIGEA acceptait un champ `role` fourni
 * par le client — n'importe qui pouvait signer à la place du commandant de base.
 */
@Controller('listes')
@UseGuards(JwtAuthGuard, PerimetreGuard)
export class CircuitController {
  constructor(private readonly machine: ListeStateMachine) {}

  /** Alimente l'IHM et l'impression des blocs de signature. */
  @Get(':id/avancement')
  @Audit('liste.avancement')
  avancement(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AvancementListe> {
    return this.machine.avancement(id, user);
  }

  @Post(':id/visa')
  @HttpCode(HttpStatus.OK)
  @Audit('liste.visa')
  viser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ViserRequeteDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.machine.viser(id, user, dto);
  }

  @Post(':id/renvoi')
  @HttpCode(HttpStatus.OK)
  @Audit('liste.renvoi')
  rejeter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejeterRequeteDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.machine.rejeter(id, user, dto);
  }
}