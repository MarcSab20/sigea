// apps/pdf-service/src/verification/numero-admin.controller.ts
//
// Consultation des numéros de contrôle — ADMINISTRATEUR UNIQUEMENT.
//
// Séparé du VerificationController, qui est public et sans garde. Les deux ne
// doivent jamais partager un contrôleur : une garde retirée par inadvertance
// sur une classe exposerait le clair au premier venu.
//
// Monté sous `pdf/controle` : la passerelle route déjà `pdf/*` vers ce service
// derrière JwtAuthGuard, aucune règle de proxy n'est à ajouter.

import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { NumeroControleService } from './numero-controle.service';

@ApiTags('Numéros de contrôle (administration)')
@Controller('pdf/controle')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleUtilisateur.ADMIN)
export class NumeroAdminController {
  constructor(private readonly numeros: NumeroControleService) {}

  /**
   * Numéro en clair d'un manifeste donné.
   *
   * Chaque appel est journalisé en niveau WARN par le service : la
   * consultation d'un numéro est un acte de contrôle, pas une lecture de
   * routine, et doit ressortir dans les journaux sans avoir à les filtrer.
   */
  @Get('manifeste/:id')
  @ApiOperation({ summary: "Révéler le numéro de contrôle d'un manifeste" })
  reveler(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.numeros.reveler(id, user.sub);
  }

  /**
   * Recherche inverse — le cas d'usage réel du dispositif.
   *
   * Un contrôleur au sol téléphone au PC et dicte le numéro relevé sur un
   * document. L'administrateur le saisit ici et voit immédiatement à quel vol,
   * quelle base et quel état il correspond. Si rien ne sort, le document est
   * un faux.
   *
   * Le numéro COMPLET est exigé : la recherche par fragment est refusée côté
   * service, pour que cet endpoint ne devienne pas un oracle permettant de
   * reconstituer un numéro par approximations successives.
   */
  @Get('rechercher')
  @ApiOperation({ summary: 'Retrouver un manifeste à partir de son numéro de contrôle' })
  rechercher(
    @Query('code') code: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.numeros.rechercher(code ?? '', user.sub);
  }
}