import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '@sigea/shared-auth';
import { ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('auth/*')
  proxyAuth(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'auth');
  }

  @All('vols/*')
  @UseGuards(JwtAuthGuard)
  proxyVols(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'vol');
  }

  @All('manifestes/*')
  @UseGuards(JwtAuthGuard)
  proxyManifestes(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'manifeste');
  }

  @All('validations/*')
  @UseGuards(JwtAuthGuard)
  proxyValidations(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'validation');
  }

  @All('cemaa/*')
  @UseGuards(JwtAuthGuard)
  proxyCemaa(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'cemaa');
  }

  @All('pdf/*')
  @UseGuards(JwtAuthGuard)
  proxyPdf(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'pdf');
  }

  @All('referentiel/*')
  @UseGuards(JwtAuthGuard)
  proxyReferentiel(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxyService.forward(req, res, 'referentiel');
  }
}
