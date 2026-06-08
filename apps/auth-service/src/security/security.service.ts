import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import * as crypto from 'crypto';

const INACTIVITE_JOURS = 30;

export interface LoginContext {
  ip?: string;
  fingerprint?: string;
  userAgent?: string;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger('SECURITY');

  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, type: string, niveau: string, message: string, ip?: string): Promise<void> {
    await this.prisma.securityNotification.create({
      data: { user_id: userId, type, niveau, message, ip: ip ?? null },
    });
    this.logger.warn(JSON.stringify({ userId, type, niveau, ip, ts: new Date().toISOString() }));
  }

  async lockAccount(userId: string, motif: string, ip?: string): Promise<void> {
    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: { verrouille_securite: true, motif_verrouillage: motif },
    });
    await this.notify(userId, 'COMPTE_VERROUILLE', 'CRITIQUE', motif, ip);
  }

  async evaluateLogin(
    userId: string,
    ctx: LoginContext,
    user: { last_login_at: Date | null; notif_connexion: boolean },
  ): Promise<void> {
    const fp = ctx.fingerprint ? crypto.createHash('sha256').update(ctx.fingerprint).digest('hex') : null;

    if (fp) {
      const known = await this.prisma.knownDevice.findUnique({
        where: { user_id_fingerprint: { user_id: userId, fingerprint: fp } },
      });
      if (!known) {
        await this.prisma.knownDevice.create({
          data: { user_id: userId, fingerprint: fp, ip: ctx.ip ?? null, user_agent: ctx.userAgent ?? null },
        });
        if (user.notif_connexion) {
          await this.notify(userId, 'NOUVEL_APPAREIL', 'ALERTE',
            `Connexion depuis un nouvel appareil (IP ${ctx.ip ?? 'inconnue'})`, ctx.ip);
        }
      } else {
        if (known.ip && ctx.ip && known.ip !== ctx.ip && user.notif_connexion) {
          await this.notify(userId, 'NOUVELLE_IP', 'ALERTE',
            `Connexion depuis une nouvelle adresse IP : ${ctx.ip}`, ctx.ip);
        }
        await this.prisma.knownDevice.update({
          where: { id: known.id },
          data: { ip: ctx.ip ?? known.ip, derniere_vue: new Date() },
        });
      }
    }

    if (user.last_login_at) {
      const jours = (Date.now() - user.last_login_at.getTime()) / 86_400_000;
      if (jours > INACTIVITE_JOURS && user.notif_connexion) {
        await this.notify(userId, 'INACTIVITE', 'INFO',
          `Connexion après ${Math.floor(jours)} jours d'inactivité`, ctx.ip);
      }
    }

    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: { last_login_at: new Date(), last_login_ip: ctx.ip ?? null },
    });
  }
}