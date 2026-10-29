// apps/vol-service/src/vols/vols.service.ts

import {
  Injectable, NotFoundException, BadRequestException, ConflictException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@sigea/shared-database';
import {
  StatutVol, TypeMission, RoleUtilisateur, Rmia, JwtPayload,
  Perimetre, perimetreEffectif, rmiasCouvertes, rolesEffectifs, rmiaDeRegionStrict,
} from '@sigea/shared-types';
import { EventPublisher } from '@sigea/shared-messaging';
import { VOL_EVENTS } from '@sigea/shared-events';
import { CreateVolDto } from './dto/create-vol.dto';

@Injectable()
export class VolsService {
  private readonly logger = new Logger(VolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Planification
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Planifie un vol au départ de la base du créateur.
   *
   * ── Base de départ imposée, sans exception ──
   * Elle n'est pas lue dans le DTO : c'est la base d'affectation du COMBASE ou
   * du COMEA. L'administrateur lui-même n'y déroge pas — s'il doit planifier
   * pour une autre base, il le fait sous un compte de cette base, et la piste
   * d'audit le dit. L'ancienne dérogation « admin » produisait des vols dont
   * personne ne pouvait expliquer l'origine.
   *
   * ── Le vol naît NON DIFFUSÉ ──
   * Statut PLANIFIE : il n'existe que pour son créateur, sa base et le SCOPS.
   * Aucune liste n'est ouverte, aucune RMIA n'est notifiée. C'est l'allocation
   * des quotas par le SCOPS qui le rend public — voir DiffusionService.
   */
  async create(dto: CreateVolDto, user: JwtPayload): Promise<unknown> {
    if (!user.base_id) {
      throw new BadRequestException(
        "Votre compte n'a pas de base d'affectation : impossible de planifier un vol.",
      );
    }

    const aeronef = await this.prisma.aeronef.findUnique({
      where: { immatriculation: dto.immatriculation },
    });
    if (!aeronef)      throw new BadRequestException(`Aéronef ${dto.immatriculation} inconnu au référentiel`);
    if (!aeronef.actif) throw new BadRequestException(`Aéronef ${dto.immatriculation} inactif`);

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

    // Un COMEA engage un escadron : sans escadron désigné, on ne saurait pas
    // quelle unité porte le vol, ni vérifier qu'il s'agit bien du sien.
    if (user.role === RoleUtilisateur.COMEA) {
      const escadron_id = dto.escadron_id ?? user.escadron_id;
      if (!escadron_id) {
        throw new BadRequestException(
          "Un commandant d'escadron doit désigner l'escadron engagé sur le vol.",
        );
      }
      const escadron = await this.prisma.escadron.findFirst({
        where: { id: escadron_id, base_id: user.base_id, actif: true },
        select: { id: true },
      });
      if (!escadron) {
        throw new BadRequestException(
          "Escadron inconnu, inactif, ou rattaché à une autre base que la vôtre.",
        );
      }
      dto.escadron_id = escadron_id;
    }

    // ── Itinéraire complet : départ imposé + points déclarés ──
    const points = [
      { base_id: user.base_id, heure_arrivee: undefined as string | undefined, heure_depart: dto.date_heure },
      ...dto.itineraire,
    ];

    // Deux points CONSÉCUTIFS identiques sont une erreur de saisie : on ne
    // décolle pas pour atterrir au même endroit. Deux points identiques NON
    // consécutifs sont au contraire le cas nominal — Douala à l'aller et au
    // retour. C'est toute la différence avec l'ancienne contrainte d'unicité,
    // qui interdisait les deux.
    for (let i = 1; i < points.length; i++) {
      if (points[i].base_id === points[i - 1].base_id) {
        throw new BadRequestException(
          `Itinéraire invalide : deux points consécutifs portent la même base (position ${i + 1}).`,
        );
      }
    }

    const basesUniques = [...new Set(points.map((p) => p.base_id))];
    const bases = await this.prisma.base.findMany({
      where: { id: { in: basesUniques } },
      select: { id: true, code_base: true, region: true, rmia: true },
    });
    const parId = new Map(bases.map((b) => [b.id, b]));
    const inconnues = basesUniques.filter((id) => !parId.has(id));
    if (inconnues.length) {
      throw new BadRequestException(`Base(s) inconnue(s) : ${inconnues.join(', ')}`);
    }

    const itineraire = points.map((p, i) => {
      const base = parId.get(p.base_id)!;
      return {
        ordre:         i + 1,
        base_id:       p.base_id,
        // RMIA figée à la création. Si la colonne manque en base — reprise
        // incomplète —, on la recalcule plutôt que d'écrire un NULL dans une
        // colonne qui porte le cloisonnement.
        rmia:          (base.rmia ?? rmiaDeRegionStrict(base.region)) as Rmia,
        heure_arrivee: p.heure_arrivee ? new Date(p.heure_arrivee) : null,
        heure_depart:  p.heure_depart  ? new Date(p.heure_depart)  : null,
      };
    });

    if (dto.combord_id) {
      const combord = await this.prisma.utilisateur.findFirst({
        where: { id: dto.combord_id, role: RoleUtilisateur.COMBORD, actif: true },
        select: { id: true },
      });
      if (!combord) {
        throw new BadRequestException(
          'Le compte désigné comme commandant de bord est inconnu, inactif, ou ne porte pas ce rôle.',
        );
      }
    }

    try {
      const vol = await this.prisma.vol.create({
        data: {
          numero_mission:  dto.numero_mission,
          immatriculation: dto.immatriculation,
          date_heure:      new Date(dto.date_heure),
          // Raccourcis dénormalisés, écrits ici et nulle part ailleurs.
          base_depart_id:  itineraire[0].base_id,
          base_arrivee_id: itineraire[itineraire.length - 1].base_id,
          type_mission:      dto.type_mission,
          flag_sensible:     dto.type_mission === TypeMission.OP_SENSIBLE,
          capacite_places:   dto.capacite_places,
          capacite_cargo_kg: dto.capacite_cargo_kg,
          combord_grade:  dto.combord_grade,
          combord_nom:    dto.combord_nom,
          combord_prenom: dto.combord_prenom,
          combord_id:     dto.combord_id ?? null,
          escadron_id:    dto.escadron_id ?? null,
          cree_par:       user.sub,
          statut:         StatutVol.PLANIFIE,
          itineraire:     { create: itineraire },
        },
        include: {
          itineraire: {
            include: { base: { select: { code_base: true, nom: true } } },
            orderBy: { ordre: 'asc' },
          },
          aeronef: { select: { immatriculation: true, type: true } },
        },
      });

      if (!dto.combord_id) {
        this.logger.warn(
          `Vol ${vol.numero_mission} créé sans compte COMBORD : le visa final ne pourra pas être attribué.`,
        );
      }

      await this.events.publish(VOL_EVENTS.VOL_PLANIFIE, {
        vol_id:         vol.id,
        numero_mission: vol.numero_mission,
        base_depart_id: vol.base_depart_id,
        cree_par:       user.sub,
        itineraire: vol.itineraire.map((e) => ({
          ordre: e.ordre, base_id: e.base_id, code_base: e.base.code_base, rmia: e.rmia as Rmia,
        })),
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Vol planifié : ${vol.numero_mission} par ${user.sub} — ` +
          vol.itineraire.map((e) => e.base.code_base).join(' → '),
      );

      return vol;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Le numéro de mission ${dto.numero_mission} existe déjà`);
      }
      throw e;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lecture
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Clause de visibilité d'un utilisateur sur les vols.
   *
   * ── Le point sensible : un vol non diffusé n'existe pour personne d'autre ──
   * La directive est explicite — « le vol planifié n'est pas publié, donc n'est
   * pas encore visible par tous les utilisateurs mais uniquement par le SCOPS ».
   * Filtrer sur `statut: DIFFUSE` est donc une règle de confidentialité, pas un
   * confort d'affichage : un COMRMIA qui verrait les vols en planification
   * pourrait anticiper des mouvements que le commandement n'a pas arrêtés.
   */
  private filtreVisibilite(user: JwtPayload): Prisma.VolWhereInput {
    const base = { statut: { not: StatutVol.ANNULE } } as Prisma.VolWhereInput;
    const portee = perimetreEffectif(user);

    // SCOPS, ADMIN, CEMAA, MAGE : tout, diffusé ou non.
    if (portee === Perimetre.NATIONAL) return base;

    if (portee === Perimetre.RMIA) {
      const rmias = rmiasCouvertes(user);
      return {
        ...base,
        statut: { in: [StatutVol.DIFFUSE, StatutVol.EN_COURS, StatutVol.CLOTURE] },
        // Un point d'itinéraire dans leur RMIA suffit. Le filtrage fin
        // « point d'embarquement seulement » relève des listes, pas du vol :
        // la RMIA d'arrivée a légitimement besoin de savoir qui se pose chez elle.
        itineraire: { some: { rmia: { in: rmias } } },
      };
    }

    // Périmètre base. Deux cas se cumulent :
    //   • les vols au départ de la base, visibles dès la planification — leur
    //     créateur et sa hiérarchie doivent pouvoir les relire ;
    //   • les vols diffusés qui touchent la base, à quelque titre que ce soit.
    return {
      ...base,
      OR: [
        { base_depart_id: user.base_id },
        {
          statut: { in: [StatutVol.DIFFUSE, StatutVol.EN_COURS, StatutVol.CLOTURE] },
          itineraire: { some: { base_id: user.base_id } },
        },
      ],
    };
  }

  async findAll(user: JwtPayload): Promise<unknown[]> {
    return this.prisma.vol.findMany({
      where: this.filtreVisibilite(user),
      include: {
        aeronef: { select: { immatriculation: true, type: true } },
        itineraire: {
          select: {
            id: true, ordre: true, base_id: true, rmia: true,
            quota_places: true, quota_masse_kg: true,
            base: { select: { code_base: true, nom: true } },
          },
          orderBy: { ordre: 'asc' },
        },
      },
      orderBy: { date_heure: 'asc' },
    });
  }

  /**
   * Un vol, sous réserve de visibilité.
   *
   * Le contrôle passe par `findFirst` avec la clause de visibilité et non par
   * un `findUnique` suivi d'un test : un 404 ne révèle pas l'existence d'un vol
   * que l'appelant n'a pas le droit de connaître, là où un 403 la révélerait.
   */
  async findOne(id: string, user: JwtPayload): Promise<unknown> {
    const vol = await this.prisma.vol.findFirst({
      where: { AND: [{ id }, this.filtreVisibilite(user)] },
      include: {
        aeronef: true,
        escadron: { select: { id: true, code: true, nom: true } },
        itineraire: {
          include: {
            base: { select: { id: true, code_base: true, nom: true, region: true } },
            listes: {
              select: {
                id: true, rmia: true, statut: true, etape_courante: true,
                quota_places: true, quota_masse_kg: true,
              },
            },
          },
          orderBy: { ordre: 'asc' },
        },
        manifestes: { select: { id: true, statut: true, base_id: true, etape_courante: true } },
      },
    });
    if (!vol) throw new NotFoundException(`Vol ${id} introuvable ou hors de votre périmètre`);
    return vol;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Annulation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Un vol porteur de manifestes ne se supprime pas : il s'annule.
   *
   * Restriction ajoutée : seul le créateur, sa base, ou le SCOPS peut annuler.
   * Sans elle, tout COMBASE pouvait annuler le vol d'une autre base dès lors
   * qu'il en connaissait l'identifiant — la version antérieure n'opérait aucun
   * contrôle de périmètre sur cette route.
   */
  async annuler(id: string, user: JwtPayload, motif?: string): Promise<unknown> {
    const vol = await this.prisma.vol.findUnique({
      where: { id },
      select: { id: true, statut: true, base_depart_id: true, cree_par: true, numero_mission: true },
    });
    if (!vol) throw new NotFoundException(`Vol ${id} introuvable`);

    const national = perimetreEffectif(user) === Perimetre.NATIONAL;
    const siens    = vol.base_depart_id === user.base_id || vol.cree_par === user.sub;
    if (!national && !siens) {
      throw new NotFoundException(`Vol ${id} introuvable ou hors de votre périmètre`);
    }

    if (vol.statut === StatutVol.ANNULE)  throw new BadRequestException('Vol déjà annulé');
    if (vol.statut === StatutVol.CLOTURE) throw new BadRequestException('Un vol clôturé ne peut plus être annulé');

    const annule = await this.prisma.vol.update({
      where: { id },
      data:  { statut: StatutVol.ANNULE },
    });

    await this.events.publish(VOL_EVENTS.VOL_ANNULE, {
      vol_id: id, motif: motif ?? null, annule_par: user.sub,
      timestamp: new Date().toISOString(),
    });

    this.logger.warn(
      `Vol annulé : ${vol.numero_mission} par ${user.sub}` + (motif ? ` — ${motif}` : ''),
    );
    return annule;
  }

  /** Vols en attente d'allocation de quota. Écran d'entrée du SCOPS. */
  async enAttenteDiffusion(user: JwtPayload): Promise<unknown[]> {
    if (!rolesEffectifs(user).some((r) =>
      r === RoleUtilisateur.SCOPS || r === RoleUtilisateur.ADMIN)) {
      throw new NotFoundException('Ressource introuvable');
    }
    return this.prisma.vol.findMany({
      where: { statut: StatutVol.PLANIFIE },
      include: {
        aeronef: { select: { immatriculation: true, type: true, capacite_places: true } },
        itineraire: {
          select: {
            id: true, ordre: true, rmia: true,
            base: { select: { code_base: true, nom: true } },
          },
          orderBy: { ordre: 'asc' },
        },
      },
      orderBy: { date_heure: 'asc' },
    });
  }
}