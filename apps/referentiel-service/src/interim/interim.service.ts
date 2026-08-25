// apps/referentiel-service/src/interim/interim.service.ts
//
// Gestionnaire d'intérim et de mouvements de personnel.
//
// ── Principe directeur ──
// On ne bascule JAMAIS le rôle d'un compte pour lui faire jouer un intérim.
// Le suppléant conserve son rôle propre et reçoit, le temps de la délégation,
// les attributions d'un second rôle. Trois raisons :
//   1. un COMESO couvrant le COMGMO doit pouvoir signer LES DEUX étapes ;
//   2. une bascule de rôle rendrait les journaux d'audit illisibles a
//      posteriori — on ne saurait plus qui était réellement qui ;
//   3. la fin de l'intérim se réduit alors à un UPDATE d'un drapeau, sans
//      restauration d'un état antérieur qu'il faudrait avoir mémorisé.
//
// Le mécanisme d'autorisation associé vit dans RolesGuard (rolesEffectifs).

import {
  Injectable, BadRequestException, ConflictException, NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { RoleUtilisateur, TypeMouvement, ROLES_AVEC_ESCADRON } from '@sigea/shared-types';
import { CreateInterimDto, RevoquerInterimDto, CreateMouvementDto } from './dto/interim.dto';

@Injectable()
export class InterimService {
  private readonly logger = new Logger(InterimService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Intérim
  // ─────────────────────────────────────────────────────────────────────────

  async creer(dto: CreateInterimDto, adminId: string): Promise<unknown> {
    if (dto.titulaire_id === dto.suppleant_id) {
      throw new BadRequestException('Un agent ne peut pas assurer son propre intérim');
    }

    const [titulaire, suppleant] = await Promise.all([
      this.prisma.utilisateur.findUnique({
        where: { id: dto.titulaire_id },
        select: { id: true, nom: true, prenom: true, grade: true, role: true,
                  base_id: true, escadron_id: true, actif: true },
      }),
      this.prisma.utilisateur.findUnique({
        where: { id: dto.suppleant_id },
        select: { id: true, nom: true, prenom: true, grade: true, role: true,
                  base_id: true, actif: true },
      }),
    ]);

    if (!titulaire) throw new NotFoundException('Titulaire introuvable');
    if (!suppleant) throw new NotFoundException('Suppléant introuvable');
    if (!suppleant.actif) {
      throw new BadRequestException('Le suppléant désigné a un compte désactivé');
    }

    // ── Contrainte de base ──
    // Titulaire et suppléant doivent relever de la même base.
    //
    // C'est LA décision structurante de ce module. Elle garantit que le
    // cloisonnement par base_id du jeton reste intact : le suppléant signe
    // avec SA base, qui est aussi celle du poste couvert. Autoriser un
    // intérim inter-bases obligerait à faire porter au jeton une base
    // d'exercice distincte de la base d'affectation, et à réviser tous les
    // filtres `base_id: user.base_id` du système — y compris le RLS.
    if (titulaire.base_id !== suppleant.base_id) {
      throw new BadRequestException(
        'Intérim inter-bases non autorisé : titulaire et suppléant doivent relever de la même base. ' +
        'Pour couvrir un poste sur une autre base, procédez à une mutation temporaire (gestionnaire de mouvements).',
      );
    }

    const role_delegue = dto.role_delegue ?? (titulaire.role as RoleUtilisateur);

    if (role_delegue === RoleUtilisateur.ADMIN) {
      throw new BadRequestException(
        "Le rôle administrateur ne se délègue pas par intérim : créez un second compte d'administration nominatif.",
      );
    }
    if (role_delegue === suppleant.role) {
      throw new BadRequestException(
        `Le suppléant exerce déjà le rôle ${role_delegue} : aucune délégation n'est nécessaire.`,
      );
    }

    const debut = dto.date_debut ? new Date(dto.date_debut) : new Date();
    const fin   = dto.date_fin   ? new Date(dto.date_fin)   : null;
    if (fin && fin <= debut) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début');
    }

    try {
      const interim = await this.prisma.interim.create({
        data: {
          titulaire_id: titulaire.id,
          suppleant_id: suppleant.id,
          role_delegue,
          base_id:      titulaire.base_id,
          escadron_id:  titulaire.escadron_id ?? null,
          motif:        dto.motif ?? null,
          date_debut:   debut,
          date_fin:     fin,
          actif:        true,
          cree_par:     adminId,
        },
        include: this.includeParties(),
      });

      this.logger.warn(
        `Intérim ouvert : ${suppleant.nom} assure le rôle ${role_delegue} de ${titulaire.nom} ` +
        `(base=${titulaire.base_id}, par=${adminId})`,
      );
      return interim;
    } catch (e: unknown) {
      // Les index uniques partiels de la migration portent la règle :
      // un poste n'est couvert que par un suppléant à la fois.
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'Une délégation active existe déjà pour ce poste ou pour ce suppléant sur ce rôle. ' +
          'Révoquez-la avant d\'en ouvrir une nouvelle.',
        );
      }
      throw e;
    }
  }

  /**
   * Délégations en vigueur À CET INSTANT.
   *
   * Le filtre temporel est appliqué en SQL et non après coup : une délégation
   * programmée pour la semaine prochaine ne doit jamais apparaître comme
   * active, même une seconde.
   */
  async actives(base_id?: string, suppleant_id?: string): Promise<unknown[]> {
    const maintenant = new Date();
    return this.prisma.interim.findMany({
      where: {
        actif: true,
        date_debut: { lte: maintenant },
        OR: [{ date_fin: null }, { date_fin: { gt: maintenant } }],
        ...(base_id      ? { base_id }      : {}),
        ...(suppleant_id ? { suppleant_id } : {}),
      },
      include: this.includeParties(),
      orderBy: { date_debut: 'desc' },
    });
  }

  /** Historique complet, révoqués et échus compris. */
  async historique(base_id?: string): Promise<unknown[]> {
    return this.prisma.interim.findMany({
      where: base_id ? { base_id } : {},
      include: this.includeParties(),
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  /**
   * Révocation immédiate.
   *
   * ── Fenêtre résiduelle, à connaître ──
   * Les délégations sont inscrites dans le jeton d'accès à l'émission. Une
   * révocation ne les en retire donc pas : le suppléant conserve ses
   * attributions déléguées jusqu'à expiration du jeton (15 min par défaut).
   *
   * Atténuation retenue : les sessions du suppléant sont supprimées dans la
   * même transaction. Son jeton de rafraîchissement devient inopérant, il ne
   * peut donc pas prolonger la fenêtre — elle est bornée à la durée de vie du
   * jeton courant, et non indéfinie.
   *
   * Suppression totale de la fenêtre : il faudrait relire Interim à chaque
   * requête, soit une lecture supplémentaire sur tout le circuit. Le jeu n'en
   * vaut pas la chandelle pour 15 minutes ; c'est un arbitrage, pas un oubli.
   */
  async revoquer(id: string, dto: RevoquerInterimDto, adminId: string): Promise<unknown> {
    const existing = await this.prisma.interim.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Intérim introuvable');
    if (!existing.actif) throw new BadRequestException('Intérim déjà révoqué ou clos');

    const [interim] = await this.prisma.$transaction([
      this.prisma.interim.update({
        where: { id },
        data: {
          actif: false,
          revoque_par: adminId,
          revoque_le: new Date(),
          motif_revocation: dto.motif,
        },
        include: this.includeParties(),
      }),
      this.prisma.session.deleteMany({ where: { utilisateur_id: existing.suppleant_id } }),
    ]);

    this.logger.warn(
      `Intérim révoqué : ${id} (suppléant=${existing.suppleant_id}, par=${adminId}) — sessions purgées`,
    );
    return interim;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mouvements de personnel
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Mutation, départ, suspension ou réintégration.
   *
   * Tout se joue dans UNE transaction : la trace du mouvement, la mise à jour
   * du compte, la révocation des délégations et le transfert au successeur.
   * Un mouvement partiellement appliqué laisserait un agent muté conservant
   * les attributions de son ancien poste — exactement ce que ce module doit
   * empêcher.
   */
  async mouvement(dto: CreateMouvementDto, adminId: string): Promise<unknown> {
    const agent = await this.prisma.utilisateur.findUnique({
      where: { id: dto.utilisateur_id },
      select: { id: true, nom: true, prenom: true, role: true, base_id: true,
                escadron_id: true, actif: true },
    });
    if (!agent) throw new NotFoundException('Utilisateur introuvable');

    const base_apres = dto.base_apres ? await this.resolveBaseId(dto.base_apres) : undefined;
    const role_apres = dto.role_apres;

    if (dto.type === TypeMouvement.MUTATION && !base_apres && !role_apres) {
      throw new BadRequestException(
        'Une mutation doit préciser au moins une nouvelle base ou un nouveau rôle',
      );
    }

    // Cohérence escadron : un COMEA sans escadron est refusé par la contrainte
    // CHECK de la base. On le détecte ici pour renvoyer un message utile
    // plutôt qu'une violation de contrainte brute.
    const roleFinal    = (role_apres ?? agent.role) as RoleUtilisateur;
    const baseFinale   = base_apres ?? agent.base_id;
    let   escadronFinal = dto.escadron_apres ?? agent.escadron_id ?? null;

    if (ROLES_AVEC_ESCADRON.includes(roleFinal)) {
      if (!escadronFinal) {
        throw new BadRequestException(
          `Le rôle ${roleFinal} impose un escadron de rattachement : précisez escadron_apres.`,
        );
      }
      const esc = await this.prisma.escadron.findUnique({
        where: { id: escadronFinal }, select: { base_id: true, actif: true },
      });
      if (!esc)          throw new BadRequestException('Escadron introuvable');
      if (!esc.actif)    throw new BadRequestException('Escadron désactivé');
      if (esc.base_id !== baseFinale) {
        throw new BadRequestException(
          "L'escadron désigné n'appartient pas à la base d'affectation retenue",
        );
      }
    } else {
      // Un agent qui quitte le rôle COMEA perd son rattachement d'escadron :
      // le laisser produirait un COMESO rattaché à un escadron, incohérent
      // dans tout croisement statistique ultérieur.
      escadronFinal = null;
    }

    const desactive = dto.type === TypeMouvement.DEPART || dto.type === TypeMouvement.SUSPENSION;

    return this.prisma.$transaction(async (tx) => {
      // 1. Trace de la décision, avant toute modification d'état.
      const trace = await tx.mouvementPersonnel.create({
        data: {
          utilisateur_id: agent.id,
          type:           dto.type,
          base_avant:     agent.base_id,
          base_apres:     base_apres ?? null,
          role_avant:     agent.role,
          role_apres:     role_apres ?? null,
          escadron_avant: agent.escadron_id ?? null,
          escadron_apres: escadronFinal,
          successeur_id:  dto.successeur_id ?? null,
          date_effet:     dto.date_effet ? new Date(dto.date_effet) : new Date(),
          motif:          dto.motif ?? null,
          reference:      dto.reference ?? null,
          decide_par:     adminId,
        },
      });

      // 2. Toute délégation impliquant l'agent tombe.
      //    Un agent muté ne peut plus être suppléant sur sa base d'origine, et
      //    son propre poste n'a plus de titulaire à couvrir.
      await tx.interim.updateMany({
        where: {
          actif: true,
          OR: [{ titulaire_id: agent.id }, { suppleant_id: agent.id }],
        },
        data: {
          actif: false,
          revoque_par: adminId,
          revoque_le: new Date(),
          motif_revocation: `Mouvement ${dto.type} de l'agent (${trace.id})`,
        },
      });

      // 3. Sessions purgées : la reconnexion réémettra un jeton conforme au
      //    nouvel état. Sans cela, l'ancien jeton porterait l'ancienne base.
      await tx.session.deleteMany({ where: { utilisateur_id: agent.id } });

      // 4. Mise à jour du compte.
      const maj = await tx.utilisateur.update({
        where: { id: agent.id },
        data: {
          ...(base_apres ? { base_id: base_apres } : {}),
          ...(role_apres ? { role: role_apres }   : {}),
          escadron_id: escadronFinal,
          ...(desactive                          ? { actif: false } : {}),
          ...(dto.type === TypeMouvement.REINTEGRATION ? { actif: true } : {}),
        },
        select: { id: true, nom: true, prenom: true, grade: true, role: true,
                  base_id: true, escadron_id: true, actif: true },
      });

      // 5. Transfert au successeur, si désigné.
      //    Le successeur reprend le poste : rôle, base et escadron de l'agent
      //    AVANT mouvement. C'est cela, « faire basculer les privilèges ».
      let successeur = null;
      if (dto.successeur_id) {
        if (dto.successeur_id === agent.id) {
          throw new BadRequestException('Un agent ne peut pas être son propre successeur');
        }
        successeur = await tx.utilisateur.update({
          where: { id: dto.successeur_id },
          data: {
            role:        agent.role,
            base_id:     agent.base_id,
            escadron_id: agent.escadron_id ?? null,
            actif:       true,
          },
          select: { id: true, nom: true, prenom: true, grade: true, role: true,
                    base_id: true, escadron_id: true, actif: true },
        });
        await tx.session.deleteMany({ where: { utilisateur_id: dto.successeur_id } });
      }

      this.logger.warn(
        `Mouvement ${dto.type} : agent=${agent.id} base ${agent.base_id}→${maj.base_id} ` +
        `role ${agent.role}→${maj.role} successeur=${dto.successeur_id ?? '—'} par=${adminId}`,
      );

      return { mouvement: trace, utilisateur: maj, successeur };
    });
  }

  async historiqueMouvements(utilisateur_id?: string): Promise<unknown[]> {
    return this.prisma.mouvementPersonnel.findMany({
      where: utilisateur_id ? { utilisateur_id } : {},
      include: {
        utilisateur: { select: { id: true, nom: true, prenom: true, grade: true } },
        successeur:  { select: { id: true, nom: true, prenom: true, grade: true } },
      },
      orderBy: { date_effet: 'desc' },
      take: 500,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Interne
  // ─────────────────────────────────────────────────────────────────────────

  private includeParties() {
    return {
      titulaire: { select: { id: true, nom: true, prenom: true, grade: true, role: true } },
      suppleant: { select: { id: true, nom: true, prenom: true, grade: true, role: true } },
    };
  }

  private async resolveBaseId(idOrCode: string): Promise<string> {
    const base = await this.prisma.base.findFirst({
      where: { OR: [{ id: idOrCode }, { code_base: idOrCode }] },
      select: { id: true },
    });
    if (!base) throw new BadRequestException(`Base « ${idOrCode} » introuvable`);
    return base.id;
  }
}