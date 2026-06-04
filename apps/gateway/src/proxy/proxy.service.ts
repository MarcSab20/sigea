// apps/gateway/src/proxy/proxy.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async forward(req: Request, res: Response, service: string): Promise<void> {
    const baseUrl = this.config.get<string>(`gateway.services.${service}`) ?? '';

    // Réécriture /health uniquement — tous les autres paths sont transmis tels quels
    let targetPath = req.path;
    if (targetPath.endsWith('/health')) {
      targetPath = '/api/health';
    }

    const qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    const targetUrl = `${baseUrl}${targetPath}${qs}`;

    this.logger.debug(`→ ${service}: ${req.method} ${targetUrl}`);

    try {
      const response = await firstValueFrom(
        this.http.request({
          method: req.method,
          url: targetUrl,
          data: req.body,
          // Supprimer les headers de cache pour éviter les 304
          headers: {
            ...req.headers,
            host: undefined,
            'if-none-match': undefined,
            'if-modified-since': undefined,
          },
          params: req.query,
          // Accepter 304 comme succès valide
          validateStatus: (status) => status < 500,
        }),
      );

      // 304 → renvoyer 200 avec corps vide (le client gère son cache)
      if (response.status === 304) {
        res.status(200).json({ status: 'ok' });
        return;
      }

      res.status(response.status).json(response.data);
    } catch (error) {
      this.logger.error(`Proxy error → ${service}: ${String(error)}`);
      const axiosError = error as { response?: { status?: number; data?: unknown } };
      const status = axiosError?.response?.status ?? 502;
      const data = axiosError?.response?.data ?? { message: 'Service indisponible' };
      res.status(status).json(data);
    }
  }
}