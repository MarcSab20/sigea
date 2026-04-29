import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { StatutManifeste } from '@sigea/shared-types';

@Injectable()
export class ManifesteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    vol_id: string; base_id: string; cree_par: string;
    etape_vol?: string; manifeste_maitre_id?: string;
  }): Promise<unknown> {
    return this.prisma.manifeste.create({
      data: {
        vol_id:              data.vol_id,
        base_id:             data.base_id,
        cree_par:            data.cree_par,
        etape_vol:           data.etape_vol ?? 'A',
        manifeste_maitre_id: data.manifeste_maitre_id ?? null,
        statut:              StatutManifeste.BROUILLON,
        version:             1,
      },
    });
  }

  async findAllByBase(base_id: string): Promise<unknown[]> {
    return this.prisma.manifeste.findMany({
      where: { base_id },
      orderBy: { createdAt: 'desc' },
      include: { vol: true, _count: { select: { passagers: true, materiels: true } } },
    });
  }

  async findOne(id: string, base_id: string): Promise<unknown> {
    const manifeste = await this.prisma.manifeste.findFirst({
      where: { id, base_id },
      include: { passagers: true, materiels: true, marchandises: true, validations: true, vol: true },
    });
    if (!manifeste) throw new NotFoundException(`Manifeste ${id} introuvable`);
    return manifeste;
  }

  async soumettre(id: string, base_id: string): Promise<unknown> {
    const manifeste = await this.prisma.manifeste.findFirst({ where: { id, base_id } });
    if (!manifeste) throw new NotFoundException();
    if (manifeste.statut !== StatutManifeste.BROUILLON) {
      throw new BadRequestException('Seul un manifeste en brouillon peut être soumis');
    }
    return this.prisma.manifeste.update({
      where: { id },
      data: { statut: StatutManifeste.SOUMIS },
    });
  }
}
