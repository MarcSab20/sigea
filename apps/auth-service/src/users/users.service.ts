import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async validateCredentials(login: string, password: string): Promise<unknown> {
    const user = await this.prisma.utilisateur.findUnique({ where: { login } });
    if (!user || !user.actif) return null;
    const valid = await bcrypt.compare(password, user.password_hash);
    return valid ? user : null;
  }

  async findById(id: string): Promise<unknown> {
    return this.prisma.utilisateur.findUnique({ where: { id } });
  }
}
