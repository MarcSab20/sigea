// apps/manifeste-service/src/materiels/materiels.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { StatutManifeste } from '@sigea/shared-types';
import { CreateMaterielDto } from './dto/create-materiel.dto';

@Injectable()
export class MaterielsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(manifesteId: string, dto: CreateMaterielDto, base_id: string): Promise<unknown> {
    const manifeste = await this.prisma.manifeste.findFirst({ where: { id: manifesteId, base_id } });
    if (!manifeste) throw new NotFoundException('Manifeste introuvable');
    if (manifeste.statut !== StatutManifeste.BROUILLON) {
      throw new BadRequestException('Impossible de modifier un manifeste soumis');
    }
    return this.prisma.materiel.create({
      data: {
        manifeste_id:        manifesteId,
        base_id,
        designation:         dto.designation,
        type_mission_log:    dto.type_mission_log as any,
        proprietaire:        dto.proprietaire,
        poids_kg:            dto.poids_kg,
        volume:              dto.volume ?? null,
        destination:         dto.destination,
        expediteur_nom:      dto.expediteur_nom,
        expediteur_fonction: dto.expediteur_fonction,
        expediteur_tel:      dto.expediteur_tel,
      },
    });
  }

  async findAll(manifesteId: string, base_id: string): Promise<unknown[]> {
    const manifeste = await this.prisma.manifeste.findFirst({ where: { id: manifesteId, base_id } });
    if (!manifeste) throw new NotFoundException('Manifeste introuvable');
    return this.prisma.materiel.findMany({ where: { manifeste_id: manifesteId } });
  }

  async remove(id: string, manifesteId: string): Promise<void> {
    const mat = await this.prisma.materiel.findFirst({ where: { id, manifeste_id: manifesteId } });
    if (!mat) throw new NotFoundException('Matériel introuvable');
    if (mat.verrouille) throw new ForbiddenException('Ligne verrouillée par consigne CEMAA');
    await this.prisma.materiel.delete({ where: { id } });
  }
}