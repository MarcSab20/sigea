// apps/liste-service/src/potentialites/potentialites.controller.ts

import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, PerimetreGuard, CurrentUser } from '@sigea/shared-auth';
import { Audit } from '@sigea/shared-audit';
import { JwtPayload, RoleUtilisateur, ROLES_SAISIE } from '@sigea/shared-types';
import { PotentialitesService } from './potentialites.service';
import {
  CreatePotentialiteDto, UpdatePotentialiteDto, FiltrePotentialiteDto,
  ArchiverPotentialiteDto,
} from './dto/potentialite.dto';

@Controller('potentialites')
@UseGuards(JwtAuthGuard, PerimetreGuard)
export class PotentialitesController {
  constructor(private readonly service: PotentialitesService) {}

  /**
   * Écriture réservée au SEC_ADJ_AIR, conformément à la directive.
   * `ROLES_SAISIE` est lu aussi par l'IHM : un formulaire ne peut pas
   * s'afficher pour un rôle que le serveur refusera.
   */
  @Post()
  @Roles(...ROLES_SAISIE)
  @UseGuards(RolesGuard)
  @Audit('potentialite.creation')
  creer(@Body() dto: CreatePotentialiteDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.service.creer(dto, user);
  }

  /**
   * Lecture ouverte à toute la chaîne RMIA : l'Adjoint Air et le COMRMIA
   * doivent pouvoir vérifier d'où sort un nom porté sur une liste.
   */
  @Get()
  @Roles(
    RoleUtilisateur.SEC_ADJ_AIR,
    RoleUtilisateur.ADJ_AIR,
    RoleUtilisateur.COMRMIA,
    RoleUtilisateur.ADMIN,
  )
  @UseGuards(RolesGuard)
  lister(@Query() filtre: FiltrePotentialiteDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.service.lister(filtre, user);
  }

  @Patch(':id')
  @Roles(...ROLES_SAISIE)
  @UseGuards(RolesGuard)
  @Audit('potentialite.modification')
  modifier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePotentialiteDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.modifier(id, dto, user);
  }

  @Patch(':id/archiver')
  @Roles(...ROLES_SAISIE)
  @UseGuards(RolesGuard)
  @Audit('potentialite.archivage')
  archiver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ArchiverPotentialiteDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.archiver(id, dto.motif, user);
  }
}