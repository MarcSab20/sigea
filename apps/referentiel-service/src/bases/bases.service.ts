import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';

@Injectable()
export class BasesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<unknown[]> {
    return this.prisma.base.findMany({ orderBy: { code_base: 'asc' } });
  }
}