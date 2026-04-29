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
    const baseUrl: string = this.config.get(`gateway.services.${service}`) ?? '';
    const targetUrl = `${baseUrl}${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

    try {
      const response = await firstValueFrom(
        this.http.request({
          method: req.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
          url: targetUrl,
          data: req.body,
          headers: { ...req.headers, host: undefined },
          params: req.query,
        }),
      );
      res.status(response.status).json(response.data);
    } catch (error: unknown) {
      this.logger.error(`Proxy error → ${service}: ${String(error)}`);
      const status = (error as { response?: { status?: number } })?.response?.status ?? 502;
      const data   = (error as { response?: { data?: unknown } })?.response?.data ?? { message: 'Service indisponible' };
      res.status(status).json(data);
    }
  }
}
