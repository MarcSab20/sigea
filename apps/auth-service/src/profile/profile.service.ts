import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { BackupCodeService } from '../backup/backup-code.service';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService, private readonly backup: BackupCodeService) {}

  async get(userId: string) {
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true, nom: true, prenom: true, grade: true, login: true, role: true,
        base_id: true, email: true, mfa_enrolled: true, last_login_at: true,
        last_login_ip: true, notif_connexion: true, notif_par_email: true,
      },
    });
    if (!u) throw new NotFoundException('Profil introuvable');
    const backup_codes_restants = await this.backup.countRemaining(userId);
    const notifs_non_lues = await this.prisma.securityNotification.count({ where: { user_id: userId, lu: false } });
    return { ...u, backup_codes_restants, notifs_non_lues };
  }

  notifications(userId: string) {
    return this.prisma.securityNotification.findMany({
      where: { user_id: userId }, orderBy: { created_at: 'desc' }, take: 100,
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.securityNotification.updateMany({ where: { id, user_id: userId }, data: { lu: true } });
    return { success: true };
  }

  async updatePreferences(userId: string, dto: { notif_connexion?: boolean; notif_par_email?: boolean; email?: string }) {
    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: {
        notif_connexion: dto.notif_connexion,
        notif_par_email: dto.notif_par_email,
        email: dto.email,
      },
    });
    return { success: true };
  }

  async requestMfaReset(userId: string, motif?: string) {
    const existing = await this.prisma.mfaResetRequest.findFirst({
      where: { user_id: userId, statut: 'EN_ATTENTE' },
    });
    if (existing) return existing;
    return this.prisma.mfaResetRequest.create({ data: { user_id: userId, motif: motif ?? null } });
  }
}