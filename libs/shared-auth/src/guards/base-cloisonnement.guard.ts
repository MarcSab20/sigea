import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { RoleUtilisateur, JwtPayload } from '@sigea/shared-types';

@Injectable()
export class BaseCloisonnementGuard implements CanActivate {
  private readonly logger = new Logger(BaseCloisonnementGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      user: JwtPayload; params: Record<string, string>; body: Record<string, string>;
      headers: Record<string, string>; method: string; ip: string;
    }>();
    const user = req.user;
    if (!user) return false;

    // CEMAA : lecture seule sur toutes les bases
    if (user.role === RoleUtilisateur.CEMAA) {
      if (req.method !== 'GET') {
        throw new ForbiddenException('CEMAA : accès en écriture non autorisé via ce circuit');
      }
      return true;
    }

    // Cloisonnement strict : base_id du token vs base_id de la ressource
    const resourceBaseId = req.params['base_id'] ?? req.body['base_id'] ?? req.headers['x-base-id'];
    if (resourceBaseId && resourceBaseId !== user.base_id) {
      this.logger.warn(
        `Tentative cross-base : user=${user.sub} base_user=${user.base_id} base_ressource=${resourceBaseId} ip=${req.ip}`,
      );
      throw new ForbiddenException(
        `Accès refusé : vous ne pouvez accéder qu'aux ressources de votre base (${user.base_id})`,
      );
    }
    return true;
  }
}
