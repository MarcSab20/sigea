// apps/liste-service/src/potentialites/potentialites.controller.ts

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Res,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard, RolesGuard, Roles, PerimetreGuard, CurrentUser } from '@sigea/shared-auth';
import { Audit } from '@sigea/shared-audit';
import { JwtPayload, RoleUtilisateur, ROLES_SAISIE } from '@sigea/shared-types';
import { PotentialitesService } from './potentialites.service';
import { PiecesService } from './pieces.service';
import {
  CreatePotentialiteDto, UpdatePotentialiteDto, FiltrePotentialiteDto,
  ArchiverPotentialiteDto, DeposerPieceDto,
} from './dto/potentialite.dto';

/**
 * Rôles autorisés à CONSULTER le vivier et les pièces.
 *
 * Toute la chaîne de discrimination y figure, et c'est volontaire : décider du
 * retrait d'un voyageur sans pouvoir ouvrir son ordre de mission, c'est décider
 * sur un nom. Le service borne ensuite chacun à son périmètre.
 */
const ROLES_CONSULTATION = [
  RoleUtilisateur.SEC_ADJ_AIR,
  RoleUtilisateur.ADJ_AIR,
  RoleUtilisateur.COMRMIA,
  RoleUtilisateur.COMBASE,
  RoleUtilisateur.COMSECBASE,
  RoleUtilisateur.COMGMO,
  RoleUtilisateur.COMBORD,
  RoleUtilisateur.CEMAA,
  RoleUtilisateur.MAGE,
  RoleUtilisateur.ADMIN,
] as const;

@Controller('potentialites')
@UseGuards(JwtAuthGuard, PerimetreGuard)
export class PotentialitesController {
  constructor(
    private readonly service: PotentialitesService,
    private readonly pieces: PiecesService,
  ) {}

  // ── Tenue du vivier : SEC_ADJ_AIR uniquement ─────────────────────────────

  @Post()
  @Roles(...ROLES_SAISIE)
  @UseGuards(RolesGuard)
  @Audit('potentialite.creation')
  creer(@Body() dto: CreatePotentialiteDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.service.creer(dto, user);
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

  // ── Pièces justificatives ────────────────────────────────────────────────

  /**
   * Téléchargement d'une pièce.
   *
   * `Content-Disposition: attachment` et non `inline` : un PDF ouvert dans
   * l'onglet peut exécuter du script via le lecteur du navigateur. Forcer le
   * téléchargement ferme cette porte, au prix d'un clic de plus.
   */
  @Get('pieces/:pieceId')
  @Roles(...ROLES_CONSULTATION)
  @UseGuards(RolesGuard)
  @Audit('potentialite.piece_consultation')
  async telecharger(
    @Param('pieceId', ParseUUIDPipe) pieceId: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const { octets, nom, type } = await this.pieces.telecharger(pieceId, user);
    res.set({
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(nom)}"`,
      'Content-Length': octets.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(octets);
  }

  @Delete('pieces/:pieceId')
  @Roles(...ROLES_SAISIE)
  @UseGuards(RolesGuard)
  @Audit('potentialite.piece_retrait')
  supprimerPiece(
    @Param('pieceId', ParseUUIDPipe) pieceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.pieces.supprimer(pieceId, user);
  }

  @Post(':id/pieces')
  @Roles(...ROLES_SAISIE)
  @UseGuards(RolesGuard)
  @Audit('potentialite.piece_depot')
  deposer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeposerPieceDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.pieces.deposer(id, dto, user);
  }

  // ── Consultation : toute la chaîne ───────────────────────────────────────

  @Get()
  @Roles(...ROLES_CONSULTATION)
  @UseGuards(RolesGuard)
  lister(@Query() filtre: FiltrePotentialiteDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.service.lister(filtre, user);
  }

  @Get(':id')
  @Roles(...ROLES_CONSULTATION)
  @UseGuards(RolesGuard)
  consulter(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.consulter(id, user);
  }
}