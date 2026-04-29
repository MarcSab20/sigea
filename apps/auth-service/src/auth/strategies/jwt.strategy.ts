import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '@sigea/shared-types';
import * as fs from 'fs';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_PUBLIC_KEY
        ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64')
        : fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH ?? './keys/jwt.public.key'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub || !payload.role || !payload.base_id) {
      throw new UnauthorizedException('Token JWT invalide : champs manquants');
    }
    return payload;
  }
}
