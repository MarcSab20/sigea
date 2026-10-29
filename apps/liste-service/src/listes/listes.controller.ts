// apps/liste-service/src/listes/listes.controller.ts

import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { JwtAuthGuard, RolesGuard, Roles, PerimetreGuard, CurrentUser } from '@sigea/shared-auth';
import { Audit } from '@sigea/shared-audit';
import { JwtPayload, RoleUtilisateur, ROLES_SAISIE } from '@sigea/shared-types';
import { ListesService } from './listes.service';
import {
  SelectionnerDto, CreateLigneDto, DiscriminerDto, ReordonnerDto,
  CreateFretDto, ImposerDto,
} from './dto/ligne.dto';

class MotifDto {
  @IsString() @MinLength(3) @MaxLength(500) motif!: string;
}

/** Rôles habilités à discriminer. Le SEC_ADJ_AIR n'en fait pas partie : il constitue. */
const ROLES_DISCRIMINANTS = [
  RoleUtilisateur.ADJ_AIR,
  RoleUtilisateur.COMRMIA,
  RoleUtilisateur.COMBASE,
  RoleUtilisateur.COMGMO,
  RoleUtilisateur.COMSECBASE,
  RoleUtilisateur.COMBORD,
] as const;

@Controller('listes')
@UseGuards(JwtAuthGuard, PerimetreGuard)
export class ListesController {
  constructor(private readonly service: ListesService) {}

  /** Dossiers visibles de l'utilisateur, avec le drapeau « à traiter ». */
  @Get()
  mesListes(@CurrentUser() user: JwtPayload): Promise<unknown[]> {
    return this.service.mesListes(user);
  }

  @Get(':id')
  consulter(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.consulter(id, user);
  }

  /** Occupation tronçon par tronçon : écran de contrôle de la sur-réservation. */
  @Get('vol/:volId/troncons')
  troncons(
    @Param('volId', ParseUUIDPipe) volId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.troncons(volId, user);
  }

  // ── Constitution : SEC_ADJ_AIR uniquement ────────────────────────────────

  @Post(':id/selection')
  @Roles(...ROLES_SAISIE)
  @UseGuards(RolesGuard)
  @Audit('liste.selection')
  selectionner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelectionnerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.selectionner(id, dto, user);
  }

  @Post(':id/lignes')
  @Roles(...ROLES_SAISIE)
  @UseGuards(RolesGuard)
  @Audit('liste.ligne_creation')
  ajouterLigne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLigneDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.ajouterLigne(id, dto, user);
  }

  @Delete(':id/lignes/:ligneId')
  @Roles(...ROLES_SAISIE)
  @UseGuards(RolesGuard)
  @Audit('liste.ligne_retrait')
  retirerLigne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ligneId', ParseUUIDPipe) ligneId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.retirerLigne(id, ligneId, user);
  }

  @Post(':id/frets')
  @Roles(...ROLES_SAISIE)
  @UseGuards(RolesGuard)
  @Audit('liste.fret_creation')
  ajouterFret(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFretDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.ajouterFret(id, dto, user);
  }

  // ── Discrimination ───────────────────────────────────────────────────────

  @Patch(':id/lignes/:ligneId/discrimination')
  @Roles(...ROLES_DISCRIMINANTS)
  @UseGuards(RolesGuard)
  @Audit('liste.discrimination')
  discriminer(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ligneId', ParseUUIDPipe) ligneId: string,
    @Body() dto: DiscriminerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.discriminer(id, ligneId, dto, user);
  }

  @Patch(':id/ordre')
  @Roles(...ROLES_DISCRIMINANTS)
  @UseGuards(RolesGuard)
  @Audit('liste.reordonnancement')
  reordonner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReordonnerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.reordonner(id, dto, user);
  }

  @Patch(':id/frets/:fretId/retrait')
  @Roles(...ROLES_DISCRIMINANTS)
  @UseGuards(RolesGuard)
  @Audit('liste.fret_retrait')
  retirerFret(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fretId', ParseUUIDPipe) fretId: string,
    @Body() dto: MotifDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.retirerFret(id, fretId, dto.motif, user);
  }

  // ── Imposition d'urgence : espace CEMAA / MAGE ───────────────────────────

  @Post(':id/impositions')
  @Roles(RoleUtilisateur.CEMAA, RoleUtilisateur.MAGE)
  @UseGuards(RolesGuard)
  @Audit('liste.imposition')
  imposer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImposerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.imposer(id, dto, user);
  }
}