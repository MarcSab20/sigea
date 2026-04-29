import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'] });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('PostgreSQL connecté');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Injecte le contexte utilisateur pour les politiques RLS PostgreSQL.
   * À appeler au début de chaque requête métier.
   */
  async setRlsContext(base_id: string, role: string): Promise<void> {
    await this.$executeRawUnsafe(
      `SELECT set_config('app.current_base_id', $1, true), set_config('app.current_role', $2, true)`,
      base_id,
      role,
    );
  }
}
