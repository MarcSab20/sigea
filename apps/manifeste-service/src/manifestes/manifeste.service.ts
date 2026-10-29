// apps/manifeste-service/src/manifestes/manifeste.service.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE CE SERVICE N'EST PLUS
// ═══════════════════════════════════════════════════════════════════════════
// Il ne crée plus de manifeste, ne soumet plus rien, n'enregistre plus aucun
// passager ni aucun matériel. Tout cela a basculé dans liste-service : le
// manifeste est l'EXTRAIT de la liste hiérarchisée, émis à l'arrêté du
// commandant de base.
//
// Il lui reste deux fonctions, et deux seulement :
//   • la lecture, pour tous ceux qui ont le droit de voir le document ;
//   • la DISCRIMINATION FINALE du commandant de bord.
//
// ── Pourquoi la discrimination du COMBORD vit ICI et non sur la liste ──
// Les quatre autorités amont discriminent la LISTE : elles arbitrent entre des
// candidats. Le commandant de bord, lui, constate ce qui monte réellement à
// bord — il travaille sur le document d'embarquement, après que la liste a été
// arrêtée. Faire porter son retrait sur les lignes de liste réécrirait un
// document que le commandant de base a déjà signé. Le retrait porte donc sur le
// PASSAGER du manifeste, et la liste conserve l'état arrêté.

import {
  Injectable, BadRequestException, ForbiddenException, NotFoundException,
  ConflictException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@sigea/shared-database';
import {
  JwtPayload, RoleUtilisateur, Rmia, Priorite, StatutManifeste,
  Perimetre, perimetreEffectif, rolesEffectifs, rmiasCouvertes,
  repartirParPriorite, ROLES_DELEGATAIRES_COMBASE,
} from '@sigea/shared-types';

@Injectable()
export class ManifesteService {
  private readonly logger = new Logger(ManifesteService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════
  // Lecture
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Clause de visibilité.
   *
   * Un 404 — et non un 403 — sanctionne le hors-périmètre : confirmer
   * l'existence d'un manifeste qu'on n'a pas le droit de lire renseignerait
   * déjà sur un mouvement aérien.
   */
  private filtre(user: JwtPayload): Prisma.ManifesteWhereInput {
    const roles = rolesEffectifs(user);
    if (perimetreEffectif(user) === Perimetre.NATIONAL) return {};

    const clauses: Prisma.ManifesteWhereInput[] = [];
    const rmias = rmiasCouvertes(user);
    if (rmias.length) clauses.push({ liste: { rmia: { in: rmias } } });
    if (roles.some((r) => r === RoleUtilisateur.COMBASE || ROLES_DELEGATAIRES_COMBASE.includes(r))) {
      clauses.push({ base_id: user.base_id });
    }
    if (roles.includes(RoleUtilisateur.COMBORD)) {
      clauses.push({ vol: { combord_id: user.sub } });
    }
    // Aucune clause = aucun droit. `{ id: '' }` ne correspond à rien et vaut
    // mieux qu'un `{}` qui ouvrirait tout par inadvertance.
    return clauses.length ? { OR: clauses } : { id: '' };
  }

  async lister(user: JwtPayload): Promise<unknown[]> {
    return this.prisma.manifeste.findMany({
      where: { AND: [this.filtre(user), { statut: { not: StatutManifeste.ANNULE } }] },
      select: {
        id: true, numero_manifeste: true, statut: true, emis_le: true, definitif_le: true,
        base:  { select: { code_base: true, nom: true } },
        vol:   { select: { numero_mission: true, date_heure: true, immatriculation: true } },
        etape: { select: { ordre: true } },
        _count: { select: { passagers: true } },
      },
      orderBy: { emis_le: 'desc' },
    });
  }

  /**
   * Vue complète du manifeste, passagers répartis par priorité.
   *
   * Les passagers RETIRÉS sont renvoyés à part et non mêlés aux autres : ils ne
   * figurent pas sur le document imprimé, mais le commandant de bord doit voir
   * ce qu'il a lui-même écarté, sans quoi il ne peut pas se dédire.
   */
  async consulter(id: string, user: JwtPayload): Promise<unknown> {
    const m = await this.prisma.manifeste.findFirst({
      where: { AND: [{ id }, this.filtre(user)] },
      include: {
        base:  { select: { code_base: true, nom: true, numero: true } },
        etape: { select: { ordre: true } },
        vol: {
          select: {
            numero_mission: true, immatriculation: true, date_heure: true,
            type_mission: true, combord_id: true,
            combord_grade: true, combord_nom: true, combord_prenom: true,
            itineraire: {
              select: { ordre: true, base: { select: { code_base: true } } },
              orderBy: { ordre: 'asc' },
            },
          },
        },
        passagers: { orderBy: [{ priorite: 'asc' }, { rang: 'asc' }] },
        materiels: { orderBy: { designation: 'asc' } },
        equipages: true,
        liste: {
          select: {
            id: true, rmia: true, statut: true, etape_courante: true,
            visas: { orderBy: { date_heure: 'asc' } },
          },
        },
      },
    });
    if (!m) throw new NotFoundException('Manifeste introuvable ou hors de votre périmètre');

    const embarques = m.passagers.filter((p) => !p.retire);
    const retires   = m.passagers.filter((p) => p.retire);

    return {
      manifeste: {
        id: m.id, numero: m.numero_manifeste, statut: m.statut,
        version: m.version, flag_sensible: m.flag_sensible,
        emis_le: m.emis_le, definitif_le: m.definitif_le,
        base: m.base, point: { ordre: m.etape?.ordre ?? 0 }, vol: m.vol,
      },
      tableaux: repartirParPriorite(
        embarques.map((p) => ({ ...p, priorite: p.priorite as unknown as Priorite })),
      ),
      passagers_retires: retires,
      materiels: m.materiels.filter((x) => !x.retire),
      materiels_retires: m.materiels.filter((x) => x.retire),
      equipages: m.equipages,
      liste: m.liste,
      totaux: {
        passagers: embarques.length,
        masse_bagages_kg: Number(
          embarques.reduce((s, p) => s + Number(p.masse_bagages_kg), 0).toFixed(2),
        ),
        masse_fret_kg: Number(
          m.materiels.filter((x) => !x.retire)
            .reduce((s, x) => s + Number(x.poids_kg), 0).toFixed(2),
        ),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Discrimination finale — commandant de bord
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Charge un manifeste ouvert à la discrimination du commandant de bord.
   *
   * Trois conditions, et chacune ferme une porte distincte :
   *   • le rôle COMBORD — personne d'autre ne touche au manifeste ;
   *   • `vol.combord_id === user.sub` — pas n'importe quel commandant de bord,
   *     CELUI de ce vol ;
   *   • statut EMIS — après le visa, le document est opposable et ne bouge plus.
   */
  private async chargerPourCombord(manifeste_id: string, user: JwtPayload) {
    if (!rolesEffectifs(user).includes(RoleUtilisateur.COMBORD)) {
      throw new ForbiddenException(
        'Seul le commandant de bord discrimine le manifeste.',
      );
    }

    const m = await this.prisma.manifeste.findUnique({
      where: { id: manifeste_id },
      select: {
        id: true, statut: true, numero_manifeste: true,
        vol: { select: { combord_id: true, numero_mission: true } },
      },
    });
    if (!m) throw new NotFoundException('Manifeste introuvable');
    if (m.vol.combord_id !== user.sub) {
      throw new NotFoundException('Manifeste introuvable');
    }

    if (m.statut === StatutManifeste.DEFINITIF) {
      throw new ConflictException(
        'Manifeste définitif : votre visa est apposé, le document ne peut plus être modifié.',
      );
    }
    if (m.statut === StatutManifeste.ANNULE) {
      throw new ConflictException(
        'Manifeste annulé par un renvoi en amont : attendez sa réémission.',
      );
    }
    return m;
  }

  /**
   * Retire un passager du manifeste.
   *
   * Le passager n'est pas supprimé : `retire` passe à vrai et le motif est
   * conservé. C'est ce qui permet de répondre, des mois plus tard, à « pourquoi
   * untel n'a pas embarqué ». Une suppression physique rendrait la question
   * sans réponse — et l'empreinte du manifeste intègre ce drapeau, donc le
   * retrait est prouvable.
   */
  async retirerPassager(
    manifeste_id: string, passager_id: string, motif: string, user: JwtPayload,
  ): Promise<unknown> {
    const m = await this.chargerPourCombord(manifeste_id, user);

    const p = await this.prisma.passager.findFirst({
      where: { id: passager_id, manifeste_id },
      select: { id: true, nom: true, prenom: true, retire: true, origine: true },
    });
    if (!p) throw new NotFoundException('Passager introuvable sur ce manifeste');
    if (p.retire) throw new BadRequestException('Ce passager est déjà retiré.');

    // Une inscription imposée par une autorité centrale échappe à la
    // discrimination, ici comme sur la liste. Le commandant de bord qui
    // l'estime impossible à embarquer doit en référer, pas la retirer seul.
    if (p.origine !== 'SAISIE') {
      throw new ForbiddenException(
        `Inscription imposée par le ${p.origine} : elle ne peut pas être retirée. ` +
          "Signalez l'impossibilité matérielle à l'autorité émettrice.",
      );
    }

    const retire = await this.prisma.$transaction(async (tx) => {
      const r = await tx.passager.update({
        where: { id: passager_id },
        data:  { retire: true, motif_retrait: motif.trim() },
      });
      // La version du manifeste change : l'empreinte doit changer avec elle,
      // sinon deux contenus différents porteraient le même numéro de version.
      await tx.manifeste.update({
        where: { id: manifeste_id }, data: { version: { increment: 1 } },
      });
      return r;
    });

    this.logger.warn(
      `COMBORD : ${p.nom} ${p.prenom} retiré du manifeste ${m.numero_manifeste} ` +
        `par ${user.sub} — ${motif}`,
    );
    return retire;
  }

  /** Réintègre un passager retiré par erreur, tant que le visa n'est pas apposé. */
  async reintegrerPassager(
    manifeste_id: string, passager_id: string, user: JwtPayload,
  ): Promise<unknown> {
    await this.chargerPourCombord(manifeste_id, user);

    const p = await this.prisma.passager.findFirst({
      where: { id: passager_id, manifeste_id },
      select: { id: true, retire: true },
    });
    if (!p) throw new NotFoundException('Passager introuvable sur ce manifeste');
    if (!p.retire) throw new BadRequestException("Ce passager n'est pas retiré.");

    return this.prisma.$transaction(async (tx) => {
      const r = await tx.passager.update({
        where: { id: passager_id },
        data:  { retire: false, motif_retrait: null },
      });
      await tx.manifeste.update({
        where: { id: manifeste_id }, data: { version: { increment: 1 } },
      });
      return r;
    });
  }

  async retirerMateriel(
    manifeste_id: string, materiel_id: string, motif: string, user: JwtPayload,
  ): Promise<unknown> {
    await this.chargerPourCombord(manifeste_id, user);

    const x = await this.prisma.materiel.findFirst({
      where: { id: materiel_id, manifeste_id },
      select: { id: true, designation: true, retire: true, origine: true },
    });
    if (!x) throw new NotFoundException('Matériel introuvable sur ce manifeste');
    if (x.retire) throw new BadRequestException('Ce matériel est déjà retiré.');
    if (x.origine !== 'SAISIE') {
      throw new ForbiddenException(
        `Fret imposé par le ${x.origine} : il ne peut pas être retiré ici.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const r = await tx.materiel.update({
        where: { id: materiel_id },
        data:  { retire: true, motif_retrait: motif.trim() },
      });
      await tx.manifeste.update({
        where: { id: manifeste_id }, data: { version: { increment: 1 } },
      });
      return r;
    });
  }

  /**
   * Compose l'équipage du manifeste.
   *
   * Saisi par le commandant de bord : lui seul connaît la composition réelle
   * du jour. Remplacement intégral plutôt qu'ajout unitaire — un équipage se
   * déclare d'un bloc, et la liste partielle d'un équipage n'a pas de sens.
   */
  async definirEquipage(
    manifeste_id: string,
    membres: { nom: string; prenom: string; grade: string; fonction: string }[],
    user: JwtPayload,
  ): Promise<unknown> {
    const m = await this.chargerPourCombord(manifeste_id, user);

    const manifeste = await this.prisma.manifeste.findUnique({
      where: { id: manifeste_id }, select: { base_id: true },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.equipage.deleteMany({ where: { manifeste_id } });
      await tx.equipage.createMany({
        data: membres.map((e) => ({
          manifeste_id,
          base_id: manifeste!.base_id,
          nom: e.nom.trim(), prenom: e.prenom.trim(), grade: e.grade.trim(),
          fonction: e.fonction as never,
        })),
      });
      await tx.manifeste.update({
        where: { id: manifeste_id }, data: { version: { increment: 1 } },
      });
      this.logger.log(
        `Équipage défini sur ${m.numero_manifeste} : ${membres.length} membre(s) par ${user.sub}`,
      );
      return { membres: membres.length };
    });
  }
}