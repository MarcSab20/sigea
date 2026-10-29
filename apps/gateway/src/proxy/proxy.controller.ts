// apps/gateway/src/proxy/proxy.controller.ts
//
// Les routes `validations/*` ont DISPARU : validation-service est supprimé.
// Elles sont remplacées par `listes/*`, qui porte le circuit complet, et par
// `potentialites/*` pour le vivier.

import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '@sigea/shared-auth';
import { ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  // ── AUTH (public) ────────────────────────────────────────────────────────
  @All('auth')
  proxyAuthRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'auth');
  }
  @All('auth/*path')
  proxyAuth(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'auth');
  }

  // ── HEALTH (public, supervision) ─────────────────────────────────────────
  @All('referentiel/health')
  hReferentiel(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'referentiel');
  }
  @All('vols/health')
  hVol(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'vol');
  }
  @All('listes/health')
  hListe(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'liste');
  }
  @All('manifestes/health')
  hManifeste(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'manifeste');
  }
  @All('cemaa/health')
  hCemaa(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'cemaa');
  }
  @All('notifications/health')
  hNotif(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'notification');
  }
  @All('pdf/health')
  hPdf(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'pdf');
  }

  // ── REFERENTIEL ──────────────────────────────────────────────────────────
  @All('referentiel')
  @UseGuards(JwtAuthGuard)
  referentielRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'referentiel');
  }
  @All('referentiel/*path')
  @UseGuards(JwtAuthGuard)
  referentiel(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'referentiel');
  }

  // ── VOLS (planification, diffusion SCOPS) ────────────────────────────────
  @All('vols')
  @UseGuards(JwtAuthGuard)
  volsRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'vol');
  }
  @All('vols/*path')
  @UseGuards(JwtAuthGuard)
  vols(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'vol');
  }

  // ── LISTES (constitution, discrimination, circuit) ───────────────────────
  @All('listes')
  @UseGuards(JwtAuthGuard)
  listesRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'liste');
  }
  @All('listes/*path')
  @UseGuards(JwtAuthGuard)
  listes(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'liste');
  }

  // ── POTENTIALITES (vivier du secrétaire) ─────────────────────────────────
  @All('potentialites')
  @UseGuards(JwtAuthGuard)
  potentialitesRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'liste');
  }
  @All('potentialites/*path')
  @UseGuards(JwtAuthGuard)
  potentialites(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'liste');
  }

  // ── MANIFESTES (lecture, impression) ─────────────────────────────────────
  @All('manifestes')
  @UseGuards(JwtAuthGuard)
  manifestesRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'manifeste');
  }
  @All('manifestes/*path')
  @UseGuards(JwtAuthGuard)
  manifestes(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'manifeste');
  }

  @All('exploitation')
  @UseGuards(JwtAuthGuard)
  exploitationRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'manifeste');
  }
  @All('exploitation/*path')
  @UseGuards(JwtAuthGuard)
  exploitation(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'manifeste');
  }

  // ── AUTORITES CENTRALES — espace conservé pour les urgences ──────────────
  @All('cemaa')
  @UseGuards(JwtAuthGuard)
  cemaaRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'cemaa');
  }
  @All('cemaa/*path')
  @UseGuards(JwtAuthGuard)
  cemaa(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'cemaa');
  }
  @All('mage')
  @UseGuards(JwtAuthGuard)
  mageRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'cemaa');
  }
  @All('mage/*path')
  @UseGuards(JwtAuthGuard)
  mage(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'cemaa');
  }

  // ── NOTIFICATIONS ────────────────────────────────────────────────────────
  @All('notifications')
  @UseGuards(JwtAuthGuard)
  notifRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'notification');
  }
  @All('notifications/*path')
  @UseGuards(JwtAuthGuard)
  notif(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'notification');
  }
  @All('messagerie')
  @UseGuards(JwtAuthGuard)
  messagerieRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'notification');
  }
  @All('messagerie/*path')
  @UseGuards(JwtAuthGuard)
  messagerie(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'notification');
  }

  // ── PDF ──────────────────────────────────────────────────────────────────
  @All('pdf')
  @UseGuards(JwtAuthGuard)
  pdfRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'pdf');
  }
  @All('pdf/*path')
  @UseGuards(JwtAuthGuard)
  pdf(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'pdf');
  }

  // ── VERIFICATION PUBLIQUE ────────────────────────────────────────────────
  //
  // SANS JwtAuthGuard, délibérément : point de scan du QR imprimé sur le
  // manifeste, utilisé par un contrôleur au sol sans compte SIGEA. Le
  // pdf-service n'y renvoie qu'un verdict d'authenticité, jamais le contenu.
  @All('verification/*path')
  verification(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'pdf');
  }

  // ── ADMIN ────────────────────────────────────────────────────────────────
  @All('admin')
  @UseGuards(JwtAuthGuard)
  adminRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'referentiel');
  }
  @All('admin/*path')
  @UseGuards(JwtAuthGuard)
  admin(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'referentiel');
  }
}