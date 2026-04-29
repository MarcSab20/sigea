import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleUtilisateur[]>(ROLES_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user } = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Rôle requis : ${requiredRoles.join(' | ')}. Rôle actuel : ${user.role}`);
    }
    return true;
  }
}
