// apps/vol-service/src/vols/vols.controller.ts

import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { Audit } from '@sigea/shared-audit';
import { RoleUtilisateur, JwtPayload, ROLES_CREATION_VOL } from '@sigea/shared-types';
import { VolsService } from './vols.service';
import { CreateVolDto } from './dto/create-vol.dto';

class AnnulationDto {
  @IsOptional() @IsString() @MaxLength(500) motif?: string;
}

@Controller('vols')
@UseGuards(JwtAuthGuard)
export class VolsController {
  constructor(private readonly volsService: VolsService) {}

  /**
   * Planification — COMBASE et COMEA, conformément à la directive.
   *
   * Le COMGMO en est retiré : il n'est plus planificateur, seulement
   * délégataire possible du COMBASE pour la discrimination des listes.
   *
   * La liste vient de ROLES_CREATION_VOL (@sigea/shared-types), lue aussi par
   * l'IHM : un bouton ne peut pas s'afficher pour un rôle que le serveur
   * refusera.
   */
  @Post()
  @Roles(...ROLES_CREATION_VOL)
  @UseGuards(RolesGuard)
  @Audit('vol.creation')
  create(@Body() dto: CreateVolDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.volsService.create(dto, user);
  }

  /**
   * Vols visibles. Le filtrage est intégralement porté par le service — aucune
   * base, aucune RMIA ne transite par la requête, donc aucune n'est falsifiable.
   */
  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<unknown[]> {
    return this.volsService.findAll(user);
  }

  /** File d'attente du SCOPS : vols planifiés en attente d'allocation. */
  @Get('a-diffuser')
  @Roles(RoleUtilisateur.SCOPS, RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  enAttenteDiffusion(@CurrentUser() user: JwtPayload): Promise<unknown[]> {
    return this.volsService.enAttenteDiffusion(user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.volsService.findOne(id, user);
  }

  @Patch(':id/annuler')
  @Roles(
    RoleUtilisateur.COMBASE,
    RoleUtilisateur.COMEA,
    RoleUtilisateur.SCOPS,
    RoleUtilisateur.ADMIN,
  )
  @UseGuards(RolesGuard)
  @Audit('vol.annulation')
  annuler(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnnulationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.volsService.annuler(id, user, dto.motif);
  }
}