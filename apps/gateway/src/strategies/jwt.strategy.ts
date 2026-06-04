// apps/gateway/src/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const publicKeyB64 = config.get<string>('JWT_PUBLIC_KEY') ?? '';
    const publicKey = publicKeyB64
      ? Buffer.from(publicKeyB64, 'base64').toString('utf8')
      : '';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });
  }

  validate(payload: Record<string, unknown>): Record<string, unknown> {
    return payload;
  }
}