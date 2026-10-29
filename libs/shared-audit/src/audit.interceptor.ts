import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_ACTION_KEY } from './audit.decorator';
import { AuditService } from './audit.service';
import { JwtPayload } from '@sigea/shared-types';

/**
 * Interception d'audit.
 *
 * ── LE DÉFAUT CORRIGÉ ─────────────────────────────────────────────────────
 * La version précédente construisait consciencieusement l'enregistrement,
 * calculait son empreinte SHA-256… puis appelait `this.logger.log()`. C'est
 * un `console.log`. Rien n'était jamais écrit dans la table `AuditLog`.
 *
 * `AuditService.log()` — juste à côté, dans la même bibliothèque — sait écrire
 * en base. Il n'était appelé par personne. C'est la raison pour laquelle
 * l'onglet « Journal d'audit » restait désespérément vide : la route
 * `/admin/audit-logs` interrogeait correctement une table que rien
 * n'alimentait.
 *
 * ── DEUX PIÈGES ÉVITÉS AU PASSAGE ─────────────────────────────────────────
 *
 * 1. `AuditLog.user_id` porte une CLÉ ÉTRANGÈRE vers `Utilisateur`. L'ancien
 *    code prévoyait `user_id: 'anonymous'` en repli — cette écriture aurait
 *    échoué sur violation de contrainte. Une requête non authentifiée n'est
 *    donc pas journalisée en base ; elle reste tracée dans le flux de logs,
 *    où sa place est meilleure.
 *
 * 2. L'écriture ne doit JAMAIS faire échouer la requête métier. Un incident
 *    sur la base d'audit ne peut pas empêcher un manifeste d'être soumis. La
 *    persistance est donc lancée sans être attendue, et son échec est capté
 *    et signalé dans les logs.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AUDIT');

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, ctx.getHandler()) ?? 'unknown';

    const req = ctx.switchToHttp().getRequest<{
      user?: JwtPayload;
      method: string;
      path?: string;
      originalUrl?: string;
      url?: string;
      ip?: string;
      params?: Record<string, string>;
    }>();

    const user = req.user;
    const chemin = req.path ?? req.originalUrl ?? req.url ?? '';

    return next.handle().pipe(
      tap(() => {
        // `resource` : l'identifiant de l'objet touché quand la route en porte
        // un. Sans lui, une ligne « manifeste.soumettre » ne dit pas LEQUEL.
        const resource = req.params?.id ?? req.params?.manifesteId ?? null;

        const trace = {
          user_id: user?.sub ?? 'anonymous',
          base_id: user?.base_id ?? 'none',
          role: user?.role ?? 'none',
          action,
          method: req.method,
          path: chemin,
          ip: req.ip ?? null,
          resource,
        };

        // Trace applicative : conservée telle quelle. Elle part vers la sortie
        // standard, donc vers l'agrégateur de logs, et couvre aussi les cas
        // que la base ne peut pas recevoir.
        this.logger.log(JSON.stringify({ ...trace, timestamp: new Date().toISOString() }));

        // Persistance : seulement pour un utilisateur authentifié (voir §1).
        if (!user?.sub) return;

        void this.audit
          .log({
            user_id: user.sub,
            base_id: user.base_id,
            role: user.role,
            action,
            resource: resource ?? chemin,
            timestamp: new Date().toISOString(),
            ip: req.ip,
            method: req.method,
            path: chemin,
          })
          .catch((e: unknown) => {
            // Volontairement non propagé : la requête métier a déjà réussi.
            this.logger.error(
              `Écriture du journal d'audit impossible (action=${action}) : ${String(e)}`,
            );
          });
      }),
    );
  }
}