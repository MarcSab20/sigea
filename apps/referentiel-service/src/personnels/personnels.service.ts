import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';

@Injectable()
export class PersonnelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<unknown[]> {
    const users = await this.prisma.utilisateur.findMany({
      orderBy: { nom: 'asc' },
      select: {
        id: true, nom: true, prenom: true, grade: true, login: true,
        role: true, base_id: true, actif: true, email: true,
        last_login_at: true, createdAt: true,
      },
    });
    return users.map(u => ({ ...u, last_login: u.last_login_at }));
  }
}