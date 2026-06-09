// apps/manifeste-service/src/manifestes/manifeste.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { StatutManifeste, CategoriePassager } from '@sigea/shared-types';
import { EVENTS, ALERT_EVENTS } from '@sigea/shared-events';
import { EventPublisher } from '@sigea/shared-messaging';

@Injectable()
export class ManifesteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
  ) {}

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
    const manifeste = await this.prisma.manifeste.findFirst({
      where: { id, base_id },
      include: {
        passagers: { select: { categorie: true } },
        marchandises: { select: { id: true } },
      },
    });
    if (!manifeste) throw new NotFoundException();
    if (manifeste.statut !== StatutManifeste.BROUILLON) {
      throw new BadRequestException('Seul un manifeste en brouillon peut être soumis');
    }

    const updated = await this.prisma.manifeste.update({
      where: { id },
      data: { statut: StatutManifeste.SOUMIS },
    });

    // ── Publication d'évènements (best-effort, n'interrompt jamais la soumission) ──
    const ts = new Date().toISOString();
    const ctx = { manifeste_id: id, base_id: manifeste.base_id, vol_id: manifeste.vol_id, timestamp: ts };

    await this.events.publish(EVENTS.MANIFESTE_SUBMITTED, ctx);

    if (manifeste.passagers.some((p) => p.categorie === CategoriePassager.EVASAN)) {
      await this.events.publish(ALERT_EVENTS.EVASAN, ctx);
    }
    if (manifeste.passagers.some((p) => p.categorie === CategoriePassager.VIP)) {
      await this.events.publish(ALERT_EVENTS.VIP, ctx);
    }
    if (manifeste.marchandises.length > 0) {
      await this.events.publish(ALERT_EVENTS.DANGEROUS_GOODS, ctx);
    }

    return updated;
  }
}
