// apps/auth-service/src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@sigea/shared-database';
import { OtpService } from '../otp/otp.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export interface LoginResult {
  step: 'MFA_SETUP' | 'MFA_VERIFY' | 'COMPLETE';
  challenge_token?: string;
  // Renvoyés uniquement si step === MFA_SETUP
  mfa_setup?: {
    secret: string;
    qr_url: string;
    otp_auth_url: string;
  };
  // Renvoyés uniquement si step === COMPLETE
  access_token?: string;
  refresh_token?: string;
  user?: {
    id: string;
    role: string;
    base_id: string;
    nom: string;
    prenom: string;
    grade: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly otp: OtpService,
  ) {}

  async login(login: string, password: string): Promise<LoginResult> {
    // 1. Trouver l'utilisateur
    const user = await this.prisma.utilisateur.findUnique({
      where: { login },
      include: { otp_secret: true },
    });

    if (!user || !user.actif) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // 2. Vérifier le mot de passe
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // 3. Générer un challenge token court durée (10 min)
    const challengeToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.challengeToken.upsert({
      where: { user_id: user.id },
      update: {
        token: challengeToken,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      },
      create: {
        user_id: user.id,
        token: challengeToken,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // 4. Première connexion — pas de secret TOTP actif → MFA_SETUP
    const hasSecret = await this.otp.hasActiveSecret(user.id);
    if (!hasSecret) {
      const { secret, otpAuthUrl, qrDataUrl } = await this.otp.generateSecret(user.id);
      return {
        step: 'MFA_SETUP',
        challenge_token: challengeToken,
        mfa_setup: {
          secret,
          qr_url: qrDataUrl,
          otp_auth_url: otpAuthUrl,
        },
      };
    }

    // 5. Secret TOTP actif → demander le code
    return {
      step: 'MFA_VERIFY',
      challenge_token: challengeToken,
    };
  }

  async refresh(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const payload = this.jwt.verify(refreshToken) as { sub: string; type: string };
      if (payload.type !== 'refresh') throw new Error();
      const user = await this.prisma.utilisateur.findUnique({ where: { id: payload.sub } });
      if (!user || !user.actif) throw new UnauthorizedException();
      const access_token = this.jwt.sign(
        { sub: user.id, role: user.role, base_id: user.base_id,
          jti: crypto.randomBytes(8).toString('hex') },
        { expiresIn: '10m', algorithm: 'RS256' },
      );
      return { access_token };
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }
  }


  async verifyOtp(challengeToken: string, otpCode: string): Promise<LoginResult> {
    // 1. Valider le challenge token
    const challenge = await this.prisma.challengeToken.findUnique({
      where: { token: challengeToken },
    });

    if (!challenge || challenge.expires_at < new Date()) {
      throw new UnauthorizedException('Session expirée — reconnectez-vous');
    }

    const user = await this.prisma.utilisateur.findUnique({
      where: { id: challenge.user_id },
    });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');

    // 2. Vérifier le code TOTP
    const valid = await this.otp.verifyToken(user.id, otpCode);
    if (!valid) {
      throw new UnauthorizedException('Code OTP invalide ou expiré');
    }

    // 3. Supprimer le challenge token (usage unique)
    await this.prisma.challengeToken.delete({ where: { token: challengeToken } });

    // 4. Mettre à jour last_login
    await this.prisma.utilisateur.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    // 5. Émettre les tokens JWT
    return this.issueTokens(user);
  }

  async activateAndVerifyOtp(challengeToken: string, otpCode: string): Promise<LoginResult> {
    const challenge = await this.prisma.challengeToken.findUnique({
      where: { token: challengeToken },
    });

    if (!challenge || challenge.expires_at < new Date()) {
      throw new UnauthorizedException('Session expirée — reconnectez-vous');
    }

    // Activer le secret (premier scan)
    await this.otp.activateSecret(challenge.user_id, otpCode);

    // Supprimer le challenge
    await this.prisma.challengeToken.delete({ where: { token: challengeToken } });

    const user = await this.prisma.utilisateur.findUnique({
      where: { id: challenge.user_id },
    });
    if (!user) throw new UnauthorizedException();

    await this.prisma.utilisateur.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    return this.issueTokens(user);
  }

  private issueTokens(user: {
    id: string; role: string; base_id: string;
    nom: string; prenom: string; grade: string;
  }): LoginResult {
    const payload = {
      sub: user.id,
      role: user.role,
      base_id: user.base_id,
      jti: crypto.randomBytes(8).toString('hex'),
    };

    const access_token = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '10m',
      algorithm: 'RS256',
    });

    const refresh_token = this.jwt.sign(
      { sub: user.id, type: 'refresh', jti: crypto.randomBytes(8).toString('hex') },
      { expiresIn: '8h', algorithm: 'RS256' },
    );

    return {
      step: 'COMPLETE',
      access_token,
      refresh_token,
      user: {
        id: user.id,
        role: user.role,
        base_id: user.base_id,
        nom: user.nom,
        prenom: user.prenom,
        grade: user.grade,
      },
    };
  }
}


  