import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { CemaaCryptoService } from '@sigea/shared-crypto';
import { CEMAA_EVENTS } from '@sigea/shared-events';
import { EventPublisher } from '@sigea/shared-messaging';
import { CreateConsigneDto } from './dto/create-consigne.dto';

@Injectable()
export class ConsigneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CemaaCryptoService,
    private readonly events: EventPublisher,
  ) {}

  async create(dto: CreateConsigneDto, cemaaUserId: string): Promise<unknown> {
    const cemaaKey = Buffer.from(process.env.CEMAA_ENCRYPTION_KEY ?? '', 'hex');
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

    // Résout les manifestes du vol concerné pour cibler les bonnes rooms de base.
    const manifestes = await this.prisma.manifeste.findMany({
      where: { vol_id: dto.vol_id },
      select: { id: true, base_id: true },
    });

    await this.events.publish(CEMAA_EVENTS.CONSIGNE_CREATED, {
      consigne_id: created.id,
      vol_id: dto.vol_id,
      escale_base_id: dto.escale_base_id ?? null,
      manifestes,
      timestamp: new Date().toISOString(),
    });

    return created;
  }

  async findByVol(vol_id: string): Promise<unknown[]> {
    return this.prisma.consigneCemaa.findMany({ where: { vol_id } });
  }
}
