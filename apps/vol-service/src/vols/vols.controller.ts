// apps/vol-service/src/vols/vols.controller.ts
import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { VolsService } from './vols.service';
import { CreateVolDto } from './dto/create-vol.dto';

@Controller('vols')
@UseGuards(JwtAuthGuard)
export class VolsController {
  constructor(private readonly volsService: VolsService) {}

  /**
   * Planification d'un vol.
   *
   * Réservée au COMBASE et au COMGMO — les deux autorités qui engagent les
   * moyens de la base — ainsi qu'à l'ADMIN pour l'exploitation du système.
   *
   * `@CurrentUser` est indispensable : la base de départ du vol est celle du
   * créateur, imposée par le service et non lue dans le corps de la requête.
   */
  @Post()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.COMBASE, RoleUtilisateur.COMGMO)
  @UseGuards(RolesGuard)
  create(@Body() dto: CreateVolDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.volsService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<unknown[]> {
    return this.volsService.findAll(user.base_id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.volsService.findOne(id);
  }

  /**
   * Annulation — et non suppression : un vol portant des manifestes doit
   * rester consultable (FK Manifeste.vol_id en RESTRICT). Aucune route
   * DELETE n'est donc exposée, volontairement.
   */
  @Patch(':id/annuler')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.COMBASE)
  @UseGuards(RolesGuard)
  annuler(@Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.volsService.annuler(id);
  }
}