// apps/gateway/src/proxy/proxy.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';

// En-têtes à NE PAS retransmettre tels quels : soit dépendants de la connexion,
// soit invalidés dès qu'on re-sérialise le corps (content-length !). Les laisser
// passer corrompait les requêtes PATCH sans corps → 400 en aval.
const STRIPPED_HEADERS = [
  'host',
  'content-length',
  'connection',
  'accept-encoding',
  'transfer-encoding',
  'if-none-match',
  'if-modified-since',
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

    // Réécriture /health uniquement — tous les autres paths sont transmis tels quels
    let targetPath = req.path;
    if (targetPath.endsWith('/health')) {
      targetPath = '/api/health';
    }

    const qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    const targetUrl = `${baseUrl}${targetPath}${qs}`;

    // En-têtes assainis : axios recalculera content-length selon le corps réel.
    // (type inféré = IncomingHttpHeaders, compatible axios ; on retire des clés.)
    const headers = { ...req.headers };
    for (const h of STRIPPED_HEADERS) delete headers[h];

    // Ne transmettre un corps que s'il en existe réellement un. Un PATCH/POST
    // sans corps (soumettre, annuler, read-all…) ne doit PAS envoyer `{}`.
    const method = req.method.toUpperCase();
    const hasBody =
      method !== 'GET' &&
      method !== 'HEAD' &&
      req.body != null &&
      !(typeof req.body === 'object' && Object.keys(req.body).length === 0);

    this.logger.debug(`→ ${service}: ${method} ${targetUrl}${hasBody ? '' : ' (sans corps)'}`);

    try {
      const response = await firstValueFrom(
        this.http.request({
          method: req.method,
          url: targetUrl,
          data: hasBody ? req.body : undefined,
          headers,
          params: req.query,
          // Accepter 3xx/4xx comme réponses valides (on relaie le statut aval).
          validateStatus: (status) => status < 500,
        }),
      );

      // 304 → renvoyer 200 avec corps vide (le client gère son cache)
      if (response.status === 304) {
        res.status(200).json({ status: 'ok' });
        return;
      }

      // 204/205 : pas de corps à sérialiser.
      if (response.status === 204 || response.status === 205) {
        res.status(response.status).end();
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