// apps/referentiel-service/src/escadrons/escadrons.service.ts
//
// Référentiel des escadrons aériens.
//
// ── Ce que ce fichier remplace ──
// La version présente dans le dépôt était une copie intégrale de
// apps/vol-service/src/vols/vols.controller.ts : classe VolsController,
// décorateur @Controller('vols'), aucune classe EscadronsService. Trois
// conséquences immédiates :
//   • EscadronsModule ne compile pas (provider introuvable) ;
//   • si la compilation passait, un second contrôleur monterait la route
//     /vols dans le référentiel-service, laquelle répondrait à la place du
//     vol-service selon l'ordre de résolution de la gateway ;
//   • aucune des routes du besoin 4 n'existe.
//
// ── Modèle métier ──
// Une base porte 0..n escadrons. Le COMEA commande UN escadron. Le couple
// (base, escadron) est donc contraint à trois niveaux : l'IHM ne propose que
// les escadrons de la base choisie, AdminService.resolveEscadron() le
// revérifie, et le trigger trg_utilisateur_escadron_base le garantit en base.
// Aucun de ces trois niveaux n'est redondant : le premier guide, le deuxième
// répond en langage métier, le troisième résiste à une écriture directe.

import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { RoleUtilisateur } from '@sigea/shared-types';
import { CreateEscadronDto, UpdateEscadronDto } from './dto/escadrons.dto';

/** Forme exposée à l'IHM. `libelle` est calculé, jamais stocké. */
export interface EscadronVue {
  id: string;
  code: string;
  nom: string;
  type: string | null;
  actif: boolean;
  base_id: string;
  base: { id: string; code_base: string; nom: string } | null;
  /** « 21ème escadron de transport » — pour les listes déroulantes. */
  libelle: string;
  /** Nombre de COMEA rattachés. Sert au garde-fou de désactivation. */
  nb_commandants: number;
}

@Injectable()
export class EscadronsService {
  private readonly logger = new Logger(EscadronsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Lecture
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param base_id  identifiant OU code_base (« BA101 ») ; les deux sont résolus.
   * @param actifsSeulement  n'exposer que les escadrons en activité.
   *
   * C'est l'appel que fait l'écran de création d'utilisateur COMEA :
   * GET /api/referentiel/escadrons?base_id=<base choisie>&actif=1
   * Il ne renvoie donc QUE les escadrons rattachés à la base sélectionnée —
   * la règle du besoin 4, tenue à la source plutôt que par un filtre côté client.
   */
  async findAll(base_id?: string, actifsSeulement = false): Promise<EscadronVue[]> {
    const base = base_id ? await this.resoudreBase(base_id) : null;

    const lignes = await this.prisma.escadron.findMany({
      where: {
        ...(base ? { base_id: base.id } : {}),
        ...(actifsSeulement ? { actif: true } : {}),
      },
      include: {
        base: { select: { id: true, code_base: true, nom: true } },
        _count: { select: { utilisateurs: true } },
      },
      // Tri numérique : « 9 » doit précéder « 21 ». Un tri alphabétique sur
      // `code` placerait « 13 » avant « 9 », ce qui déroute à la lecture.
      orderBy: [{ base: { code_base: 'asc' } }, { code: 'asc' }],
    });

    return lignes
      .sort((a, b) => Number(a.code) - Number(b.code))
      .map((e) => this.versVue(e));
  }

  async findOne(id: string): Promise<EscadronVue> {
    const e = await this.prisma.escadron.findUnique({
      where: { id },
      include: {
        base: { select: { id: true, code_base: true, nom: true } },
        _count: { select: { utilisateurs: true } },
      },
    });
    if (!e) throw new NotFoundException(`Escadron ${id} introuvable`);
    return this.versVue(e);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Écriture — administrateur uniquement (garde posée sur le contrôleur)
  // ─────────────────────────────────────────────────────────────────────────

  async create(dto: CreateEscadronDto): Promise<EscadronVue> {
    const base = await this.resoudreBase(dto.base_id);

    // Le DTO valide déjà /^\d{1,3}$/ ; ce nettoyage traite le cas « 021 »,
    // qui passerait la validation et créerait un doublon logique de « 21 ».
    const code = String(Number(dto.code));

    try {
      const cree = await this.prisma.escadron.create({
        data: {
          code,
          nom: dto.nom.trim(),
          type: dto.type?.trim() || null,
          base_id: base.id,
          actif: true,
        },
        include: {
          base: { select: { id: true, code_base: true, nom: true } },
          _count: { select: { utilisateurs: true } },
        },
      });

      this.logger.log(`Escadron créé : ${code} (${dto.nom}) sur ${base.code_base}`);
      return this.versVue(cree);
    } catch (e: unknown) {
      // @@unique([base_id, code]) — voir la migration lot 4.
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          `L'escadron ${code} existe déjà sur la base ${base.code_base}. ` +
            "Un numéro d'escadron est unique au sein d'une base.",
        );
      }
      throw e;
    }
  }

  /**
   * `code` et `base_id` ne sont volontairement PAS modifiables (voir
   * UpdateEscadronDto). Un escadron ne change ni de numéro ni de base : une
   * réorganisation crée un nouvel escadron et désactive l'ancien, ce qui
   * préserve le rattachement historique des COMEA passés — et donc la
   * lisibilité des tampons signés sous l'ancienne organisation.
   */
  async update(id: string, dto: UpdateEscadronDto): Promise<EscadronVue> {
    await this.findOne(id);

    if (dto.actif === false) {
      // Passer par desactiver() pour ne pas contourner son garde-fou.
      return this.desactiver(id);
    }

    const maj = await this.prisma.escadron.update({
      where: { id },
      data: {
        ...(dto.nom !== undefined ? { nom: dto.nom.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type?.trim() || null } : {}),
        ...(dto.actif === true ? { actif: true } : {}),
      },
      include: {
        base: { select: { id: true, code_base: true, nom: true } },
        _count: { select: { utilisateurs: true } },
      },
    });
    return this.versVue(maj);
  }

  /**
   * Désactivation LOGIQUE. Aucune suppression physique n'est exposée : un
   * escadron supprimé emporterait le rattachement des COMEA qui l'ont
   * commandé, et rendrait incompréhensibles les manifestes qu'ils ont visés.
   *
   * ── Garde-fou ──
   * On refuse de désactiver un escadron qui commande encore un COMEA actif.
   * Sans ce contrôle, l'escadron disparaîtrait des listes tandis que son
   * commandant continuerait de créer des vols : une incohérence invisible
   * depuis l'IHM d'administration, et pénible à diagnostiquer.
   */
  async desactiver(id: string): Promise<EscadronVue> {
    const escadron = await this.prisma.escadron.findUnique({
      where: { id },
      select: { id: true, code: true, actif: true },
    });
    if (!escadron) throw new NotFoundException(`Escadron ${id} introuvable`);

    const rattaches = await this.prisma.utilisateur.count({
      where: { escadron_id: id, actif: true, role: RoleUtilisateur.COMEA },
    });
    if (rattaches > 0) {
      throw new BadRequestException(
        `L'escadron ${escadron.code} commande encore ${rattaches} COMEA actif(s). ` +
          'Réaffectez ou désactivez ces comptes avant de désactiver l\'escadron ' +
          '(gestionnaire de mouvements : /api/admin/mouvements).',
      );
    }

    const maj = await this.prisma.escadron.update({
      where: { id },
      data: { actif: false },
      include: {
        base: { select: { id: true, code_base: true, nom: true } },
        _count: { select: { utilisateurs: true } },
      },
    });

    this.logger.warn(`Escadron désactivé : ${escadron.code}`);
    return this.versVue(maj);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Interne
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Accepte indifféremment un UUID ou un code_base.
   *
   * L'IHM d'administration manipule des codes (« BA101 »), les appels internes
   * des UUID. Résoudre les deux ici évite de disséminer cette double lecture
   * dans chaque appelant — et supprime une classe entière de tickets « base
   * introuvable » alors que le code saisi est correct.
   */
  private async resoudreBase(ref: string) {
    const base = await this.prisma.base.findFirst({
      where: { OR: [{ id: ref }, { code_base: ref.toUpperCase() }] },
      select: { id: true, code_base: true, nom: true },
    });
    if (!base) {
      throw new BadRequestException(
        `Base « ${ref} » introuvable au référentiel (identifiant ou code_base attendu)`,
      );
    }
    return base;
  }

  private versVue(e: {
    id: string;
    code: string;
    nom: string;
    type: string | null;
    actif: boolean;
    base_id: string;
    base?: { id: string; code_base: string; nom: string } | null;
    _count?: { utilisateurs: number };
  }): EscadronVue {
    return {
      id: e.id,
      code: e.code,
      nom: e.nom,
      type: e.type,
      actif: e.actif,
      base_id: e.base_id,
      base: e.base ?? null,
      libelle: this.libelle(e.code, e.nom),
      nb_commandants: e._count?.utilisateurs ?? 0,
    };
  }

  /**
   * « 1er escadron … », « 21ème escadron … ».
   *
   * Le suffixe ordinal est calculé à l'affichage et jamais stocké : le stocker
   * exposerait à « 21ème », « 21e », « 21 ème » pour un même escadron, et
   * rendrait impossible tout regroupement statistique dans le module
   * Exploitation.
   */
  private libelle(code: string, nom: string): string {
    const n = Number(code);
    const ordinal = n === 1 ? '1er' : `${n}ème`;
    return `${ordinal} — ${nom}`;
  }
}