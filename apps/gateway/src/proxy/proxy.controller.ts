// apps/gateway/src/proxy/proxy.controller.ts
import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '@sigea/shared-auth';
import { ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  // ── AUTH (public) ──────────────────────────────────────────────────────────
  @All('auth')
  proxyAuthRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'auth');
  }
  @All('auth/*path')
  proxyAuth(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'auth');
  }

  // ── HEALTH endpoints (public — pour monitoring) ────────────────────────────
  @All('referentiel/health')
  proxyReferentielHealth(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'referentiel');
  }
  @All('vols/health')
  proxyVolHealth(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'vol');
  }
  @All('manifestes/health')
  proxyManifesteHealth(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'manifeste');
  }
  @All('validations/health')
  proxyValidationHealth(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'validation');
  }
  @All('cemaa/health')
  proxyCemaaHealth(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'cemaa');
  }
  @All('notifications/health')
  proxyNotifHealth(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'notification');
  }
  @All('pdf/health')
  proxyPdfHealth(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'pdf');
  }

  // ── REFERENTIEL ────────────────────────────────────────────────────────────
  @All('referentiel')
  @UseGuards(JwtAuthGuard)
  proxyReferentielRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'referentiel');
  }
  @All('referentiel/*path')
  @UseGuards(JwtAuthGuard)
  proxyReferentiel(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'referentiel');
  }

  // ── VOLS ───────────────────────────────────────────────────────────────────
  @All('vols')
  @UseGuards(JwtAuthGuard)
  proxyVolsRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'vol');
  }
  @All('vols/*path')
  @UseGuards(JwtAuthGuard)
  proxyVols(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'vol');
  }

  // ── MANIFESTES ─────────────────────────────────────────────────────────────
  @All('manifestes')
  @UseGuards(JwtAuthGuard)
  proxyManifestesRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'manifeste');
  }
  @All('manifestes/*path')
  @UseGuards(JwtAuthGuard)
  proxyManifestes(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'manifeste');
  }

  // ── VALIDATIONS ────────────────────────────────────────────────────────────
  @All('validations')
  @UseGuards(JwtAuthGuard)
  proxyValidationsRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'validation');
  }
  @All('validations/*path')
  @UseGuards(JwtAuthGuard)
  proxyValidations(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'validation');
  }

  // ── CEMAA ──────────────────────────────────────────────────────────────────
  @All('cemaa')
  @UseGuards(JwtAuthGuard)
  proxyCemaaRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'cemaa');
  }
  @All('cemaa/*path')
  @UseGuards(JwtAuthGuard)
  proxyCemaa(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'cemaa');
  }

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  @All('notifications')
  @UseGuards(JwtAuthGuard)
  proxyNotifRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'notification');
  }
  @All('notifications/*path')
  @UseGuards(JwtAuthGuard)
  proxyNotif(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'notification');
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  @All('pdf')
  @UseGuards(JwtAuthGuard)
  proxyPdfRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'pdf');
  }
  @All('pdf/*path')
  @UseGuards(JwtAuthGuard)
  proxyPdf(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'pdf');
  }

  // ── ADMIN ──────────────────────────────────────────────────────────────────
  @All('admin')
  @UseGuards(JwtAuthGuard)
  proxyAdminRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'referentiel');
  }
  @All('admin/*path')
  @UseGuards(JwtAuthGuard)
  proxyAdmin(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'referentiel');
  }
}