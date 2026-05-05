import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';

@Injectable()
export class UnitesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<unknown[]> {
    return this.prisma.unite.findMany({ orderBy: { code: 'asc' } });
  }
}