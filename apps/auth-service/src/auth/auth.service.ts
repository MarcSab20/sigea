import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@sigea/shared-database';
import { RoleUtilisateur, DelegationJwt } from '@sigea/shared-types';
import { OtpService } from '../otp/otp.service';
import { BackupCodeService } from '../backup/backup-code.service';
import { SecurityService, LoginContext } from '../security/security.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const ERR = 'Authentification refusée';
const MAX_ECHECS = 3;
const COMPTE_VERROUILLE =
  'Compte verrouillé apres plusieurs tentatives infructueuses. Contactez un administrateur pour le deverrouiller.';

export interface LoginResult {
  step: 'MFA_SETUP' | 'MFA_VERIFY' | 'COMPLETE';
  challenge_token?: string;
  mfa_setup?: { secret: string; qr_url: string; otp_auth_url: string };
  backup_codes?: string[];
  access_token?: string;
  refresh_token?: string;
  user?: {
    id: string; role: string; base_id: string;
    nom: string; prenom: string; grade: string;
    escadron_id?: string | null;
    /** Délégations actives — l'IHM s'en sert pour afficher le bandeau d'intérim. */
    interims?: Array<{ id: string; role: string; titulaire: string }>;
  };
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
    if (!user || !user.actif) {
      throw new UnauthorizedException(ERR);
    }

    // Compte deja verrouille : message explicite. Seul l'administrateur peut le
    // deverrouiller (POST /auth/admin/utilisateurs/:id/deverrouiller).
    if (user.verrouille_securite) {
      await this.security.notify(user.id, 'TENTATIVE_COMPTE_VERROUILLE', 'ALERTE', 'Tentative sur compte verrouillé', ctx.ip);
      throw new UnauthorizedException(COMPTE_VERROUILLE);
    }

    // Mot de passe errone : incremente le compteur d'echecs consecutifs ; au
    // MAX_ECHECS-ieme, verrouille le compte.
    if (!(await bcrypt.compare(password, user.password_hash))) {
      const echecs = user.nb_echecs_connexion + 1;
      if (echecs >= MAX_ECHECS) {
        await this.security.lockAccount(
          user.id,
          `Verrouillage automatique apres ${MAX_ECHECS} tentatives de connexion infructueuses`,
          ctx.ip,
        );
        await this.prisma.utilisateur.update({ where: { id: user.id }, data: { nb_echecs_connexion: 0 } });
        throw new UnauthorizedException(COMPTE_VERROUILLE);
      }
      await this.prisma.utilisateur.update({ where: { id: user.id }, data: { nb_echecs_connexion: echecs } });
      throw new UnauthorizedException(
        `Mot de passe incorrect. Tentative ${echecs}/${MAX_ECHECS} avant verrouillage du compte.`,
      );
    }

    // Mot de passe correct : reinitialise le compteur si necessaire.
    if (user.nb_echecs_connexion > 0) {
      await this.prisma.utilisateur.update({ where: { id: user.id }, data: { nb_echecs_connexion: 0 } });
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
    // `await` indispensable : issueTokens est désormais asynchrone (lecture des
    // délégations). Sans lui, le spread produirait les champs d'une Promise.
    return { ...(await this.issueTokens(user)), backup_codes };
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

  /**
   * Le rafraîchissement RELIT les délégations.
   *
   * C'est ce qui borne réellement la fenêtre de révocation : au plus une durée
   * de jeton d'accès. Un intérim révoqué disparaît du jeton suivant sans
   * qu'aucune action de l'utilisateur ne soit requise.
   */
  async refresh(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const payload = this.jwt.verify(refreshToken) as { sub: string; type: string };
      if (payload.type !== 'refresh') throw new Error();
      const user = await this.prisma.utilisateur.findUnique({ where: { id: payload.sub } });
      if (!user || !user.actif || user.verrouille_securite) throw new UnauthorizedException();

      const interims = await this.delegationsActives(user.id);

      return {
        access_token: this.jwt.sign(
          {
            sub: user.id,
            role: user.role,
            base_id: user.base_id,
            escadron_id: user.escadron_id ?? null,
            ...(interims.length ? { interims } : {}),
            jti: crypto.randomBytes(8).toString('hex'),
          },
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

  /**
   * Délégations en vigueur à l'instant de l'émission du jeton.
   *
   * Trois conditions cumulatives, toutes évaluées en SQL :
   *   • actif = true          → la révocation est immédiate côté base ;
   *   • date_debut <= now     → une délégation programmée n'anticipe pas ;
   *   • date_fin > now | null → une délégation échue ne survit pas.
   *
   * On ne renvoie QUE l'identifiant et le rôle : le jeton ne doit pas
   * véhiculer d'état d'annuaire (nom, grade), qui serait figé pour 10 minutes
   * et pourrait diverger de la base au moment de composer un tampon.
   */
  private async delegationsActives(userId: string): Promise<DelegationJwt[]> {
    const maintenant = new Date();
    const rows = await this.prisma.interim.findMany({
      where: {
        suppleant_id: userId,
        actif: true,
        date_debut: { lte: maintenant },
        OR: [{ date_fin: null }, { date_fin: { gt: maintenant } }],
      },
      select: { id: true, role_delegue: true },
    });
    return rows.map((r) => ({ id: r.id, role: r.role_delegue as RoleUtilisateur }));
  }

  private async issueTokens(user: {
    id: string; role: string; base_id: string; nom: string; prenom: string; grade: string;
    escadron_id?: string | null;
  }): Promise<LoginResult> {
    const delegations = await this.delegationsActives(user.id);

    const access_token = this.jwt.sign(
      {
        sub: user.id,
        role: user.role,
        base_id: user.base_id,
        escadron_id: user.escadron_id ?? null,
        // Champ omis quand il n'y a aucune délégation : inutile d'alourdir
        // le jeton du cas nominal, qui est l'immense majorité.
        ...(delegations.length ? { interims: delegations } : {}),
        jti: crypto.randomBytes(8).toString('hex'),
      },
      { expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '10m', algorithm: 'RS256' },
    );

    const refresh_token = this.jwt.sign(
      { sub: user.id, type: 'refresh', jti: crypto.randomBytes(8).toString('hex') },
      { expiresIn: '8h', algorithm: 'RS256' },
    );

    // Détail lisible pour l'IHM uniquement (bandeau « Vous exercez l'intérim
    // de … »). Ces libellés ne sont PAS dans le jeton : ils sont relus à
    // chaque connexion et n'ont donc jamais à être invalidés.
    let interimsIhm: Array<{ id: string; role: string; titulaire: string }> | undefined;
    if (delegations.length) {
      const details = await this.prisma.interim.findMany({
        where: { id: { in: delegations.map((d) => d.id) } },
        select: {
          id: true, role_delegue: true,
          titulaire: { select: { nom: true, prenom: true, grade: true } },
        },
      });
      interimsIhm = details.map((d) => ({
        id: d.id,
        role: d.role_delegue,
        titulaire: `${d.titulaire.grade} ${d.titulaire.nom} ${d.titulaire.prenom}`.trim(),
      }));
    }

    return {
      step: 'COMPLETE',
      access_token,
      refresh_token,
      user: {
        id: user.id, role: user.role, base_id: user.base_id,
        nom: user.nom, prenom: user.prenom, grade: user.grade,
        escadron_id: user.escadron_id ?? null,
        ...(interimsIhm ? { interims: interimsIhm } : {}),
      },
    };
  }
}