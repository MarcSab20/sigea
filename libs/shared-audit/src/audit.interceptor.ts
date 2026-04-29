import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_ACTION_KEY } from './audit.decorator';
import { JwtPayload } from '@sigea/shared-types';
import * as crypto from 'crypto';

interface AuditRecord {
  hash:      string;
  user_id:   string;
  base_id:   string;
  role:      string;
  action:    string;
  method:    string;
  path:      string;
  ip:        string;
  timestamp: string;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AUDIT');

  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, ctx.getHandler()) ?? 'unknown';
    const req = ctx.switchToHttp().getRequest<{ user?: JwtPayload; method: string; path: string; ip: string }>();
    const user = req.user;

    return next.handle().pipe(
      tap(() => {
        const record: Omit<AuditRecord, 'hash'> = {
          user_id: user?.sub   ?? 'anonymous',
          base_id: user?.base_id ?? 'none',
          role:    user?.role  ?? 'none',
          action,
          method:  req.method,
          path:    req.path,
          ip:      req.ip,
          timestamp: new Date().toISOString(),
        };
        const hash = crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex');
        this.logger.log(JSON.stringify({ ...record, hash }));
      }),
    );
  }
}
