// apps/vol-service/src/diffusion/diffusion.controller.ts

import {
  Controller, Post, Patch, Body, Param, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { Audit } from '@sigea/shared-audit';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { DiffusionService } from './diffusion.service';
import { AllocationQuotaDto, AjustementQuotaDto } from '../vols/dto/allocation-quota.dto';

/**
 * Allocation des quotas et diffusion — réservées au SCOPS.
 *
 * L'ADMIN est admis en secours d'exploitation, et c'est le seul autre rôle :
 * aucune autorité de base ou de RMIA ne doit pouvoir s'allouer des places à
 * elle-même. C'est précisément la séparation qu'introduit la directive en
 * confiant la ressource au sous-chef opérations et la sélection aux RMIA.
 */
@Controller('vols')
@UseGuards(JwtAuthGuard)
export class DiffusionController {
  constructor(private readonly diffusion: DiffusionService) {}

  @Post(':volId/diffusion')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleUtilisateur.SCOPS, RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  @Audit('vol.diffusion')
  allouer(
    @Param('volId', ParseUUIDPipe) volId: string,
    @Body() dto: AllocationQuotaDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.diffusion.allouer(volId, dto, user);
  }

  @Patch(':volId/itineraire/:etapeId/quota')
  @Roles(RoleUtilisateur.SCOPS, RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  @Audit('vol.quota_ajuste')
  ajuster(
    @Param('volId', ParseUUIDPipe) volId: string,
    @Param('etapeId', ParseUUIDPipe) etapeId: string,
    @Body() dto: AjustementQuotaDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.diffusion.ajuster(volId, etapeId, dto, user);
  }
}