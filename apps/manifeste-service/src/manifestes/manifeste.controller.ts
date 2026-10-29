// apps/manifeste-service/src/manifestes/manifeste.controller.ts
//
// Les routes de CRÉATION, de SOUMISSION, de passagers et de matériels ont
// disparu : la saisie appartient au secrétaire de l'Adjoint Air, dans
// liste-service. Ce contrôleur ne sert plus que la lecture et la
// discrimination finale du commandant de bord.

import {
  Controller, Get, Patch, Put, Body, Param, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, PerimetreGuard, CurrentUser } from '@sigea/shared-auth';
import { Audit } from '@sigea/shared-audit';
import { JwtPayload, RoleUtilisateur } from '@sigea/shared-types';
import { ManifesteService } from './manifeste.service';
import { RetraitDto, EquipageDto } from './dto/manifeste.dto';

@Controller('manifestes')
@UseGuards(JwtAuthGuard, PerimetreGuard)
export class ManifesteController {
  constructor(private readonly service: ManifesteService) {}

  @Get()
  lister(@CurrentUser() user: JwtPayload): Promise<unknown[]> {
    return this.service.lister(user);
  }

  @Get(':id')
  consulter(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.consulter(id, user);
  }

  // ── Discrimination finale : COMBORD uniquement ───────────────────────────
  //
  // Le RolesGuard filtre le rôle ; le service vérifie en outre que l'appelant
  // est le commandant de bord DE CE VOL. Les deux contrôles sont nécessaires :
  // le premier cadre l'accès à la route, le second l'accès à la ressource.

  @Patch(':id/passagers/:passagerId/retrait')
  @Roles(RoleUtilisateur.COMBORD)
  @UseGuards(RolesGuard)
  @Audit('manifeste.passager_retrait')
  retirerPassager(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('passagerId', ParseUUIDPipe) passagerId: string,
    @Body() dto: RetraitDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.retirerPassager(id, passagerId, dto.motif, user);
  }

  @Patch(':id/passagers/:passagerId/reintegration')
  @Roles(RoleUtilisateur.COMBORD)
  @UseGuards(RolesGuard)
  @Audit('manifeste.passager_reintegration')
  reintegrerPassager(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('passagerId', ParseUUIDPipe) passagerId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.reintegrerPassager(id, passagerId, user);
  }

  @Patch(':id/materiels/:materielId/retrait')
  @Roles(RoleUtilisateur.COMBORD)
  @UseGuards(RolesGuard)
  @Audit('manifeste.materiel_retrait')
  retirerMateriel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('materielId', ParseUUIDPipe) materielId: string,
    @Body() dto: RetraitDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.retirerMateriel(id, materielId, dto.motif, user);
  }

  /** Remplacement intégral de l'équipage : un équipage se déclare d'un bloc. */
  @Put(':id/equipage')
  @Roles(RoleUtilisateur.COMBORD)
  @UseGuards(RolesGuard)
  @Audit('manifeste.equipage')
  definirEquipage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EquipageDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.service.definirEquipage(id, dto.membres, user);
  }
}