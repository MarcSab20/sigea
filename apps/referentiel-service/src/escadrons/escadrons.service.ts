// apps/vol-service/src/vols/vols.controller.ts
import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload, ROLES_CREATION_VOL } from '@sigea/shared-types';
import { VolsService } from './vols.service';
import { CreateVolDto } from './dto/create-vol.dto';

@Controller('vols')
@UseGuards(JwtAuthGuard)
export class VolsController {
  constructor(private readonly volsService: VolsService) {}

  /**
   * Planification d'un vol.
   *
   * ── Évolution du 21/08/2026 ──
   * Le COMBASE a été RETIRÉ des rôles habilités. La planification relève
   * désormais du COMEA (commandant des escadrons aériens) et du COMGMO, qui
   * sont les deux autorités engageant les moyens aériens de la base.
   *
   * Le COMBASE conserve intégralement sa place dans le circuit de validation :
   * il appose l'ACCORD à l'étape COMBASE. Retirer un droit de création n'est
   * pas retirer un droit de signature — les deux sont indépendants dans SIGVEA,
   * et c'est précisément ce qui permet ce découplage sans toucher au circuit.
   *
   * La liste vient de ROLES_CREATION_VOL (@sigea/shared-types) et non d'un
   * littéral local : l'IHM lit la même constante, ce qui interdit qu'un bouton
   * s'affiche pour un rôle que le serveur refusera.
   */
  @Post()
  @Roles(...ROLES_CREATION_VOL)
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
   * rester consultable (FK Manifeste.vol_id en RESTRICT).
   *
   * Le COMBASE est MAINTENU ici, à dessein : il perd la planification, pas
   * l'autorité sur les mouvements aériens de sa base. Le COMEA et le COMGMO
   * s'y ajoutent, pour qu'un planificateur puisse défaire ce qu'il a fait.
   */
  @Patch(':id/annuler')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.COMBASE,
    RoleUtilisateur.COMGMO,
    RoleUtilisateur.COMEA,
  )
  @UseGuards(RolesGuard)
  annuler(@Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.volsService.annuler(id);
  }
}