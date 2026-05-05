import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';

@Injectable()
export class PersonnelsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<unknown[]> {
    return this.prisma.utilisateur.findMany({
      where: { actif: true },
      select: { id: true, nom: true, prenom: true, grade: true, role: true, base_id: true },
      orderBy: { nom: 'asc' },
    });
  }
}