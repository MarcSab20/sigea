import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';

@Injectable()
export class AeronefsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<unknown[]> {
    return this.prisma.aeronef.findMany({ where: { actif: true }, orderBy: { immatriculation: 'asc' } });
  }
}