import { Injectable, UnauthorizedException } from '@nestjs/common';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SessionService {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  private readonly SESSION_TTL = 7 * 24 * 3600; // 7 jours

  async createSession(userId: string, refreshToken: string): Promise<void> {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.redis.setex(`session:${userId}`, this.SESSION_TTL, hashed);
  }

  async validateAndGetUserId(token: string): Promise<string> {
    // NOTE : en production, le token doit contenir l'userId (JWT opaque ou lookup)
    // Implémentation complète Phase 1
    void token;
    throw new UnauthorizedException('Refresh token invalide');
  }

  async revokeSession(userId: string, jti: string): Promise<void> {
    const exp = 15 * 60; // 15 min = durée access token
    await this.redis.setex(`blacklist:${jti}`, exp, '1');
    await this.redis.del(`session:${userId}`);
  }
}
