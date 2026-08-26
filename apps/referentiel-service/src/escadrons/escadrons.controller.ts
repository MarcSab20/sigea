// apps/referentiel-service/src/escadrons/escadrons.controller.ts
//
// ── Deux corrections par rapport à la version du dépôt ──
//
// 1. PRÉFIXE DE ROUTE : 'escadrons' → 'referentiel/escadrons'.
//    La gateway ne proxifie que des préfixes déclarés (proxy.controller.ts).
//    Elle connaît `referentiel` et `referentiel/*path` ; elle ne connaît pas
//    `escadrons`. Monté sur 'escadrons', ce contrôleur répondait correctement
//    en direct sur le port 3002, et 404 à travers la gateway — c'est-à-dire
//    pour tous les appels réels du frontend.
//    Le commentaire du DTO create-utilisateur.dto.ts documentait déjà l'URL
//    attendue : GET /api/referentiel/escadrons?base_id=…&actif=1.
//
// 2. IMPORT DU DTO : './dto/escadron.dto' → './dto/escadrons.dto'.
//    Le fichier s'appelle escadrons.dto.ts (pluriel). L'import échouait à la
//    compilation.

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@sigea/shared-auth';
import { RoleUtilisateur } from '@sigea/shared-types';
import { EscadronsService, EscadronVue } from './escadrons.service';
import { CreateEscadronDto, UpdateEscadronDto } from './dto/escadrons.dto';

@Controller('referentiel/escadrons')
@UseGuards(JwtAuthGuard)
export class EscadronsController {
  constructor(private readonly escadrons: EscadronsService) {}

  /**
   * Lecture ouverte à tout utilisateur authentifié.
   *
   * Le référentiel des escadrons n'est pas une donnée sensible : c'est un
   * organigramme. Le cloisonner par base compliquerait l'IHM d'administration
   * sans rien protéger. Les DONNÉES opérationnelles restent, elles, cloisonnées.
   *
   * `base_id` accepte un identifiant ou un code_base (« BA101 »).
   */
  @Get()
  findAll(
    @Query('base_id') base_id?: string,
    @Query('actif')   actif?: string,
  ): Promise<EscadronVue[]> {
    return this.escadrons.findAll(base_id, actif === '1' || actif === 'true');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EscadronVue> {
    return this.escadrons.findOne(id);
  }

  // ── Écriture : administrateur uniquement ──

  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  create(@Body() dto: CreateEscadronDto): Promise<EscadronVue> {
    return this.escadrons.create(dto);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEscadronDto,
  ): Promise<EscadronVue> {
    return this.escadrons.update(id, dto);
  }

  /** Désactivation logique. Aucune suppression physique n'est exposée. */
  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  desactiver(@Param('id', ParseUUIDPipe) id: string): Promise<EscadronVue> {
    return this.escadrons.desactiver(id);
  }
}