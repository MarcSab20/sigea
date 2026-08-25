import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { JwtPayload, rolesEffectifs, estAutoriteCentrale } from '@sigea/shared-types';

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

    // ── Autorités centrales : lecture seule sur toutes les bases ──
    //
    // CEMAA et MAGE. Le test passe par `estAutoriteCentrale` et non par une
    // comparaison à RoleUtilisateur.CEMAA : ajouter une autorité demain ne
    // demandera aucune modification ici.
    //
    // `rolesEffectifs` couvre en outre le cas d'une délégation : un suppléant
    // exerçant l'intérim d'une autorité centrale bénéficie du même périmètre.
    if (rolesEffectifs(user).some(estAutoriteCentrale)) {
      if (req.method !== 'GET') {
        throw new ForbiddenException(
          'Autorité centrale : accès en écriture non autorisé via ce circuit',
        );
      }
      return true;
    }

    // Cloisonnement strict : base_id du token vs base_id de la ressource.
    // req.body / req.params / req.headers peuvent être absents (ex. GET sans
    // corps) : chaînage optionnel obligatoire, sinon TypeError → 500 sur les GET.
    const resourceBaseId =
      req.params?.['base_id'] ?? req.body?.['base_id'] ?? req.headers?.['x-base-id'];
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