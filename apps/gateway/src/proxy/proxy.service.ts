// apps/gateway/src/proxy/proxy.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { Readable } from 'stream';

// En-têtes de requête à NE PAS retransmettre : dépendants de la connexion ou
// invalidés dès qu'on re-sérialise le corps (content-length).
const STRIPPED_REQUEST_HEADERS = [
  'host', 'content-length', 'connection', 'accept-encoding',
  'transfer-encoding', 'if-none-match', 'if-modified-since',
];

// En-têtes de RÉPONSE à relayer tels quels (préserve type + binaire + cache).
const FORWARDED_RESPONSE_HEADERS = [
  'content-type', 'content-disposition', 'content-length',
  'cache-control', 'etag', 'last-modified',
];

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async forward(req: Request, res: Response, service: string): Promise<void> {
    const baseUrl = this.config.get<string>(`gateway.services.${service}`) ?? '';

    let targetPath = req.path;
    if (targetPath.endsWith('/health')) targetPath = '/api/health';

    const qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    const targetUrl = `${baseUrl}${targetPath}${qs}`;

    const headers = { ...req.headers };
    for (const h of STRIPPED_REQUEST_HEADERS) delete headers[h];

    const method = req.method.toUpperCase();
    const hasBody =
      method !== 'GET' && method !== 'HEAD' &&
      req.body != null &&
      !(typeof req.body === 'object' && Object.keys(req.body).length === 0);

    this.logger.debug(`→ ${service}: ${method} ${targetUrl}${hasBody ? '' : ' (sans corps)'}`);

    try {
      // responseType 'stream' : on relaie le corps octet pour octet, sans jamais
      // le sérialiser en JSON. Un PDF (ou tout binaire) traverse donc la gateway
      // intact ; un JSON est renvoyé verbatim avec son content-type d'origine.
      const response = await firstValueFrom(
        this.http.request({
          method: req.method,
          url: targetUrl,
          data: hasBody ? req.body : undefined,
          headers,
          params: req.query,
          responseType: 'stream',
          validateStatus: (status) => status < 500,
        }),
      );

      // 304 → 200 corps vide (le client gère son cache)
      if (response.status === 304) {
        res.status(200).json({ status: 'ok' });
        return;
      }

      res.status(response.status);
      for (const h of FORWARDED_RESPONSE_HEADERS) {
        const v = response.headers[h];
        if (v !== undefined) res.setHeader(h, v as string);
      }

      // 204/205 : pas de corps.
      if (response.status === 204 || response.status === 205) {
        res.end();
        return;
      }

      // Relais en flux (streaming) — fidèle pour binaire ET texte.
      (response.data as Readable).pipe(res);
    } catch (error) {
      this.logger.error(`Proxy error → ${service}: ${String(error)}`);
      const axiosError = error as { response?: { status?: number } };
      const status = axiosError?.response?.status ?? 502;
      res.status(status).json({ message: 'Service indisponible' });
    }
  }
}