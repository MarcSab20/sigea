// apps/vol-service/src/vols/vols.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { StatutVol, TypeMission, RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { Prisma } from '@prisma/client';
import { CreateVolDto } from './dto/create-vol.dto';

@Injectable()
export class VolsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Planifie un vol.
   *
   * ── Base de départ imposée ──
   * La base de départ n'est PAS lue dans le DTO : c'est la base d'affectation
   * du créateur. Un COMBASE ou un COMGMO planifie les vols AU DÉPART DE SA
   * BASE, jamais d'ailleurs.
   *
   * Auparavant, `create` ne recevait même pas l'utilisateur : la base venait du
   * formulaire, et rien n'empêchait un commandant de base de Yaoundé de créer
   * un vol Douala → Garoua qu'il ne pourrait ensuite jamais consulter, la
   * lecture étant cloisonnée alors que l'écriture ne l'était pas. C'est cette
   * asymétrie qui produisait des vols invisibles.
   *
   * L'ADMIN fait exception et peut désigner une base de départ, n'ayant pas de
   * périmètre opérationnel propre. S'il n'en fournit pas, la sienne s'applique.
   */
  async create(dto: CreateVolDto, user: JwtPayload): Promise<unknown> {
    const base_depart_id =
      user.role === RoleUtilisateur.ADMIN
        ? (dto.base_depart_id ?? user.base_id)
        : user.base_id;

    if (!base_depart_id) {
      throw new BadRequestException(
        "Votre compte n'a pas de base d'affectation : impossible de planifier un vol.",
      );
    }

    // ── Contrôles référentiels avant écriture ──
    const aeronef = await this.prisma.aeronef.findUnique({
      where: { immatriculation: dto.immatriculation },
    });
    if (!aeronef) {
      throw new BadRequestException(`Aéronef ${dto.immatriculation} inconnu au référentiel`);
    }
    if (!aeronef.actif) {
      throw new BadRequestException(`Aéronef ${dto.immatriculation} inactif`);
    }
    if (base_depart_id === dto.base_arrivee_id) {
      throw new BadRequestException(
        `La base d'arrivée ne peut pas être votre base de départ (${base_depart_id}).`,
      );
    }

    // Les capacités déclarées ne peuvent excéder l'aéronef réellement affecté.
    if (dto.capacite_places > aeronef.capacite_places) {
      throw new BadRequestException(
        `Capacité déclarée (${dto.capacite_places} places) supérieure à celle du ${aeronef.type} (${aeronef.capacite_places})`,
      );
    }
    if (dto.capacite_cargo_kg > Number(aeronef.capacite_cargo_kg)) {
      throw new BadRequestException(
        `Masse déclarée (${dto.capacite_cargo_kg} kg) supérieure à celle du ${aeronef.type} (${aeronef.capacite_cargo_kg} kg)`,
      );
    }

    const escales = dto.escales ?? [];
    const basesRoute = [base_depart_id, dto.base_arrivee_id, ...escales.map((e) => e.base_id)];

    // Toutes les bases de la route doivent exister — sinon la FK échouerait
    // avec un message Prisma illisible pour l'utilisateur.
    const basesConnues = await this.prisma.base.findMany({
      where: { id: { in: [...new Set(basesRoute)] } },
      select: { id: true },
    });
    const idsConnus = new Set(basesConnues.map((b) => b.id));
    const inconnues = [...new Set(basesRoute)].filter((id) => !idsConnus.has(id));
    if (inconnues.length) {
      throw new BadRequestException(`Base(s) inconnue(s) : ${inconnues.join(', ')}`);
    }

    // Une escale ne peut être ni le départ ni l'arrivée, ni faire doublon.
    // La contrainte @@unique([vol_id, base_id]) le refuserait de toute façon :
    // autant renvoyer un message clair plutôt qu'une erreur de contrainte.
    for (const e of escales) {
      if (e.base_id === base_depart_id || e.base_id === dto.base_arrivee_id) {
        throw new BadRequestException(`L'escale ${e.base_id} est déjà le départ ou l'arrivée du vol`);
      }
      if (e.capacite_places > aeronef.capacite_places) {
        throw new BadRequestException(`Escale ${e.base_id} : capacité places supérieure à celle de l'aéronef`);
      }
      if (e.capacite_cargo_kg > Number(aeronef.capacite_cargo_kg)) {
        throw new BadRequestException(`Escale ${e.base_id} : masse supérieure à celle de l'aéronef`);
      }
    }
    if (new Set(escales.map((e) => e.base_id)).size !== escales.length) {
      throw new BadRequestException('Deux escales portent la même base');
    }

    try {
      // Vol + escales en une seule écriture atomique : pas de vol orphelin
      // privé de ses escales si l'insertion échoue à mi-parcours.
      return await this.prisma.vol.create({
        data: {
          numero_mission:    dto.numero_mission,
          immatriculation:   dto.immatriculation,
          date_heure:        new Date(dto.date_heure),
          base_depart_id:    base_depart_id,
          base_arrivee_id:   dto.base_arrivee_id,
          type_mission:      dto.type_mission,
          flag_sensible:     dto.type_mission === TypeMission.OP_SENSIBLE,
          capacite_places:   dto.capacite_places,
          capacite_cargo_kg: dto.capacite_cargo_kg,
          combord_grade:     dto.combord_grade,
          combord_nom:       dto.combord_nom,
          combord_prenom:    dto.combord_prenom,
          statut:            StatutVol.PLANIFIE,
          escales: {
            create: escales.map((e, i) => ({
              base_id:           e.base_id,
              ordre:             i + 1,
              capacite_places:   e.capacite_places,
              capacite_cargo_kg: e.capacite_cargo_kg,
            })),
          },
        },
        include: {
          escales:      { include: { base: { select: { code_base: true, nom: true } } }, orderBy: { ordre: 'asc' } },
          base_depart:  { select: { code_base: true, nom: true } },
          base_arrivee: { select: { code_base: true, nom: true } },
          aeronef:      { select: { immatriculation: true, type: true } },
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Le numéro de mission ${dto.numero_mission} existe déjà`);
      }
      throw e;
    }
  }

  /**
   * Vols visibles depuis une base : départ, arrivée, OU escale intermédiaire.
   * L'ancienne version ignorait les escales — un chef d'escale intermédiaire
   * ne voyait donc pas les vols qu'il devait pourtant traiter.
   */
  async findAll(base_id: string): Promise<unknown[]> {
    return this.prisma.vol.findMany({
      where: {
        OR: [
          { base_depart_id: base_id },
          { base_arrivee_id: base_id },
          { escales: { some: { base_id } } },
        ],
        statut: { not: StatutVol.ANNULE },
      },
      include: {
        base_depart:  { select: { code_base: true, nom: true } },
        base_arrivee: { select: { code_base: true, nom: true } },
        aeronef:      { select: { immatriculation: true, type: true } },
        escales: {
          // base_id explicite : le frontend s'en sert pour déterminer si le
          // chef d'escale connecté tient une correspondance sur ce vol.
          select: { ordre: true, base_id: true, base: { select: { code_base: true, nom: true } } },
          orderBy: { ordre: 'asc' },
        },
      },
      orderBy: { date_heure: 'asc' },
    });
  }

  async findOne(id: string): Promise<unknown> {
    const vol = await this.prisma.vol.findUnique({
      where: { id },
      include: {
        base_depart:  true,
        base_arrivee: true,
        aeronef:      true,
        escales:      { include: { base: true }, orderBy: { ordre: 'asc' } },
        manifestes:   { select: { id: true, statut: true, base_id: true, etape_courante: true } },
      },
    });
    if (!vol) throw new NotFoundException(`Vol ${id} introuvable`);
    return vol;
  }

  /**
   * Un vol porteur de manifestes ne se supprime pas : il s'annule.
   * La FK Manifeste.vol_id est en RESTRICT, ce qui protège la traçabilité
   * d'un document signé. L'annulation est donc la seule sortie.
   */
  async annuler(id: string): Promise<unknown> {
    const vol = await this.prisma.vol.findUnique({ where: { id } });
    if (!vol) throw new NotFoundException(`Vol ${id} introuvable`);
    if (vol.statut === StatutVol.ANNULE) {
      throw new BadRequestException('Vol déjà annulé');
    }
    if (vol.statut === StatutVol.CLOTURE) {
      throw new BadRequestException('Un vol clôturé ne peut plus être annulé');
    }
    return this.prisma.vol.update({
      where: { id },
      data: { statut: StatutVol.ANNULE },
    });
  }
}