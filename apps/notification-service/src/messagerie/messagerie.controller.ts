// apps/notification-service/src/messagerie/messagerie.controller.ts
//
// Supervision de la file. Lecture pour la chaîne RMIA et le commandant de base,
// relance réservée au secrétaire et à l'Adjoint Air — ce sont eux qui
// constatent qu'un voyageur n'a pas été prévenu, et eux qui corrigent le numéro.

import {
  Controller, Get, Post, Param, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, PerimetreGuard } from '@sigea/shared-auth';
import { Audit } from '@sigea/shared-audit';
import { RoleUtilisateur } from '@sigea/shared-types';
import { MessagerieService } from './messagerie.service';

@Controller('messagerie')
@UseGuards(JwtAuthGuard, PerimetreGuard)
export class MessagerieController {
  constructor(private readonly messagerie: MessagerieService) {}

  @Get('listes/:listeId')
  @Roles(
    RoleUtilisateur.SEC_ADJ_AIR,
    RoleUtilisateur.ADJ_AIR,
    RoleUtilisateur.COMRMIA,
    RoleUtilisateur.COMBASE,
    RoleUtilisateur.ADMIN,
  )
  @UseGuards(RolesGuard)
  etat(@Param('listeId', ParseUUIDPipe) listeId: string): Promise<unknown> {
    return this.messagerie.etat(listeId);
  }

  @Post('listes/:listeId/relance')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleUtilisateur.SEC_ADJ_AIR, RoleUtilisateur.ADJ_AIR, RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  @Audit('messagerie.relance')
  relancer(@Param('listeId', ParseUUIDPipe) listeId: string): Promise<unknown> {
    return this.messagerie.relancer(listeId);
  }
}