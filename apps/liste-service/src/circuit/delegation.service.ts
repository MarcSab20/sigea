// apps/liste-service/src/circuit/delegation.service.ts
//
// Désignation d'un délégataire pour la discrimination à l'étape COMBASE.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE LA DÉLÉGATION EST, ET CE QU'ELLE N'EST PAS
// ═══════════════════════════════════════════════════════════════════════════
// Elle porte sur UNE liste, jamais sur une fonction. Un commandant de base qui
// déléguerait en permanence transférerait son commandement, ce qu'aucune
// directive ne prévoit. D'où une désignation par dossier, révocable, et qui
// tombe au premier renvoi.
//
// La signature produite reste celle du commandant de base — c'est l'exigence
// explicite de la directive. Le délégataire figure dans la note de délégation,
// non imprimée, conservée pour l'archivage. Les deux colonnes sont donc
// distinctes dans VisaListe : `signataire_*` et `delegataire_*`.
//
// Conséquence à assumer : le commandant de base demeure responsable de ce qui
// est signé en son nom. C'est précisément pourquoi la désignation doit être un
// acte explicite, horodaté, et non une conséquence du rôle du cliquant.

import {
  Injectable, BadRequestException, ForbiddenException, NotFoundException,
  ConflictException, Logger,
} from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import {
  JwtPayload, RoleUtilisateur, EtapeListe, StatutListe,
  rolesEffectifs, ROLES_DELEGATAIRES_COMBASE,
} from '@sigea/shared-types';

@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Charge une liste sur laquelle l'appelant exerce le commandement de base.
   *
   * Seul le COMBASE délègue. Ni le COMGMO ni le COMSECBASE ne peuvent se
   * désigner eux-mêmes, et ce contrôle est le seul qui empêche la délégation
   * de se retourner en auto-attribution.
   */
  private async chargerPourCombase(liste_id: string, user: JwtPayload) {
    if (!rolesEffectifs(user).includes(RoleUtilisateur.COMBASE)) {
      throw new ForbiddenException(
        'Seul le commandant de base délègue la discrimination de ses listes.',
      );
    }

    const liste = await this.prisma.listeEmbarquement.findUnique({
      where: { id: liste_id },
      select: {
        id: true, statut: true, etape_courante: true,
        delegue_a_id: true, delegue_le: true,
        etape: { select: { base_id: true, ordre: true, base: { select: { code_base: true } } } },
        vol:   { select: { numero_mission: true } },
      },
    });
    if (!liste) throw new NotFoundException('Liste introuvable.');

    if (!user.base_id || liste.etape.base_id !== user.base_id) {
      // 404 plutôt que 403 : un commandant de base n'a pas à apprendre
      // l'existence d'une liste d'une autre base en tentant de la déléguer.
      throw new NotFoundException('Liste introuvable.');
    }
    return liste;
  }

  /**
   * Désigne un délégataire.
   *
   * Possible AVANT que la liste n'atteigne l'étape COMBASE — c'est même le cas
   * nominal : le commandant part en déplacement et désigne par avance. Refuser
   * une délégation anticipée obligerait à attendre l'arrivée du dossier, donc à
   * être présent au moment précis où l'on ne l'est pas.
   */
  async deleguer(
    liste_id: string,
    delegataire_id: string,
    motif: string,
    user: JwtPayload,
  ): Promise<unknown> {
    const liste = await this.chargerPourCombase(liste_id, user);

    if (liste.statut === StatutListe.ARRETEE || liste.statut === StatutListe.CLOTUREE) {
      throw new ConflictException(
        "La liste est arrêtée : la discrimination du commandant de base a déjà eu lieu.",
      );
    }

    const delegataire = await this.prisma.utilisateur.findFirst({
      where: {
        id: delegataire_id,
        base_id: liste.etape.base_id,
        actif: true,
        role: { in: ROLES_DELEGATAIRES_COMBASE as unknown as RoleUtilisateur[] },
      },
      select: { id: true, nom: true, prenom: true, grade: true, role: true },
    });
    if (!delegataire) {
      throw new BadRequestException(
        'Délégataire invalide : seuls un COMGMO ou un commandant en second de ' +
          'VOTRE base, actifs, peuvent être désignés.',
      );
    }

    await this.prisma.listeEmbarquement.update({
      where: { id: liste_id },
      data: {
        delegue_a_id:     delegataire.id,
        delegue_par:      user.sub,
        delegue_le:       new Date(),
        motif_delegation: motif.trim(),
      },
    });

    this.logger.log(
      `Délégation posée : liste ${liste_id} (${liste.vol.numero_mission}, escale ` +
        `${liste.etape.ordre}) confiée à ${delegataire.grade} ${delegataire.nom} ` +
        `par ${user.sub} — ${motif}`,
    );

    return {
      delegue_a: {
        id: delegataire.id, nom: delegataire.nom,
        prenom: delegataire.prenom, grade: delegataire.grade, role: delegataire.role,
      },
      delegue_le: new Date(),
      motif_delegation: motif.trim(),
    };
  }

  /**
   * Révoque la délégation.
   *
   * Sans effet si l'étape est déjà franchie : le visa est posé, et le retirer
   * reviendrait à défaire un acte signé. La révocation vaut pour l'avenir.
   */
  async revoquer(liste_id: string, user: JwtPayload): Promise<{ revoque: boolean }> {
    const liste = await this.chargerPourCombase(liste_id, user);

    if (!liste.delegue_a_id) {
      throw new BadRequestException('Aucune délégation en cours sur cette liste.');
    }
    if (liste.statut === StatutListe.ARRETEE || liste.statut === StatutListe.CLOTUREE) {
      throw new ConflictException(
        "La liste est arrêtée : la délégation a produit ses effets et ne se révoque plus.",
      );
    }

    await this.prisma.listeEmbarquement.update({
      where: { id: liste_id },
      data: {
        delegue_a_id: null, delegue_par: null,
        delegue_le: null, motif_delegation: null,
      },
    });

    this.logger.log(`Délégation révoquée sur la liste ${liste_id} par ${user.sub}`);
    return { revoque: true };
  }

  /**
   * Délégataires désignables, et délégation en cours.
   *
   * Alimente l'écran : le commandant de base ne devrait pas avoir à connaître
   * les identifiants de ses officiers pour en désigner un.
   */
  async candidats(liste_id: string, user: JwtPayload): Promise<unknown> {
    const liste = await this.chargerPourCombase(liste_id, user);

    const officiers = await this.prisma.utilisateur.findMany({
      where: {
        base_id: liste.etape.base_id,
        actif: true,
        role: { in: ROLES_DELEGATAIRES_COMBASE as unknown as RoleUtilisateur[] },
      },
      select: { id: true, nom: true, prenom: true, grade: true, role: true },
      orderBy: { nom: 'asc' },
    });

    const courante = liste.delegue_a_id
      ? await this.prisma.listeEmbarquement.findUnique({
          where: { id: liste_id },
          select: {
            delegue_le: true, motif_delegation: true,
            delegue_a: { select: { id: true, nom: true, prenom: true, grade: true, role: true } },
          },
        })
      : null;

    return {
      etape_courante: liste.etape_courante as EtapeListe | null,
      candidats: officiers,
      delegation: courante?.delegue_a
        ? {
            delegue_a: courante.delegue_a,
            delegue_le: courante.delegue_le,
            motif: courante.motif_delegation,
          }
        : null,
    };
  }
}