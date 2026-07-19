// apps/pdf-service/src/pdf/pdf.controller.ts
import {
  Controller, Get, Param, Query, Res, UseGuards, ParseUUIDPipe, Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@sigea/shared-auth';
import { JwtPayload } from '@sigea/shared-types';
import { PdfService } from './pdf.service';
import { ManifesteDataService } from './manifeste-data.service';

@Controller('pdf')
@UseGuards(AuthGuard('jwt'))
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

  constructor(
    private readonly pdf: PdfService,
    private readonly dataService: ManifesteDataService,
  ) {}

  /**
   * Aperçu (inline) ou téléchargement du manifeste.
   *   GET /api/pdf/manifeste/:id            → aperçu dans le navigateur
   *   GET /api/pdf/manifeste/:id?download=1 → téléchargement
   *
   * Le document rend TOUJOURS les 5 blocs de signature, signés ou en attente,
   * quel que soit l'avancement du circuit.
   */
  @Get('manifeste/:id')
  async manifeste(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
    @Query('download') download?: string,
  ): Promise<void> {
    const { data, niveau } = await this.dataService.charger(id, user);
    const buffer = await this.pdf.generateManifeste(data, niveau);

    const disposition = download ? 'attachment' : 'inline';
    const filename = `manifeste_${data.numero ?? id}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
      // Document sensible : ni cache disque, ni mise en cache proxy.
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
    });
    res.end(buffer);
  }
}