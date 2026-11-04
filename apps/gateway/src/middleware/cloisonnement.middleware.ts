import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from '@sigea/shared-types';

/**
 * Injecte le contexte d'habilitation dans les en-têtes transmis aux services.
 *
 * ── Ce qui change ──
 * `base_id` peut désormais être nul : la chaîne RMIA n'est rattachée à aucune
 * base. Un en-tête `x-base-id` vide serait pire qu'absent — les services le
 * liraient comme une chaîne, et la compareraient à une base réelle.
 *
 * L'en-tête n'est donc posé QUE s'il a une valeur, et `x-rmia` apparaît à
 * côté. C'est exactement ce que PerimetreGuard lit.
 *
 * ── Point de sécurité ──
 * Les en-têtes sont ÉCRASÉS, jamais complétés. Un client qui enverrait lui-même
 * `x-base-id` ou `x-rmia` verrait sa valeur remplacée par celle du jeton. La
 * suppression explicite ci-dessous couvre le cas où le jeton n'a pas la valeur
 * correspondante : sans elle, un en-tête forgé survivrait au passage.
 */
@Injectable()
export class CloisonnementMiddleware implements NestMiddleware {
  use(req: Request & { user?: JwtPayload }, res: Response, next: NextFunction): void {
    const user = req.user;
    if (!user) return next();

    if (user.base_id) {
      req.headers['x-base-id'] = user.base_id;
    } else {
      delete req.headers['x-base-id'];
    }

    if (user.rmia) {
      req.headers['x-rmia'] = String(user.rmia);
    } else {
      delete req.headers['x-rmia'];
    }

    req.headers['x-user-id']   = user.sub;
    req.headers['x-user-role'] = user.role;

    next();
  }
}