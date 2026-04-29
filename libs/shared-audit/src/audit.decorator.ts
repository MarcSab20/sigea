import { SetMetadata, applyDecorators, UseInterceptors } from '@nestjs/common';
import { AuditInterceptor } from './audit.interceptor';

export const AUDIT_ACTION_KEY = 'audit_action';

export const Audit = (action: string) =>
  applyDecorators(
    SetMetadata(AUDIT_ACTION_KEY, action),
    UseInterceptors(AuditInterceptor),
  );
