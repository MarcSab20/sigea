// apps/manifeste-service/src/passagers/passagers.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { StatutManifeste } from '@sigea/shared-types';
import { CreatePassagerDto } from './dto/create-passager.dto';

@Injectable()
export class PassagersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(manifesteId: string, dto: CreatePassagerDto, base_id: string): Promise<unknown> {
    const manifeste = await this.prisma.manifeste.findFirst({
      where: { id: manifesteId, base_id },
    });
    if (!manifeste) throw new NotFoundException('Manifeste introuvable');
    if (manifeste.statut !== StatutManifeste.BROUILLON) {
      throw new BadRequestException('Impossible de modifier un manifeste soumis');
    }
    return this.prisma.passager.create({
      data: {
        manifeste_id:        manifesteId,
        base_id,
        nom:                 dto.nom,
        prenom:              dto.prenom,
        grade:               dto.grade ?? null,
        categorie:           dto.categorie as any,
        matricule:           dto.matricule ?? null,
        unite:               dto.unite ?? null,
        destination:         dto.destination,
        nb_bagages:          dto.nb_bagages,
        masse_bagages_kg:    dto.masse_bagages_kg,
        couleur_bagages:     dto.couleur_bagages ?? null,
        contact_urgence_nom: dto.contact_urgence_nom,
        contact_urgence_tel: dto.contact_urgence_tel,
        contact_urgence_qual: dto.contact_urgence_qual ?? null,
        ref_autorisation:    dto.ref_autorisation ?? null,
      },
    });
  }

  async findAll(manifesteId: string, base_id: string): Promise<unknown[]> {
    const manifeste = await this.prisma.manifeste.findFirst({ where: { id: manifesteId, base_id } });
    if (!manifeste) throw new NotFoundException('Manifeste introuvable');
    return this.prisma.passager.findMany({ where: { manifeste_id: manifesteId } });
  }

  async remove(id: string, manifesteId: string, base_id: string): Promise<void> {
    const passager = await this.prisma.passager.findFirst({
      where: { id, manifeste_id: manifesteId },
    });
    if (!passager) throw new NotFoundException('Passager introuvable');
    if (passager.verrouille) throw new ForbiddenException('Ligne verrouillée par consigne CEMAA');
    await this.prisma.passager.delete({ where: { id } });
  }
}