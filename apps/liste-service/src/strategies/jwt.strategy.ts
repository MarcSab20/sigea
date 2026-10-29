// apps/liste-service/src/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, ROLES_RMIA, exigeRmia } from '@sigea/shared-types';

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
    if (!payload.sub || !payload.role || !payload.base_id) {
      throw new UnauthorizedException('Jeton invalide : champs manquants');
    }
    // Contrôle propre à ce service : la chaîne RMIA ne peut pas travailler sans
    // RMIA. Laisser passer produirait un périmètre vide, donc un officier
    // devant un écran vide sans comprendre pourquoi.
    if (exigeRmia(payload.role) && !payload.rmia) {
      throw new UnauthorizedException(
        `Jeton invalide : le rôle ${payload.role} exige une RMIA ` +
          `(rôles concernés : ${ROLES_RMIA.join(', ')})`,
      );
    }
    return payload;
  }
}