import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@sigea/shared-database';
import { RoleUtilisateur, Rmia, DelegationJwt } from '@sigea/shared-types';
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
    id: string; role: string;
    /** NULLE pour la chaîne RMIA, qui relève d'une région et non d'une base. */
    base_id: string | null;
    /** Renseignée pour comrmia / adj_air / sec_adj_air, nulle ailleurs. */
    rmia: string | null;
    nom: string; prenom: string; grade: string;
    escadron_id?: string | null;
    /** Délégations actives — l'IHM s'en sert pour afficher le bandeau d'intérim. */
    interims?: Array<{ id: string; role: string; titulaire: string }>;
  };
}

/**
 * Forme minimale d'un compte pour émettre un jeton.
 *
 * Déclarée à part plutôt qu'en ligne dans la signature : trois méthodes la
 * consomment, et une divergence entre elles produirait des jetons de contenu
 * différent selon le chemin d'authentification emprunté — un défaut
 * particulièrement pénible à diagnostiquer, puisqu'il ne se manifeste que sur
 * l'un des parcours.
 */
interface CompteJeton {
  id: string;
  role: string;
  base_id: string | null;
  rmia: Rmia | string | null;
  nom: string;
  prenom: string;
  grade: string;
  escadron_id?: string | null;
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
   *
   * Il relit aussi la RMIA et la base : une mutation prend effet au plus tard
   * au rafraîchissement suivant, sans déconnexion.
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
          this.payloadJeton(user, interims),
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
   * La RMIA de la délégation est retenue : un suppléant qui exerce l'intérim
   * d'un Adjoint Air doit couvrir LA région de ce dernier, pas la sienne — il
   * peut d'ailleurs n'en avoir aucune.
   *
   * On ne renvoie rien d'autre : le jeton ne doit pas véhiculer d'état
   * d'annuaire (nom, grade), qui serait figé pour dix minutes et pourrait
   * diverger de la base au moment de composer un tampon.
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
      select: { id: true, role_delegue: true, rmia: true },
    });
    return rows.map((r) => ({
      id: r.id,
      role: r.role_delegue as RoleUtilisateur,
      rmia: (r.rmia as Rmia | null) ?? null,
    }));
  }

  /**
   * Charge utile du jeton d'accès.
   *
   * ── Le défaut corrigé ──
   * `rmia` était ABSENTE de toutes les signatures. Les comptes de la chaîne
   * régionale — COMRMIA, ADJ_AIR, SEC_ADJ_AIR — recevaient donc un jeton sans
   * région, et liste-service les rejetait : leur périmètre était vide, donc
   * nul. Le symptôme à l'usage était une impossibilité de se connecter aux
   * écrans de listes, sans message explicite.
   *
   * Factorisée ici précisément pour que le défaut ne puisse pas se reproduire
   * sur l'un des trois chemins d'émission seulement.
   */
  private payloadJeton(
    user: CompteJeton,
    delegations: DelegationJwt[],
  ): Record<string, unknown> {
    return {
      sub: user.id,
      role: user.role,
      // Les deux champs sont émis tels quels, `null` compris : un consommateur
      // doit pouvoir distinguer « pas de base » de « champ oublié ».
      base_id: user.base_id ?? null,
      rmia: user.rmia ?? null,
      escadron_id: user.escadron_id ?? null,
      // Champ omis quand il n'y a aucune délégation : inutile d'alourdir
      // le jeton du cas nominal, qui est l'immense majorité.
      ...(delegations.length ? { interims: delegations } : {}),
      jti: crypto.randomBytes(8).toString('hex'),
    };
  }

  private async issueTokens(user: CompteJeton): Promise<LoginResult> {
    const delegations = await this.delegationsActives(user.id);

    const access_token = this.jwt.sign(
      this.payloadJeton(user, delegations),
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
        id: user.id, role: user.role,
        base_id: user.base_id ?? null,
        rmia: user.rmia ? String(user.rmia) : null,
        nom: user.nom, prenom: user.prenom, grade: user.grade,
        escadron_id: user.escadron_id ?? null,
        ...(interimsIhm ? { interims: interimsIhm } : {}),
      },
    };
  }
}