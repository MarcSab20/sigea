// apps/referentiel-service/src/interim/interim.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { InterimService } from './interim.service';
import { CreateInterimDto, RevoquerInterimDto, CreateMouvementDto } from './dto/interim.dto';

/**
 * Gestionnaire d'intérim et de mouvements — onglet Administration.
 *
 * Monté sous /admin/… et non sous /interim : la passerelle route déjà
 * `admin/*` vers le referentiel-service, aucune règle de proxy n'est donc à
 * ajouter. C'est le seul motif de ce choix de préfixe.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.ADMIN)
export class InterimController {
  constructor(private readonly interim: InterimService) {}

  // ── Intérim ──

  @Get('interims')
  actifs(@Query('base_id') base_id?: string): Promise<unknown[]> {
    return this.interim.actives(base_id);
  }

  @Get('interims/historique')
  historique(@Query('base_id') base_id?: string): Promise<unknown[]> {
    return this.interim.historique(base_id);
  }

  @Post('interims')
  creer(@Body() dto: CreateInterimDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.interim.creer(dto, user.sub);
  }

  /**
   * PATCH et non DELETE : une délégation n'est jamais supprimée.
   *
   * Les signatures apposées sous son couvert la référencent (FK en RESTRICT) ;
   * la détruire romprait la piste d'audit d'un manifeste déjà signé.
   */
  @Patch('interims/:id/revoquer')
  revoquer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevoquerInterimDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.interim.revoquer(id, dto, user.sub);
  }

  // ── Mouvements ──

  @Get('mouvements')
  mouvements(@Query('utilisateur_id') utilisateur_id?: string): Promise<unknown[]> {
    return this.interim.historiqueMouvements(utilisateur_id);
  }

  @Post('mouvements')
  mouvement(@Body() dto: CreateMouvementDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.interim.mouvement(dto, user.sub);
  }
}