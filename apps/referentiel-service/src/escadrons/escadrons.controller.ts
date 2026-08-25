// apps/referentiel-service/src/escadrons/escadrons.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@sigea/shared-auth';
import { RoleUtilisateur } from '@sigea/shared-types';
import { EscadronsService } from './escadrons.service';
import { CreateEscadronDto, UpdateEscadronDto } from './dto/escadron.dto';

@Controller('escadrons')
@UseGuards(JwtAuthGuard)
export class EscadronsController {
  constructor(private readonly escadrons: EscadronsService) {}

  /**
   * Lecture ouverte à tout utilisateur authentifié.
   *
   * Le référentiel des escadrons n'est pas une donnée sensible : c'est un
   * organigramme. Le cloisonner par base compliquerait l'IHM d'administration
   * sans rien protéger. Les DONNÉES opérationnelles restent, elles, cloisonnées.
   */
  @Get()
  findAll(
    @Query('base_id') base_id?: string,
    @Query('actif')   actif?: string,
  ): Promise<unknown[]> {
    return this.escadrons.findAll(base_id, actif === '1' || actif === 'true');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.escadrons.findOne(id);
  }

  // ── Écriture : administrateur uniquement ──

  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  create(@Body() dto: CreateEscadronDto): Promise<unknown> {
    return this.escadrons.create(dto);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEscadronDto,
  ): Promise<unknown> {
    return this.escadrons.update(id, dto);
  }

  /** Désactivation logique. Aucune suppression physique n'est exposée. */
  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  desactiver(@Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.escadrons.desactiver(id);
  }
}