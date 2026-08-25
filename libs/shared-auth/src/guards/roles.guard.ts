import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleUtilisateur, JwtPayload, rolesEffectifs } from '@sigea/shared-types';
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
    if (!user) throw new ForbiddenException('Jeton absent ou invalide');

    const effectifs = rolesEffectifs(user);
    if (requiredRoles.some((r) => effectifs.includes(r))) return true;

    const detenus = effectifs.length > 1
      ? `${user.role} (+ intérim : ${effectifs.filter((r) => r !== user.role).join(', ')})`
      : user.role;

    throw new ForbiddenException(
      `Rôle requis : ${requiredRoles.join(' | ')}. Rôle actuel : ${detenus}`,
    );
  }
}