import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { EtapeValidation, RoleUtilisateur, StatutManifeste } from '@sigea/shared-types';

const ROLE_TO_ETAPE: Partial<Record<RoleUtilisateur, EtapeValidation>> = {
  [RoleUtilisateur.COMESO]:  EtapeValidation.COMESO,
  [RoleUtilisateur.COMGMO]:  EtapeValidation.COMGMO,
  [RoleUtilisateur.COMBORD]: EtapeValidation.COMBORD,
  [RoleUtilisateur.CEMAA]:   EtapeValidation.CEMAA_SENSIBLE,
  [RoleUtilisateur.COMBASE]: EtapeValidation.COMBASE,
};

const ETAPE_SEQUENCE: EtapeValidation[] = [
  EtapeValidation.COMESO,
  EtapeValidation.COMGMO,
  EtapeValidation.COMBORD,
  EtapeValidation.COMBASE,
];

@Injectable()
export class ValidationStateMachine {
  private readonly logger = new Logger(ValidationStateMachine.name);

  constructor(private readonly prisma: PrismaService) {}

  async valider(
    manifeste_id: string,
    role: RoleUtilisateur,
    base_id: string,
    commentaire?: string,
  ): Promise<unknown> {
    const manifeste = await this.prisma.manifeste.findFirst({
      where: { id: manifeste_id, base_id },
      include: { validations: true },
    });
    if (!manifeste) throw new BadRequestException('Manifeste introuvable');

    // Bloquer COMBASE si CEMAA_SENSIBLE en attente
    if (role === RoleUtilisateur.COMBASE && manifeste.flag_sensible) {
      const sensiblePending = manifeste.validations.find(
        v => v.etape === EtapeValidation.CEMAA_SENSIBLE && v.statut === 'EN_ATTENTE',
      );
      if (sensiblePending) throw new ForbiddenException('Validation CEMAA requise avant signature COMBASE');
    }

    const etape = ROLE_TO_ETAPE[role];
    if (!etape) throw new ForbiddenException('Rôle non autorisé à valider');

    const result = await this.prisma.validationEtape.upsert({
      where: { manifeste_id_etape: { manifeste_id, etape } },
      update: { statut: 'APPROUVE', commentaire, date_heure: new Date() },
      create: { manifeste_id, etape, statut: 'APPROUVE', commentaire },
    });

    this.logger.log(`Validation : manifeste=${manifeste_id} etape=${etape} role=${role}`);

    // Si COMBASE : passer le manifeste à VALIDE
    if (etape === EtapeValidation.COMBASE) {
      await this.prisma.manifeste.update({
        where: { id: manifeste_id },
        data: { statut: StatutManifeste.VALIDE },
      });
    }

    return result;
  }

  async rejeter(
    manifeste_id: string,
    role: RoleUtilisateur,
    base_id: string,
    motif: string,
  ): Promise<unknown> {
    const etape = ROLE_TO_ETAPE[role];
    if (!etape) throw new ForbiddenException('Rôle non autorisé à rejeter');

    // Invalider toutes les étapes suivantes
    const etapeIndex = ETAPE_SEQUENCE.indexOf(etape);
    const etapesAInvalider = ETAPE_SEQUENCE.slice(etapeIndex);

    await this.prisma.validationEtape.updateMany({
      where: { manifeste_id, etape: { in: etapesAInvalider } },
      data: { statut: 'EN_ATTENTE' },
    });

    const result = await this.prisma.validationEtape.upsert({
      where: { manifeste_id_etape: { manifeste_id, etape } },
      update: { statut: 'REJETE', commentaire: motif, date_heure: new Date() },
      create: { manifeste_id, etape, statut: 'REJETE', commentaire: motif },
    });

    await this.prisma.manifeste.update({
      where: { id: manifeste_id },
      data: { statut: StatutManifeste.REJETE },
    });

    return result;
  }
}
