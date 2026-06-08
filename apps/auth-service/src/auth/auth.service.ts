import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@sigea/shared-database';
import { OtpService } from '../otp/otp.service';
import { BackupCodeService } from '../backup/backup-code.service';
import { SecurityService, LoginContext } from '../security/security.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const ERR = 'Authentification refusée';

export interface LoginResult {
  step: 'MFA_SETUP' | 'MFA_VERIFY' | 'COMPLETE';
  challenge_token?: string;
  mfa_setup?: { secret: string; qr_url: string; otp_auth_url: string };
  backup_codes?: string[];
  access_token?: string;
  refresh_token?: string;
  user?: { id: string; role: string; base_id: string; nom: string; prenom: string; grade: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly otp: OtpService,
    private readonly backup: BackupCodeService,
    private readonly security: SecurityService,
  ) {}

  private async newChallenge(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.challengeToken.upsert({
      where: { user_id: userId },
      update: { token, expires_at },
      create: { user_id: userId, token, expires_at },
    });
    return token;
  }

  private async resolveChallenge(token: string): Promise<string> {
    const ch = await this.prisma.challengeToken.findUnique({ where: { token } });
    if (!ch || ch.expires_at < new Date()) {
      throw new UnauthorizedException('Session expirée — reconnectez-vous');
    }
    return ch.user_id;
  }

  async login(login: string, password: string, firstConnection: boolean, ctx: LoginContext): Promise<LoginResult> {
    const user = await this.prisma.utilisateur.findUnique({ where: { login } });
    if (!user || !user.actif || user.verrouille_securite) {
      if (user?.verrouille_securite) {
        await this.security.notify(user.id, 'TENTATIVE_COMPTE_VERROUILLE', 'ALERTE', 'Tentative sur compte verrouillé', ctx.ip);
      }
      throw new UnauthorizedException(ERR);
    }

    if (!(await bcrypt.compare(password, user.password_hash))) {
      throw new UnauthorizedException(ERR);
    }

    const hasSecret = await this.otp.hasActiveSecret(user.id);

    if (firstConnection && hasSecret) {
      await this.security.lockAccount(
        user.id,
        'Sélection "première connexion" sur un compte déjà enrôlé — verrouillage de sécurité',
        ctx.ip,
      );
      throw new UnauthorizedException(ERR);
    }

    const challenge_token = await this.newChallenge(user.id);

    if (!hasSecret) {
      const { secret, otpAuthUrl, qrDataUrl } = await this.otp.generateSecret(user.id);
      return {
        step: 'MFA_SETUP',
        challenge_token,
        mfa_setup: { secret, qr_url: qrDataUrl, otp_auth_url: otpAuthUrl },
      };
    }

    return { step: 'MFA_VERIFY', challenge_token };
  }

  async activateAndVerifyOtp(challengeToken: string, otpCode: string, ctx: LoginContext): Promise<LoginResult> {
    const userId = await this.resolveChallenge(challengeToken);
    await this.otp.activateSecret(userId, otpCode);
    const backup_codes = await this.backup.generate(userId);
    await this.prisma.challengeToken.delete({ where: { token: challengeToken } });

    const user = await this.finalizeContext(userId, ctx);
    return { ...this.issueTokens(user), backup_codes };
  }

  async verifyOtp(challengeToken: string, otpCode: string, ctx: LoginContext): Promise<LoginResult> {
    const userId = await this.resolveChallenge(challengeToken);
    if (!(await this.otp.verifyToken(userId, otpCode))) {
      await this.security.notify(userId, 'OTP_INVALIDE', 'INFO', 'Code OTP invalide', ctx.ip);
      throw new UnauthorizedException('Code OTP invalide ou expiré');
    }
    await this.prisma.challengeToken.delete({ where: { token: challengeToken } });
    const user = await this.finalizeContext(userId, ctx);
    return this.issueTokens(user);
  }

  async verifyBackupCode(challengeToken: string, code: string, ctx: LoginContext): Promise<LoginResult> {
    const userId = await this.resolveChallenge(challengeToken);
    if (!(await this.backup.verifyAndConsume(userId, code))) {
      await this.security.notify(userId, 'BACKUP_INVALIDE', 'ALERTE', 'Code de secours invalide', ctx.ip);
      throw new UnauthorizedException('Code de secours invalide');
    }
    const reste = await this.backup.countRemaining(userId);
    await this.security.notify(userId, 'BACKUP_UTILISE', 'ALERTE',
      `Code de secours utilisé (${reste} restant). Réinitialisez votre MFA.`, ctx.ip);
    await this.prisma.challengeToken.delete({ where: { token: challengeToken } });
    const user = await this.finalizeContext(userId, ctx);
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const payload = this.jwt.verify(refreshToken) as { sub: string; type: string };
      if (payload.type !== 'refresh') throw new Error();
      const user = await this.prisma.utilisateur.findUnique({ where: { id: payload.sub } });
      if (!user || !user.actif || user.verrouille_securite) throw new UnauthorizedException();
      return {
        access_token: this.jwt.sign(
          { sub: user.id, role: user.role, base_id: user.base_id, jti: crypto.randomBytes(8).toString('hex') },
          { expiresIn: '10m', algorithm: 'RS256' },
        ),
      };
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }
  }

  private async finalizeContext(userId: string, ctx: LoginContext) {
    const user = await this.prisma.utilisateur.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException(ERR);
    await this.security.evaluateLogin(userId, ctx, {
      last_login_at: user.last_login_at, notif_connexion: user.notif_connexion,
    });
    return user;
  }

  private issueTokens(user: {
    id: string; role: string; base_id: string; nom: string; prenom: string; grade: string;
  }): LoginResult {
    const access_token = this.jwt.sign(
      { sub: user.id, role: user.role, base_id: user.base_id, jti: crypto.randomBytes(8).toString('hex') },
      { expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '10m', algorithm: 'RS256' },
    );
    const refresh_token = this.jwt.sign(
      { sub: user.id, type: 'refresh', jti: crypto.randomBytes(8).toString('hex') },
      { expiresIn: '8h', algorithm: 'RS256' },
    );
    return {
      step: 'COMPLETE', access_token, refresh_token,
      user: { id: user.id, role: user.role, base_id: user.base_id, nom: user.nom, prenom: user.prenom, grade: user.grade },
    };
  }
}