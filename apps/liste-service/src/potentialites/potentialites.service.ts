// apps/liste-service/src/potentialites/potentialites.service.ts
//
// Vivier des voyageurs potentiels, tenu par le secrétaire de l'Adjoint Air.
//
// Raison d'être, telle que la directive la formule : permettre au secrétaire
// d'enregistrer au fil de l'eau les demandeurs qui se présentent, AVANT qu'un
// vol soit diffusé, pour qu'il puisse constituer une liste en quelques minutes
// dès qu'un quota tombe.
//
// Conséquence à ne pas perdre de vue : un enregistrement ici n'emporte AUCUN
// droit à embarquer, et le code ne doit jamais laisser croire le contraire —
// d'où l'absence totale de notion de rang ou de file d'attente à ce niveau.

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

  private estSaisisseur(user: JwtPayload): boolean {
    return rolesEffectifs(user).includes(RoleUtilisateur.SEC_ADJ_AIR);
  }

  async creer(dto: CreatePotentialiteDto, user: JwtPayload): Promise<unknown> {
    if (!this.estSaisisseur(user)) {
      throw new ForbiddenException(
        "Seul le secrétaire de l'Adjoint Air enregistre les potentialités.",
      );
    }
    const rmia = this.rmiaDeTravail(user);
    const base_id = dto.base_id ?? user.base_id;

    // La base de présentation doit relever de la RMIA du secrétaire : sans ce
    // contrôle, un `base_id` fourni dans le corps suffirait à déposer un nom
    // dans le vivier d'une autre région.
    const base = await this.prisma.base.findFirst({
      where: { id: base_id, rmia },
      select: { id: true },
    });
    if (!base) {
      throw new BadRequestException(
        'Base de présentation inconnue ou hors de votre région militaire.',
      );
    }

    const valable = dto.valable_jusqu_au
      ? new Date(dto.valable_jusqu_au)
      : new Date(Date.now() + VALIDITE_DEFAUT_JOURS * 86_400_000);

    const cree = await this.prisma.potentialite.create({
      data: {
        rmia,
        base_id,
        nom:    dto.nom.trim(),
        prenom: dto.prenom.trim(),
        grade:     dto.grade?.trim()     ?? null,
        matricule: dto.matricule?.trim() ?? null,
        cni:       dto.cni?.trim()       ?? null,
        unite:     dto.unite?.trim()     ?? null,
        telephone: dto.telephone.replace(/[\s.-]/g, ''),
        categorie: dto.categorie,
        priorite_proposee:     dto.priorite_proposee ?? Priorite.P4,
        destination_souhaitee: dto.destination_souhaitee ?? null,
        motif:                 dto.motif ?? null,
        ref_autorisation:      dto.ref_autorisation ?? null,
        nb_bagages:            dto.nb_bagages ?? 0,
        masse_bagages_kg:      dto.masse_bagages_kg ?? 0,
        contact_urgence_nom:   dto.contact_urgence_nom ?? null,
        contact_urgence_tel:   dto.contact_urgence_tel?.replace(/[\s.-]/g, '') ?? null,
        contact_urgence_qual:  dto.contact_urgence_qual ?? null,
        valable_jusqu_au:      valable,
        enregistre_par:        user.sub,
      },
    });

    this.logger.log(`Potentialité enregistrée : ${cree.nom} ${cree.prenom} (${rmia}) par ${user.sub}`);
    return cree;
  }

  async lister(filtre: FiltrePotentialiteDto, user: JwtPayload): Promise<unknown> {
    const rmias = rmiasCouvertes(user);
    if (!rmias.length) {
      throw new ForbiddenException("Votre compte n'est rattaché à aucune RMIA.");
    }

    const page   = Math.max(1, filtre.page ?? 1);
    const taille = Math.min(200, Math.max(1, filtre.taille ?? 50));

    const where: Prisma.PotentialiteWhereInput = {
      rmia: { in: rmias },
      ...(filtre.statut    ? { statut: filtre.statut }       : {}),
      ...(filtre.categorie ? { categorie: filtre.categorie } : {}),
      ...(filtre.base_id   ? { base_id: filtre.base_id }     : {}),
      ...(filtre.inclure_perimees === '1'
        ? {}
        : { OR: [{ valable_jusqu_au: null }, { valable_jusqu_au: { gte: new Date() } }] }),
      ...(filtre.q
        ? {
            // `mode: insensitive` est indispensable : les noms sont saisis
            // tantôt en capitales, tantôt non, et une recherche sensible à la
            // casse ne trouverait rien une fois sur deux.
            OR: [
              { nom:       { contains: filtre.q, mode: 'insensitive' } },
              { prenom:    { contains: filtre.q, mode: 'insensitive' } },
              { matricule: { contains: filtre.q, mode: 'insensitive' } },
              { cni:       { contains: filtre.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, elements] = await this.prisma.$transaction([
      this.prisma.potentialite.count({ where }),
      this.prisma.potentialite.findMany({
        where,
        orderBy: [{ priorite_proposee: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * taille,
        take: taille,
        include: { base: { select: { code_base: true, nom: true } } },
      }),
    ]);

    return { total, page, taille, elements };
  }

  async modifier(id: string, dto: UpdatePotentialiteDto, user: JwtPayload): Promise<unknown> {
    if (!this.estSaisisseur(user)) {
      throw new ForbiddenException("Seul le secrétaire de l'Adjoint Air modifie les potentialités.");
    }
    const p = await this.chargerDansPerimetre(id, user);

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
        priorite_proposee:     dto.priorite_proposee ?? p.priorite_proposee,
        destination_souhaitee: dto.destination_souhaitee ?? null,
        motif:                 dto.motif ?? null,
        ref_autorisation:      dto.ref_autorisation ?? null,
        nb_bagages:            dto.nb_bagages ?? 0,
        masse_bagages_kg:      dto.masse_bagages_kg ?? 0,
        contact_urgence_nom:   dto.contact_urgence_nom ?? null,
        contact_urgence_tel:   dto.contact_urgence_tel?.replace(/[\s.-]/g, '') ?? null,
        contact_urgence_qual:  dto.contact_urgence_qual ?? null,
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
    if (!this.estSaisisseur(user)) {
      throw new ForbiddenException("Seul le secrétaire de l'Adjoint Air archive les potentialités.");
    }
    const p = await this.chargerDansPerimetre(id, user);
    if (p.statut === StatutPotentialite.RETENUE) {
      throw new BadRequestException(
        'Cette personne est portée sur une liste en cours : retirez-la de la liste avant de l\'archiver.',
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
    if (!p) throw new NotFoundException('Potentialité introuvable ou hors de votre région militaire.');
    return p;
  }
}