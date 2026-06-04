// apps/vol-service/src/vols/vols.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { CreateVolDto } from './dto/create-vol.dto';

@Injectable()
export class VolsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVolDto): Promise<unknown> {
    return this.prisma.vol.create({
      data: {
        numero_mission:    dto.numero_mission,
        immatriculation:   dto.immatriculation,
        date_heure:        new Date(dto.date_heure),
        base_depart_id:    dto.base_depart_id,
        base_arrivee_id:   dto.base_arrivee_id,
        type_mission:      dto.type_mission as any,
        capacite_places:   dto.capacite_places,
        capacite_cargo_kg: dto.capacite_cargo_kg,
        statut:            'PLANIFIE',
        // Commandant de bord stocké dans metadata JSON
        combord_grade:     dto.combord_grade,
        combord_nom:       dto.combord_nom,
        combord_prenom:    dto.combord_prenom,
        // Escales intermédiaires en JSON
        escales_json: dto.escales ? JSON.stringify(dto.escales) : null,
      } as any,
    });
  }

  async findAll(base_id: string): Promise<unknown[]> {
    return this.prisma.vol.findMany({
      where: {
        OR: [
          { base_depart_id: base_id },
          { base_arrivee_id: base_id },
        ],
        statut: { not: 'ANNULE' },
      },
      include: {
        base_depart:  { select: { code_base: true, nom: true } },
        base_arrivee: { select: { code_base: true, nom: true } },
        aeronef:      { select: { immatriculation: true, type: true } },
      },
      orderBy: { date_heure: 'asc' },
    });
  }

  async findOne(id: string): Promise<unknown> {
    const vol = await this.prisma.vol.findUnique({
      where: { id },
      include: {
        base_depart:  true,
        base_arrivee: true,
        aeronef:      true,
        manifestes:   { select: { id: true, statut: true, base_id: true } },
      },
    });
    if (!vol) throw new NotFoundException(`Vol ${id} introuvable`);
    return vol;
  }
}