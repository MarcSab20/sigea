// apps/pdf-service/src/pdf/pdf.controller.ts

import {
  Controller, Get, Param, Query, Res, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@sigea/shared-auth';
import { JwtPayload } from '@sigea/shared-types';
import { PdfService } from './pdf.service';
import { ManifesteDataService } from './manifeste-data.service';
import { ListeDataService } from './liste-data.service';

@Controller('pdf')
@UseGuards(AuthGuard('jwt'))
export class PdfController {
  constructor(
    private readonly pdf: PdfService,
    private readonly manifestes: ManifesteDataService,
    private readonly listes: ListeDataService,
  ) {}

  /**
   * Manifeste d'embarquement.
   *   GET /api/pdf/manifeste/:id            → aperçu dans le navigateur
   *   GET /api/pdf/manifeste/:id?download=1 → téléchargement
   *
   * Un seul bloc de signature, en pied de document : celui du commandant de
   * bord. Imprimable avant son visa — le tampon est alors « EN ATTENTE », et le
   * filigrane « DIFFUSION RESTREINTE » rappelle que le tirage n'est pas
   * définitif.
   */
  @Get('manifeste/:id')
  async manifeste(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
    @Query('download') download?: string,
  ): Promise<void> {
    const { data, niveau } = await this.manifestes.charger(id, user);
    const buffer = await this.pdf.generateManifeste(data, niveau);
    this.envoyer(res, buffer, `manifeste_${data.numero}.pdf`, download);
  }

  /**
   * Liste hiérarchisée, suivie de la liste d'attente sur page séparée.
   *
   * La liste d'attente est omise pour les destinataires qui n'y ont pas droit —
   * le filtrage est fait par ListeDataService, pas ici : une route ne doit pas
   * porter de règle métier.
   */
  @Get('liste/:id')
  async liste(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
    @Query('download') download?: string,
  ): Promise<void> {
    const { data, niveau } = await this.listes.charger(id, user);
    const buffer = await this.pdf.generateListe(data, niveau);
    const nom = `liste_${data.vol?.numero_mission ?? data.id}_E${data.point?.ordre ?? 0}.pdf`;
    this.envoyer(res, buffer, nom, download);
  }

  private envoyer(res: Response, buffer: Buffer, filename: string, download?: string): void {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
      // Document sensible : ni cache disque, ni mise en cache proxy.
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
    });
    res.end(buffer);
  }
}