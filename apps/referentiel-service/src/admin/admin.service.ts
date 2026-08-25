// apps/referentiel-service/src/admin/admin.service.ts
import {
  Injectable, BadRequestException, ConflictException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { RoleUtilisateur, ROLES_AVEC_ESCADRON } from '@sigea/shared-types';
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
    if (!base) throw new BadRequestException("Base d'affectation introuvable");
    return base.id;
  }

  /**
   * Résout et VALIDE le couple (rôle, escadron, base).
   *
   * Trois vérifications, dans cet ordre :
   *   1. le rôle exige-t-il un escadron ? (comea oui, les autres non) ;
   *   2. l'escadron existe-t-il et est-il actif ? ;
   *   3. relève-t-il bien de la base d'affectation retenue ?
   *
   * Le point 3 est la traduction directe de la règle métier : « lorsqu'on
   * créera un utilisateur COMEA et qu'on choisira sa base, on ne lui
   * présentera que les escadrons rattachés à sa base ». L'IHM filtre la liste,
   * mais le filtrage d'un formulaire n'engage personne — la règle est tenue
   * ici, et une troisième fois par le trigger trg_utilisateur_escadron_base.
   *
   * Trois barrières pour une même règle : c'est délibéré. L'IHM guide,
   * le service explique, la base garantit.
   */
  private async resolveEscadron(
    role: RoleUtilisateur,
    base_id: string,
    escadron_id?: string | null,
  ): Promise<string | null> {
    const exige = ROLES_AVEC_ESCADRON.includes(role);

    if (!exige) {
      if (escadron_id) {
        throw new BadRequestException(
          `Le rôle ${role} ne se rattache pas à un escadron. Le rattachement est réservé au COMEA.`,
        );
      }
      return null;
    }

    if (!escadron_id) {
      throw new BadRequestException(
        "Le rôle COMEA commande un escadron : le choix d'un escadron est obligatoire.",
      );
    }

    const esc = await this.prisma.escadron.findUnique({
      where: { id: escadron_id },
      select: { id: true, code: true, actif: true, base_id: true,
                base: { select: { code_base: true } } },
    });
    if (!esc) throw new BadRequestException('Escadron introuvable');
    if (!esc.actif) {
      throw new BadRequestException(`L'escadron ${esc.code} est désactivé`);
    }
    if (esc.base_id !== base_id) {
      throw new BadRequestException(
        `L'escadron ${esc.code} relève de la base ${esc.base.code_base} : ` +
        "il ne peut pas être attribué à un COMEA d'une autre base.",
      );
    }
    return esc.id;
  }

  async createUtilisateur(dto: CreateUtilisateurDto): Promise<unknown> {
    const base_id     = await this.resolveBaseId(dto.base_id);
    const escadron_id = await this.resolveEscadron(dto.role, base_id, dto.escadron_id);
    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await this.prisma.utilisateur.create({
        data: {
          nom: dto.nom, prenom: dto.prenom, grade: dto.grade,
          login: dto.login, role: dto.role, base_id, escadron_id,
          email: dto.email ?? null, password_hash,
        },
        include: {
          base:     { select: { code_base: true, nom: true } },
          escadron: { select: { id: true, code: true, nom: true } },
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
    if (dto.nom    !== undefined) data.nom    = dto.nom;
    if (dto.prenom !== undefined) data.prenom = dto.prenom;
    if (dto.grade  !== undefined) data.grade  = dto.grade;
    if (dto.email  !== undefined) data.email  = dto.email;
    if (dto.actif  !== undefined) data.actif  = dto.actif;
    if (dto.password) data.password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Rôle, base et escadron forment un ensemble cohérent : on les résout
    // ENSEMBLE, sur l'état final, et pas champ par champ. Traiter le rôle sans
    // regarder l'escadron laisserait passer un COMEA devenu COMESO tout en
    // restant rattaché à un escadron.
    const base_id = dto.base_id !== undefined
      ? await this.resolveBaseId(dto.base_id)
      : existing.base_id;
    const role = (dto.role ?? existing.role) as RoleUtilisateur;

    const escadronDemande = dto.escadron_id !== undefined
      ? dto.escadron_id
      : existing.escadron_id;

    const escadron_id = await this.resolveEscadron(role, base_id, escadronDemande);

    if (dto.role    !== undefined) data.role    = role;
    if (dto.base_id !== undefined) data.base_id = base_id;
    // Toujours écrit : un changement de rôle peut imposer la remise à null,
    // même si escadron_id n'était pas dans la requête.
    data.escadron_id = escadron_id;

    // login non modifiable : ignoré volontairement.

    const user = await this.prisma.utilisateur.update({
      where: { id },
      data,
      include: {
        base:     { select: { code_base: true, nom: true } },
        escadron: { select: { id: true, code: true, nom: true } },
      },
    });
    return this.sanitize(user);
  }

  /**
   * Liste des utilisateurs — alimente le gestionnaire d'intérim et de
   * mouvements, qui a besoin de désigner titulaires, suppléants et successeurs.
   */
  async listerUtilisateurs(base?: string): Promise<unknown[]> {
    const base_id = base ? await this.resolveBaseId(base) : undefined;
    const users = await this.prisma.utilisateur.findMany({
      where: base_id ? { base_id } : {},
      select: {
        id: true, nom: true, prenom: true, grade: true, login: true, role: true,
        base_id: true, escadron_id: true, actif: true, last_login_at: true,
        mfa_enrolled: true, verrouille_securite: true,
        base:     { select: { code_base: true, nom: true } },
        escadron: { select: { id: true, code: true, nom: true } },
      },
      orderBy: [{ base_id: 'asc' }, { role: 'asc' }, { nom: 'asc' }],
    });
    return users;
  }

  async createBase(dto: CreateBaseDto): Promise<unknown> {
    try {
      const numero = dto.numero ?? (dto.code_base.replace(/\D/g, '') || dto.code_base);
      return await this.prisma.base.create({
        data: { code_base: dto.code_base, numero, nom: dto.nom, region: dto.region },
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