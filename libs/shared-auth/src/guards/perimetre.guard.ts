// libs/shared-auth/src/guards/perimetre.guard.ts
//
// Cloisonnement à trois niveaux : base, RMIA, national.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER REMPLACE BaseCloisonnementGuard
// ═══════════════════════════════════════════════════════════════════════════
// L'ancienne garde ne connaissait que deux cas : « autorité centrale, lecture
// partout » ou « cloisonné par base_id ». La chaîne RMIA n'entre dans ni l'un
// ni l'autre : l'Adjoint Air de la RMIA 2 n'est pas national, et son périmètre
// n'est pas une base mais sept bases réparties sur deux régions administratives.
// Appliquer l'ancienne garde à ces rôles revenait à leur donner accès aux seules
// ressources de leur base d'affectation — c'est-à-dire à presque rien.
//
// La directive exige par ailleurs explicitement que « les données de la RMIA X
// ne soient pas manipulées par la RMIA Y ». C'est ce que fait la branche RMIA
// ci-dessous, en écriture comme en lecture.

import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger,
} from '@nestjs/common';
import {
  JwtPayload, Rmia, RoleUtilisateur,
  Perimetre, perimetreEffectif, rmiasCouvertes, rolesEffectifs, estAutoriteCentrale,
} from '@sigea/shared-types';

type RequeteHttp = {
  user?:    JwtPayload;
  params?:  Record<string, string>;
  body?:    Record<string, unknown>;
  query?:   Record<string, unknown>;
  headers?: Record<string, string>;
  method:   string;
  ip?:      string;
  path?:    string;
};

@Injectable()
export class PerimetreGuard implements CanActivate {
  private readonly logger = new Logger(PerimetreGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const req  = ctx.switchToHttp().getRequest<RequeteHttp>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Jeton absent ou invalide');

    const portee = perimetreEffectif(user);

    // ── Périmètre national ───────────────────────────────────────────────
    //
    // SCOPS, ADMIN, CEMAA, MAGE. La distinction qui compte n'est pas le
    // périmètre mais le DROIT D'ÉCRIRE : le CEMAA et le MAGE consultent et
    // émettent des consignes par leur propre service ; ils n'écrivent jamais
    // dans le circuit. Le SCOPS, lui, alloue les quotas — il écrit.
    if (portee === Perimetre.NATIONAL) {
      const lectureSeule = rolesEffectifs(user).every(
        (r) => estAutoriteCentrale(r) && r !== RoleUtilisateur.ADMIN,
      );
      if (lectureSeule && req.method !== 'GET') {
        throw new ForbiddenException(
          'Autorité centrale : accès en écriture non autorisé via ce circuit',
        );
      }
      return true;
    }

    // ── Périmètre RMIA ───────────────────────────────────────────────────
    if (portee === Perimetre.RMIA) {
      const couvertes = rmiasCouvertes(user);
      if (!couvertes.length) {
        // Un compte de la chaîne RMIA sans RMIA est une erreur d'administration,
        // pas un cas limite : on refuse plutôt que d'ouvrir par défaut.
        this.logger.error(
          `Compte RMIA sans RMIA renseignée : user=${user.sub} role=${user.role}`,
        );
        throw new ForbiddenException(
          "Votre compte n'est rattaché à aucune RMIA. Contactez l'administrateur.",
        );
      }

      const demandee = this.extraire(req, 'rmia') as Rmia | undefined;
      if (demandee && !couvertes.includes(demandee)) {
        this.logger.warn(
          `Tentative inter-RMIA : user=${user.sub} rmia_user=${couvertes.join('/')} ` +
            `rmia_ressource=${demandee} path=${req.path} ip=${req.ip}`,
        );
        throw new ForbiddenException(
          `Accès refusé : cette ressource relève de la ${demandee.replace('_', ' ')}, ` +
            `hors de votre périmètre.`,
        );
      }
      return true;
    }

    // ── Périmètre base ───────────────────────────────────────────────────
    const baseDemandee = this.extraire(req, 'base_id');
    if (baseDemandee && baseDemandee !== user.base_id) {
      this.logger.warn(
        `Tentative inter-bases : user=${user.sub} base_user=${user.base_id} ` +
          `base_ressource=${baseDemandee} path=${req.path} ip=${req.ip}`,
      );
      throw new ForbiddenException(
        `Accès refusé : vous ne pouvez accéder qu'aux ressources de votre base.`,
      );
    }
    return true;
  }

  /**
   * Lit un discriminant de périmètre dans la requête.
   *
   * Params, corps, query puis en-tête : l'ordre va du plus explicite au moins
   * fiable. Chaînage optionnel partout — un GET sans corps ne doit pas produire
   * un 500 dans une garde de sécurité, ce qui était le défaut de la version
   * initiale de BaseCloisonnementGuard.
   */
  private extraire(req: RequeteHttp, cle: 'base_id' | 'rmia'): string | undefined {
    const entete = cle === 'base_id' ? 'x-base-id' : 'x-rmia';
    const brut =
      req.params?.[cle] ??
      (req.body?.[cle] as string | undefined) ??
      (req.query?.[cle] as string | undefined) ??
      req.headers?.[entete];
    return typeof brut === 'string' && brut.length ? brut : undefined;
  }
}

/**
 * @deprecated Alias transitoire vers PerimetreGuard.
 *
 * Conservé pour que les contrôleurs non encore repris continuent de compiler.
 * À supprimer une fois les lots 2 à 5 intégrés : laisser deux noms pour une
 * même garde finit toujours par produire deux comportements.
 */
export { PerimetreGuard as BaseCloisonnementGuard };