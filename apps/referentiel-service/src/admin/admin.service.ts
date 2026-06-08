import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import * as bcrypt from 'bcryptjs';
import { CreateUtilisateurDto } from './dto/create-utilisateur.dto';
import { UpdateUtilisateurDto } from './dto/update-utilisateur.dto';
import { CreateBaseDto, UpdateBaseDto } from './dto/create-base.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitize<T extends { password_hash?: string }>(u: T): Omit<T, 'password_hash'> {
    const { password_hash, ...rest } = u;
    return rest;
  }

  private async resolveBaseId(idOrCode: string): Promise<string> {
    const base = await this.prisma.base.findFirst({
      where: { OR: [{ id: idOrCode }, { code_base: idOrCode }] },
      select: { id: true },
    });
    if (!base) throw new BadRequestException('Base d\'affectation introuvable');
    return base.id;
  }

  async createUtilisateur(dto: CreateUtilisateurDto): Promise<unknown> {
    const base_id = await this.resolveBaseId(dto.base_id);
    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      const user = await this.prisma.utilisateur.create({
        data: {
          nom: dto.nom, prenom: dto.prenom, grade: dto.grade,
          login: dto.login, role: dto.role, base_id,
          email: dto.email ?? null, password_hash,
        },
      });
      return this.sanitize(user);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Identifiant déjà utilisé');
      }
      throw e;
    }
  }

  async updateUtilisateur(id: string, dto: UpdateUtilisateurDto): Promise<unknown> {
    const existing = await this.prisma.utilisateur.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Utilisateur introuvable');

    const data: Record<string, unknown> = {};
    if (dto.nom !== undefined) data.nom = dto.nom;
    if (dto.prenom !== undefined) data.prenom = dto.prenom;
    if (dto.grade !== undefined) data.grade = dto.grade;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.actif !== undefined) data.actif = dto.actif;
    if (dto.base_id !== undefined) data.base_id = await this.resolveBaseId(dto.base_id);
    if (dto.password) data.password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    // login non modifiable : ignoré volontairement

    const user = await this.prisma.utilisateur.update({ where: { id }, data });
    return this.sanitize(user);
  }

  async createBase(dto: CreateBaseDto): Promise<unknown> {
    try {
      return await this.prisma.base.create({
        data: { code_base: dto.code_base, nom: dto.nom, region: dto.region },
      });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Code base déjà utilisé');
      }
      throw e;
    }
  }

  async updateBase(id: string, dto: UpdateBaseDto): Promise<unknown> {
    const existing = await this.prisma.base.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Base introuvable');
    return this.prisma.base.update({
      where: { id },
      data: { nom: dto.nom, region: dto.region }, // code_base non modifiable
    });
  }

  auditLogs(): Promise<unknown[]> {
    return this.prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 500 });
  }
}