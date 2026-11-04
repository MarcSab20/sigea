// apps/liste-service/src/circuit/delegation.controller.ts

import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, ParseUUIDPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { IsString, IsUUID, MinLength, MaxLength } from 'class-validator';
import { JwtAuthGuard, RolesGuard, Roles, PerimetreGuard, CurrentUser } from '@sigea/shared-auth';
import { Audit } from '@sigea/shared-audit';
import { JwtPayload, RoleUtilisateur } from '@sigea/shared-types';
import { DelegationService } from './delegation.service';

class DeleguerDto {
  @IsUUID() delegataire_id!: string;

  /**
   * Motif obligatoire. Il sera repris dans la note de délégation portée au
   * dossier d'archivage : une délégation sans motif est un acte que personne
   * ne pourra expliquer six mois plus tard.
   */
  @IsString() @MinLength(10) @MaxLength(500) motif!: string;
}

@Controller('listes')
@UseGuards(JwtAuthGuard, PerimetreGuard)
export class DelegationController {
  constructor(private readonly delegation: DelegationService) {}

  /** Officiers désignables de la base, et délégation en cours s'il y en a une. */
  @Get(':id/delegation')
  @Roles(RoleUtilisateur.COMBASE, RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  candidats(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.delegation.candidats(id, user);
  }

  /**
   * Désigner un délégataire.
   *
   * Le rôle COMBASE est exigé ici ET revérifié dans le service : la garde cadre
   * l'accès à la route, le service l'accès à CETTE liste. Un COMGMO ne peut
   * donc pas se désigner lui-même, ce qui viderait la délégation de son sens.
   */
  @Post(':id/delegation')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleUtilisateur.COMBASE, RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  @Audit('liste.delegation')
  deleguer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleguerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.delegation.deleguer(id, dto.delegataire_id, dto.motif, user);
  }

  @Delete(':id/delegation')
  @Roles(RoleUtilisateur.COMBASE, RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  @Audit('liste.delegation_revocation')
  revoquer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.delegation.revoquer(id, user);
  }
}