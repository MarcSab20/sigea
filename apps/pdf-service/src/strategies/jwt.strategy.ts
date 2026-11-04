// ================================================================
// FICHIER COMMUN : jwt.strategy.ts
// À créer dans chaque service sous src/strategies/jwt.strategy.ts
// Identique pour : manifeste-service, cemaa-service,
//                  validation-service, pdf-service
// ================================================================

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, exigeRmia } from '@sigea/shared-types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_PUBLIC_KEY
        ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8')
        : '',
      algorithms: ['RS256'],
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Token JWT invalide : champs manquants');
    }

    // ── Périmètre : base OU RMIA, jamais aucun des deux ──
    //
    // Depuis que la chaîne régionale — comrmia, adj_air, sec_adj_air — n'est
    // plus rattachée à une base, exiger `base_id` revenait à lui interdire
    // l'accès à tous les services. Le symptôme était trompeur : la connexion
    // réussissait, puis chaque appel retournait 401, et le client déconnectait
    // sans message explicite.
    //
    // Ce qu'il faut vérifier n'est pas la présence d'une base, mais l'existence
    // d'UN périmètre. Un jeton qui n'en porte aucun ne peut rien cloisonner.
    if (!payload.base_id && !payload.rmia) {
      throw new UnauthorizedException(
        'Token JWT invalide : ni base ni région militaire de rattachement',
      );
    }

    if (exigeRmia(payload.role) && !payload.rmia) {
      throw new UnauthorizedException(
        `Token JWT invalide : le rôle ${payload.role} exige une RMIA`,
      );
    }
    return payload;
  }
}