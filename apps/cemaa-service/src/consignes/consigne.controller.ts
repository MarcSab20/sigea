// apps/cemaa-service/src/consignes/consigne.controller.ts
//
// Deux contrôleurs, un service.
//
// Le préfixe de route et le rôle exigé sont les SEULES différences entre les
// deux espaces. Une classe de base abstraite porte le comportement ; chaque
// sous-classe se réduit à ses décorateurs.
//
// Pourquoi deux classes plutôt qu'un contrôleur unique déduisant l'autorité du
// rôle porté par le jeton ? Parce que la garde de rôle serait alors
// `@Roles(CEMAA, MAGE)` sur une route unique, et qu'une erreur de déduction
// ferait écrire une consigne MAGE dans le compartiment CEMAA. Ici, la route
// EST le compartiment : il n'y a rien à déduire, donc rien à se tromper.

import {
  Controller, Post, Patch, Get, Body, Param, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload, AutoriteCentrale } from '@sigea/shared-types';
import { Audit } from '@sigea/shared-audit';
import { ConsigneService } from './consigne.service';
import { CreateConsigneDto, UpdateConsigneDto } from './dto/create-consigne.dto';

abstract class ConsigneControllerBase {
  protected abstract readonly autorite: AutoriteCentrale;

  constructor(protected readonly consigneService: ConsigneService) {}

  protected creer(dto: CreateConsigneDto, user: JwtPayload): Promise<unknown> {
    return this.consigneService.create(dto, user.sub, this.autorite);
  }

  protected modifier(id: string, dto: UpdateConsigneDto, user: JwtPayload): Promise<unknown> {
    return this.consigneService.update(id, dto, user.sub, this.autorite);
  }

  protected parVol(volId: string): Promise<unknown[]> {
    return this.consigneService.findByVol(volId, this.autorite);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Espace CEMAA — comportement inchangé
// ═══════════════════════════════════════════════════════════════════════════

@Controller('cemaa/consignes')
@UseGuards(JwtAuthGuard)
export class ConsigneCemaaController extends ConsigneControllerBase {
  protected readonly autorite = AutoriteCentrale.CEMAA;

  constructor(consigneService: ConsigneService) {
    super(consigneService);
  }

  @Post()
  @Roles(RoleUtilisateur.CEMAA)
  @UseGuards(RolesGuard)
  @Audit('cemaa.consigne.create')
  create(@Body() dto: CreateConsigneDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.creer(dto, user);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.CEMAA)
  @UseGuards(RolesGuard)
  @Audit('cemaa.consigne.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsigneDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.modifier(id, dto, user);
  }

  // Métadonnées des consignes d'un vol (contenu chiffré NON déchiffré ici).
  @Get('vol/:volId')
  @Audit('cemaa.consigne.view')
  findByVol(@Param('volId', ParseUUIDPipe) volId: string): Promise<unknown[]> {
    return this.parVol(volId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Espace MAGE — mêmes comportements, compartiment distinct
// ═══════════════════════════════════════════════════════════════════════════

@Controller('mage/consignes')
@UseGuards(JwtAuthGuard)
export class ConsigneMageController extends ConsigneControllerBase {
  protected readonly autorite = AutoriteCentrale.MAGE;

  constructor(consigneService: ConsigneService) {
    super(consigneService);
  }

  @Post()
  @Roles(RoleUtilisateur.MAGE)
  @UseGuards(RolesGuard)
  @Audit('mage.consigne.create')
  create(@Body() dto: CreateConsigneDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.creer(dto, user);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.MAGE)
  @UseGuards(RolesGuard)
  @Audit('mage.consigne.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsigneDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.modifier(id, dto, user);
  }

  @Get('vol/:volId')
  @Audit('mage.consigne.view')
  findByVol(@Param('volId', ParseUUIDPipe) volId: string): Promise<unknown[]> {
    return this.parVol(volId);
  }
}