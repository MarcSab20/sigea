// apps/pdf-service/src/archives/archive.controller.ts
import {
  Controller, Get, Post, Param, Query, Res, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolesGuard, Roles, CurrentUser } from '@sigea/shared-auth';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { ArchiveService } from './archive.service';

@ApiTags('Archives')
@Controller('pdf/archives')
@UseGuards(AuthGuard('jwt'))
export class ArchiveController {
  constructor(private readonly archives: ArchiveService) {}

  /**
   * Onglet « Archivé ».
   *
   * Ouvert à tout utilisateur authentifié, MAIS cloisonné par base dans le
   * service : un chef d'escale de la BA201 ne voit que les archives de la
   * BA201. Le cloisonnement n'est pas ici, dans une garde de rôle, mais dans
   * la requête SQL — c'est le seul endroit où il ne peut pas être contourné
   * par un paramètre forgé.
   */
  @Get()
  @ApiOperation({ summary: 'Lister les manifestes archivés' })
  lister(
    @CurrentUser() user: JwtPayload,
    @Query('base_id') base_id?: string,
    @Query('vol_id')  vol_id?: string,
    @Query('q')       q?: string,
    @Query('page')    page?: string,
    @Query('taille')  taille?: string,
  ): Promise<unknown> {
    return this.archives.lister(user, {
      base_id, vol_id, q,
      page:   page   ? parseInt(page, 10)   : undefined,
      taille: taille ? parseInt(taille, 10) : undefined,
    });
  }

  /**
   * Téléchargement.
   *
   * L'en-tête `X-SIGVEA-Archive` distingue l'original de la régénération de
   * secours. Il est indispensable : un PDF régénéré est visuellement identique
   * mais n'est PAS la pièce archivée. Sans ce signal, l'IHM présenterait une
   * reconstitution comme une pièce d'origine — et personne ne saurait jamais
   * que le volume a lâché.
   */
  @Get(':id/telecharger')
  @ApiOperation({ summary: 'Télécharger un manifeste archivé' })
  async telecharger(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const r = await this.archives.telecharger(id, user);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${r.fichier}"`,
      'Content-Length': r.taille.toString(),
      'X-SIGVEA-Archive': r.secours ? 'REGENERE' : 'ORIGINAL',
      ...(r.motif ? { 'X-SIGVEA-Archive-Motif': encodeURIComponent(r.motif) } : {}),
      // Document sensible : ni cache disque, ni mise en cache proxy.
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
    });

    if (r.flux) {
      // Le flux est détruit si le client raccroche : sans cela, un descripteur
      // de fichier resterait ouvert par téléchargement interrompu.
      res.on('close', () => r.flux?.destroy());
      r.flux.pipe(res);
      return;
    }
    res.end(r.tampon);
  }

  /**
   * Contrôle d'intégrité — administrateur uniquement.
   *
   * À déclencher périodiquement (tâche planifiée). Sans balayage régulier, une
   * corruption de volume ne se découvre qu'au moment où l'on a besoin du
   * document, c'est-à-dire toujours trop tard.
   */
  @Post('verifier-integrite')
  @Roles(RoleUtilisateur.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Vérifier l'intégrité des archives stockées" })
  verifier(@Query('limite') limite?: string): Promise<unknown> {
    return this.archives.verifierIntegrite(limite ? parseInt(limite, 10) : 200);
  }
}