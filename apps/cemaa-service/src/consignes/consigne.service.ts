import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { CemaaCryptoService } from '@sigea/shared-crypto';
import { CEMAA_EVENTS } from '@sigea/shared-events';
import { EventPublisher } from '@sigea/shared-messaging';
import { CreateConsigneDto, UpdateConsigneDto } from './dto/create-consigne.dto';

@Injectable()
export class ConsigneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CemaaCryptoService,
    private readonly events: EventPublisher,
  ) {}

  async create(dto: CreateConsigneDto, cemaaUserId: string): Promise<unknown> {
    const cemaaKey = this.cle();

    // Le vol doit exister : sinon la consigne serait orpheline et son event
    // ne trouverait aucun manifeste à marquer.
    const vol = await this.prisma.vol.findUnique({
      where: { id: dto.vol_id },
      select: { id: true, statut: true },
    });
    if (!vol) throw new NotFoundException(`Vol ${dto.vol_id} introuvable`);
    if (vol.statut === 'ANNULE') {
      throw new BadRequestException('Vol annulé : consigne impossible');
    }

    // Si l'escale est précisée, elle doit appartenir à la route du vol.
    if (dto.escale_base_id) {
      await this.verifierEscale(dto.vol_id, dto.escale_base_id);
    }

    const encrypted = this.crypto.encrypt(dto.contenu, cemaaKey);

    const created = await this.prisma.consigneCemaa.create({
      data: {
        vol_id:           dto.vol_id,
        escale_base_id:   dto.escale_base_id ?? null,
        type:             dto.type,
        contenu_chiffre:  JSON.stringify(encrypted),
        places_bloquees:  dto.places_bloquees ?? 0,
        masse_bloquee_kg: dto.masse_bloquee_kg ?? 0,
        valide_par_cemaa: cemaaUserId,
      },
    });

    await this.publierEvenement(CEMAA_EVENTS.CONSIGNE_CREATED, created.id, dto.vol_id, dto.escale_base_id ?? null);
    return created;
  }

  async update(id: string, dto: UpdateConsigneDto, cemaaUserId: string): Promise<unknown> {
    const consigne = await this.prisma.consigneCemaa.findUnique({ where: { id } });
    if (!consigne) throw new NotFoundException(`Consigne ${id} introuvable`);

    const data: Record<string, unknown> = { valide_par_cemaa: cemaaUserId };
    if (dto.contenu !== undefined) {
      data['contenu_chiffre'] = JSON.stringify(this.crypto.encrypt(dto.contenu, this.cle()));
    }
    if (dto.places_bloquees !== undefined)  data['places_bloquees']  = dto.places_bloquees;
    if (dto.masse_bloquee_kg !== undefined) data['masse_bloquee_kg'] = dto.masse_bloquee_kg;

    const updated = await this.prisma.consigneCemaa.update({ where: { id }, data });

    await this.publierEvenement(CEMAA_EVENTS.CONSIGNE_UPDATED, id, consigne.vol_id, consigne.escale_base_id);
    return updated;
  }

  async findByVol(vol_id: string): Promise<unknown[]> {
    return this.prisma.consigneCemaa.findMany({
      where: { vol_id },
      orderBy: { date: 'desc' },
    });
  }

  // ── Interne ──

  private cle(): Buffer {
    const hex = process.env.CEMAA_ENCRYPTION_KEY ?? '';
    if (!hex) {
      // Sans clé, on refuse plutôt que de "chiffrer" avec une clé vide :
      // une consigne CEMAA en clair serait une fuite de données sensibles.
      throw new BadRequestException('CEMAA_ENCRYPTION_KEY non configurée');
    }
    return Buffer.from(hex, 'hex');
  }

  private async verifierEscale(vol_id: string, base_id: string): Promise<void> {
    // L'escale ciblée doit être une base de la route : départ, arrivée, ou
    // escale intermédiaire déclarée.
    const vol = await this.prisma.vol.findUnique({
      where: { id: vol_id },
      select: {
        base_depart_id: true, base_arrivee_id: true,
        escales: { select: { base_id: true } },
      },
    });
    if (!vol) throw new NotFoundException(`Vol ${vol_id} introuvable`);

    const bases = new Set<string>([
      vol.base_depart_id, vol.base_arrivee_id,
      ...vol.escales.map((e) => e.base_id),
    ]);
    if (!bases.has(base_id)) {
      throw new BadRequestException(`La base ${base_id} n'est pas sur la route du vol`);
    }
  }

  /**
   * Publie l'évènement de consigne en y joignant les manifestes CIBLÉS.
   * Si escale_base_id est renseigné, seuls les manifestes de cette escale
   * reçoivent l'indication ; sinon, tous les manifestes du vol.
   */
  private async publierEvenement(
    routingKey: string,
    consigne_id: string,
    vol_id: string,
    escale_base_id: string | null,
  ): Promise<void> {
    const manifestes = await this.prisma.manifeste.findMany({
      where: {
        vol_id,
        ...(escale_base_id ? { base_id: escale_base_id } : {}),
      },
      select: { id: true, base_id: true },
    });

    await this.events.publish(routingKey, {
      consigne_id,
      vol_id,
      escale_base_id,
      manifestes,
      timestamp: new Date().toISOString(),
    });
  }
}