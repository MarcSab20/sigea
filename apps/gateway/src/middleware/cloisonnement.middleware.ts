import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from '@sigea/shared-types';

@Injectable()
export class CloisonnementMiddleware implements NestMiddleware {
  use(req: Request & { user?: JwtPayload }, res: Response, next: NextFunction): void {
    const user = req.user;
    if (!user) return next();

    // Injection transparente du contexte dans les headers sortants
    req.headers['x-base-id']   = user.base_id;
    req.headers['x-user-id']   = user.sub;
    req.headers['x-user-role'] = user.role;

    next();
  }
}
