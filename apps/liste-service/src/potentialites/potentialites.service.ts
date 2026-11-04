// apps/liste-service/src/potentialites/potentialites.service.ts
//
// Vivier des voyageurs potentiels, tenu par le secrétaire de l'Adjoint Air.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI CHANGE
// ═══════════════════════════════════════════════════════════════════════════
// La « base de présentation » disparaît au profit du besoin réellement exprimé
// par le demandeur : un jour, un départ, une arrivée. Le vivier devient
// interrogeable par ces trois critères, ce qui est tout son intérêt : à la
// diffusion d'un vol, le secrétaire retrouve en une requête les candidats qui
// l'attendaient, au lieu de relire une liste non ordonnée.
//
// Le secrétaire n'étant plus rattaché à une base, la RMIA est son unique
// périmètre. C'est elle, et elle seule, qui cloisonne le vivier.

import {
  Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@sigea/shared-database';
import {
  JwtPayload, Rmia, RoleUtilisateur, StatutPotentialite, Priorite,
  rolesEffectifs, rmiasCouvertes,
} from '@sigea/shared-types';
import {
  CreatePotentialiteDto, UpdatePotentialiteDto, FiltrePotentialiteDto,
} from './dto/potentialite.dto';

/** Horizon de validité par défaut d'une potentialité, en jours. */
const VALIDITE_DEFAUT_JOURS = 90;

@Injectable()
export class PotentialitesService {
  private readonly logger = new Logger(PotentialitesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * RMIA de travail de l'utilisateur.
   *
   * Lève plutôt que de renvoyer une valeur par défaut : un secrétaire sans
   * RMIA est une erreur d'administration, et ouvrir le vivier national « en
   * attendant » exposerait l'identité de voyageurs d'autres régions.
   */
  private rmiaDeTravail(user: JwtPayload): Rmia {
    const couvertes = rmiasCouvertes(user);
    if (!couvertes.length) {
      throw new ForbiddenException(
        "Votre compte n'est rattaché à aucune RMIA. Contactez l'administrateur.",
      );
    }
    // Un suppléant peut couvrir deux RMIA. On retient la sienne en priorité :
    // c'est celle dans laquelle il travaille par défaut.
    return (user.rmia as Rmia | undefined) ?? couvertes[0];
  }

  private exigerSaisisseur(user: JwtPayload): void {
    if (!rolesEffectifs(user).includes(RoleUtilisateur.SEC_ADJ_AIR)) {
      throw new ForbiddenException(
        "Seul le secrétaire de l'Adjoint Air tient le vivier des potentialités.",
      );
    }
  }

  /** Vérifie que les bases citées existent, sans contrainte de région. */
  private async verifierBases(dto: CreatePotentialiteDto, rmia: Rmia): Promise<void> {
    if (dto.base_depart_id && dto.base_depart_id === dto.base_arrivee_id) {
      throw new BadRequestException('Départ et destination identiques.');
    }

    if (dto.base_depart_id) {
      const depart = await this.prisma.base.findUnique({
        where: { id: dto.base_depart_id },
        select: { rmia: true, code_base: true },
      });
      if (!depart) throw new BadRequestException('Base de départ inconnue.');
      if (depart.rmia !== rmia) {
        throw new BadRequestException(
          `${depart.code_base} relève de la ${String(depart.rmia).replace('_', ' ')}. ` +
            'Vous ne pouvez enregistrer que des départs depuis les bases de votre région ; ' +
            'ce demandeur doit se présenter au secrétariat compétent.',
        );
      }
    }

    if (dto.base_arrivee_id) {
      const arrivee = await this.prisma.base.count({ where: { id: dto.base_arrivee_id } });
      if (!arrivee) throw new BadRequestException('Base de destination inconnue.');
    }
  }

  async creer(dto: CreatePotentialiteDto, user: JwtPayload): Promise<unknown> {
    this.exigerSaisisseur(user);
    const rmia = this.rmiaDeTravail(user);
    await this.verifierBases(dto, rmia);

    const valable = dto.valable_jusqu_au
      ? new Date(dto.valable_jusqu_au)
      : new Date(Date.now() + VALIDITE_DEFAUT_JOURS * 86_400_000);

    const cree = await this.prisma.potentialite.create({
      data: {
        rmia,
        nom:    dto.nom.trim(),
        prenom: dto.prenom.trim(),
        grade:     dto.grade?.trim()     ?? null,
        matricule: dto.matricule?.trim() ?? null,
        cni:       dto.cni?.trim()       ?? null,
        unite:     dto.unite?.trim()     ?? null,
        telephone: dto.telephone.replace(/[\s.-]/g, ''),
        categorie: dto.categorie,
        priorite_proposee: dto.priorite_proposee ?? Priorite.P4,

        date_vol_souhaitee: dto.date_vol_souhaitee ? new Date(dto.date_vol_souhaitee) : null,
        base_depart_id:     dto.base_depart_id  ?? null,
        base_arrivee_id:    dto.base_arrivee_id ?? null,

        motif:            dto.motif ?? null,
        ref_autorisation: dto.ref_autorisation ?? null,
        nb_bagages:       dto.nb_bagages ?? 0,
        masse_bagages_kg: dto.masse_bagages_kg ?? 0,
        contact_urgence_nom:  dto.contact_urgence_nom ?? null,
        contact_urgence_tel:  dto.contact_urgence_tel?.replace(/[\s.-]/g, '') ?? null,
        contact_urgence_qual: dto.contact_urgence_qual ?? null,
        valable_jusqu_au: valable,
        enregistre_par:   user.sub,
      },
      include: {
        base_depart:  { select: { code_base: true, nom: true } },
        base_arrivee: { select: { code_base: true, nom: true } },
      },
    });

    this.logger.log(
      `Potentialité enregistrée : ${cree.nom} ${cree.prenom} (${rmia}) par ${user.sub}`,
    );
    return cree;
  }

  /**
   * Vivier, filtré.
   *
   * ── Le filtre par période ──
   * Il admet les potentialités SANS date souhaitée lorsque `inclure_sans_date`
   * est actif, et c'est le comportement par défaut de l'écran de sélection :
   * un demandeur qui n'a pas précisé de jour reste candidat à tout vol, et
   * l'écarter d'office reviendrait à le pénaliser pour une information qu'on
   * ne lui a pas demandée.
   */
  async lister(filtre: FiltrePotentialiteDto, user: JwtPayload): Promise<unknown> {
    const rmias = rmiasCouvertes(user);
    if (!rmias.length) {
      throw new ForbiddenException("Votre compte n'est rattaché à aucune RMIA.");
    }

    const page   = Math.max(1, filtre.page ?? 1);
    const taille = Math.min(200, Math.max(1, filtre.taille ?? 50));

    const et: Prisma.PotentialiteWhereInput[] = [{ rmia: { in: rmias } }];

    if (filtre.statut)    et.push({ statut: filtre.statut });
    if (filtre.categorie) et.push({ categorie: filtre.categorie });
    if (filtre.base_depart_id)  et.push({ base_depart_id: filtre.base_depart_id });
    if (filtre.base_arrivee_id) et.push({ base_arrivee_id: filtre.base_arrivee_id });

    if (filtre.inclure_perimees !== '1') {
      et.push({
        OR: [{ valable_jusqu_au: null }, { valable_jusqu_au: { gte: new Date() } }],
      });
    }

    if (filtre.date_debut || filtre.date_fin) {
      const periode: Prisma.DateTimeFilter = {};
      if (filtre.date_debut) periode.gte = new Date(filtre.date_debut);
      if (filtre.date_fin)   periode.lte = new Date(filtre.date_fin);

      et.push(
        filtre.inclure_sans_date === '0'
          ? { date_vol_souhaitee: periode }
          : { OR: [{ date_vol_souhaitee: periode }, { date_vol_souhaitee: null }] },
      );
    }

    if (filtre.q) {
      // `mode: insensitive` est indispensable : les noms sont saisis tantôt en
      // capitales, tantôt non, et une recherche sensible à la casse ne
      // trouverait rien une fois sur deux.
      et.push({
        OR: [
          { nom:       { contains: filtre.q, mode: 'insensitive' } },
          { prenom:    { contains: filtre.q, mode: 'insensitive' } },
          { matricule: { contains: filtre.q, mode: 'insensitive' } },
          { cni:       { contains: filtre.q, mode: 'insensitive' } },
          { unite:     { contains: filtre.q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.PotentialiteWhereInput = { AND: et };

    const [total, elements] = await this.prisma.$transaction([
      this.prisma.potentialite.count({ where }),
      this.prisma.potentialite.findMany({
        where,
        // Jour souhaité d'abord, priorité ensuite : le secrétaire travaille par
        // vol, donc par date. Trier d'abord par priorité mélangerait les jours
        // et l'obligerait à parcourir toute la liste.
        orderBy: [
          { date_vol_souhaitee: 'asc' },
          { priorite_proposee: 'asc' },
          { createdAt: 'asc' },
        ],
        skip: (page - 1) * taille,
        take: taille,
        include: {
          base_depart:  { select: { code_base: true, nom: true } },
          base_arrivee: { select: { code_base: true, nom: true } },
          _count: { select: { pieces: true } },
        },
      }),
    ]);

    return { total, page, taille, elements };
  }

  /** Fiche complète, pièces jointes comprises. */
  async consulter(id: string, user: JwtPayload): Promise<unknown> {
    const rmias = rmiasCouvertes(user);
    const p = await this.prisma.potentialite.findFirst({
      where: { id, ...(rmias.length ? { rmia: { in: rmias } } : {}) },
      include: {
        base_depart:  { select: { code_base: true, nom: true } },
        base_arrivee: { select: { code_base: true, nom: true } },
        pieces: {
          select: {
            id: true, nature: true, nom_fichier: true, type_mime: true,
            taille_octets: true, sha256: true, createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!p) throw new NotFoundException('Potentialité introuvable ou hors de votre périmètre.');
    return p;
  }

  async modifier(id: string, dto: UpdatePotentialiteDto, user: JwtPayload): Promise<unknown> {
    this.exigerSaisisseur(user);
    const p = await this.chargerDansPerimetre(id, user);
    await this.verifierBases(dto, p.rmia as Rmia);

    // Une potentialité RETENUE est portée sur une liste engagée dans le
    // circuit. La modifier ici ne changerait rien à la ligne — l'identité y est
    // recopiée et figée — mais ferait croire au secrétaire qu'il a corrigé le
    // document signé. On refuse plutôt que de laisser s'installer ce malentendu.
    if (p.statut === StatutPotentialite.RETENUE) {
      throw new BadRequestException(
        'Cette personne est portée sur une liste en cours de validation. ' +
          "La correction doit être demandée à l'autorité qui détient la liste.",
      );
    }

    return this.prisma.potentialite.update({
      where: { id },
      data: {
        nom:    dto.nom.trim(),
        prenom: dto.prenom.trim(),
        grade:     dto.grade?.trim()     ?? null,
        matricule: dto.matricule?.trim() ?? null,
        cni:       dto.cni?.trim()       ?? null,
        unite:     dto.unite?.trim()     ?? null,
        telephone: dto.telephone.replace(/[\s.-]/g, ''),
        categorie: dto.categorie,
        priorite_proposee: dto.priorite_proposee ?? p.priorite_proposee,
        date_vol_souhaitee: dto.date_vol_souhaitee ? new Date(dto.date_vol_souhaitee) : null,
        base_depart_id:     dto.base_depart_id  ?? null,
        base_arrivee_id:    dto.base_arrivee_id ?? null,
        motif:            dto.motif ?? null,
        ref_autorisation: dto.ref_autorisation ?? null,
        nb_bagages:       dto.nb_bagages ?? 0,
        masse_bagages_kg: dto.masse_bagages_kg ?? 0,
        contact_urgence_nom:  dto.contact_urgence_nom ?? null,
        contact_urgence_tel:  dto.contact_urgence_tel?.replace(/[\s.-]/g, '') ?? null,
        contact_urgence_qual: dto.contact_urgence_qual ?? null,
        ...(dto.valable_jusqu_au ? { valable_jusqu_au: new Date(dto.valable_jusqu_au) } : {}),
      },
    });
  }

  /**
   * Archive une potentialité.
   *
   * Archivage et non suppression : le vivier est aussi la trace des demandes
   * reçues. Savoir qui s'est présenté, et n'a pas voyagé, a une valeur propre.
   */
  async archiver(id: string, motif: string, user: JwtPayload): Promise<unknown> {
    this.exigerSaisisseur(user);
    const p = await this.chargerDansPerimetre(id, user);
    if (p.statut === StatutPotentialite.RETENUE) {
      throw new BadRequestException(
        "Cette personne est portée sur une liste en cours : retirez-la de la liste avant de l'archiver.",
      );
    }
    return this.prisma.potentialite.update({
      where: { id },
      data:  { statut: StatutPotentialite.ARCHIVEE, motif: motif.trim() },
    });
  }

  private async chargerDansPerimetre(id: string, user: JwtPayload) {
    const rmias = rmiasCouvertes(user);
    const p = await this.prisma.potentialite.findFirst({
      where: { id, rmia: { in: rmias } },
    });
    if (!p) {
      throw new NotFoundException('Potentialité introuvable ou hors de votre région militaire.');
    }
    return p;
  }
}