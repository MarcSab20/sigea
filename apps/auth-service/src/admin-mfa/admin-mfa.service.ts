import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { OtpService } from '../otp/otp.service';
import { SecurityService } from '../security/security.service';

@Injectable()
export class AdminMfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly security: SecurityService,
  ) {}

  pendingRequests() {
    return this.prisma.mfaResetRequest.findMany({
      where: { statut: 'EN_ATTENTE' },
      orderBy: { created_at: 'asc' },
      include: { utilisateur: { select: { nom: true, prenom: true, login: true, base_id: true } } },
    });
  }

  private async purgeMfa(userId: string): Promise<void> {
    await this.otp.reset(userId);
    await this.prisma.backupCode.deleteMany({ where: { user_id: userId } });
    await this.prisma.challengeToken.deleteMany({ where: { user_id: userId } });
  }

  async approveRequest(id: string, adminId: string) {
    const req = await this.prisma.mfaResetRequest.findUnique({ where: { id } });
    if (!req || req.statut !== 'EN_ATTENTE') throw new NotFoundException('Demande introuvable');
    await this.purgeMfa(req.user_id);
    await this.prisma.mfaResetRequest.update({
      where: { id }, data: { statut: 'APPROUVE', traite_par: adminId, traite_le: new Date() },
    });
    await this.security.notify(req.user_id, 'MFA_REINITIALISE', 'ALERTE',
      'Votre MFA a été réinitialisé par un administrateur. Ré-enrôlement requis à la prochaine connexion.');
    return { success: true };
  }

  async rejectRequest(id: string, adminId: string) {
    await this.prisma.mfaResetRequest.update({
      where: { id }, data: { statut: 'REJETE', traite_par: adminId, traite_le: new Date() },
    });
    return { success: true };
  }

  async forceReset(userId: string, adminId: string) {
    await this.purgeMfa(userId);
    await this.prisma.utilisateur.update({
      where: { id: userId }, data: { verrouille_securite: false, motif_verrouillage: null },
    });
    await this.security.notify(userId, 'MFA_REINITIALISE', 'ALERTE',
      `MFA réinitialisé par l'administrateur ${adminId}`);
    return { success: true };
  }

  async unlock(userId: string, adminId: string, motif?: string) {
    await this.prisma.utilisateur.update({
      where: { id: userId }, data: { verrouille_securite: false, motif_verrouillage: null },
    });
    await this.security.notify(userId, 'COMPTE_DEVERROUILLE', 'INFO',
      `Compte déverrouillé par ${adminId}${motif ? ` — ${motif}` : ''}`);
    return { success: true };
  }

  alerts() {
    return this.prisma.securityNotification.findMany({
      where: { niveau: { in: ['ALERTE', 'CRITIQUE'] } },
      orderBy: { created_at: 'desc' },
      take: 200,
      include: { utilisateur: { select: { nom: true, prenom: true, login: true, base_id: true } } },
    });
  }
}