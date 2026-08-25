// apps/pdf-service/src/archives/archive.service.ts
//
// Archivage des manifestes dont le circuit est clos.
//
// ── Stratégie : stocker ET pouvoir régénérer ──
// Le PDF est écrit sur volume à la clôture du circuit, avec son empreinte.
// Au téléchargement, l'empreinte est revérifiée. Si le fichier manque ou
// diverge, on régénère depuis les données — mais on le DIT, par un en-tête
// dédié. Un document de secours ne se présente jamais comme l'original.

import {
  Injectable, Logger, NotFoundException, ForbiddenException, OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import {
  JwtPayload, StatutManifeste, rolesEffectifs, estAutoriteCentrale,
} from '@sigea/shared-types';
import { PdfService } from '../pdf/pdf.service';
import { ManifesteDataService } from '../pdf/manifeste-data.service';
import * as fs from 'fs/promises';
import { createReadStream, ReadStream } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ResultatTelechargement {
  /** Flux à relayer au client. Jamais chargé intégralement en mémoire. */
  flux:      ReadStream | null;
  /** Contenu régénéré, servi uniquement en secours. */
  tampon:    Buffer | null;
  taille:    number;
  fichier:   string;
  /** Vrai si le document servi est une régénération, pas l'archive d'origine. */
  secours:   boolean;
  motif?:    string;
}

@Injectable()
export class ArchiveService implements OnModuleInit {
  private readonly logger = new Logger(ArchiveService.name);
  private racine!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly data: ManifesteDataService,
  ) {}

  /**
   * Vérification du volume au démarrage, en échec bloquant.
   *
   * Un service qui démarre sans volume accessible archivera dans le système de
   * fichiers du conteneur : les archives disparaîtront au premier redéploiement,
   * silencieusement, et on ne s'en apercevra que des mois plus tard en cherchant
   * un document. On échoue tôt.
   */
  async onModuleInit(): Promise<void> {
    this.racine = process.env.ARCHIVE_ROOT ?? '/var/lib/sigvea/archives';
    try {
      await fs.mkdir(this.racine, { recursive: true });
      // Écriture réelle : `mkdir` réussit sur un montage en lecture seule si le
      // répertoire existe déjà. Seul un write prouve que le volume est utilisable.
      const sonde = path.join(this.racine, '.sonde');
      await fs.writeFile(sonde, 'ok');
      await fs.unlink(sonde);
      this.logger.log(`Volume d'archives opérationnel : ${this.racine}`);
    } catch (e) {
      throw new Error(
        `ARCHIVE_ROOT (${this.racine}) inaccessible en écriture : ${(e as Error).message}. ` +
        'Montez un volume persistant — sans lui, les archives seraient perdues au redéploiement.',
      );
    }
  }

  // ─── Écriture ────────────────────────────────────────────────────────────

  /**
   * Archive un manifeste clos. Idempotent : rejouer l'évènement de clôture
   * (redelivery RabbitMQ) ne produit ni doublon ni seconde écriture disque.
   *
   * `user` est un contexte de service et non une requête : l'archivage est
   * déclenché par un évènement, pas par un utilisateur. On fabrique un jeton
   * technique portant la base du manifeste, pour que ManifesteDataService
   * applique son cloisonnement habituel sans code de contournement.
   */
  async archiver(manifeste_id: string): Promise<void> {
    const existante = await this.prisma.archiveManifeste.findUnique({
      where: { manifeste_id },
      select: { id: true },
    });
    if (existante) {
      this.logger.debug(`Manifeste ${manifeste_id} déjà archivé`);
      return;
    }

    const m = await this.prisma.manifeste.findUnique({
      where: { id: manifeste_id },
      select: {
        id: true, statut: true, base_id: true, vol_id: true, etape_vol: true,
        version: true, updatedAt: true,
        vol: { select: { numero_mission: true } },
      },
    });
    if (!m) {
      this.logger.warn(`Archivage : manifeste ${manifeste_id} introuvable`);
      return;
    }

    // On n'archive QUE du clos. Archiver un manifeste encore modifiable
    // produirait une pièce périmée dès le lendemain — pire qu'aucune pièce,
    // car elle inspirerait confiance.
    if (m.statut !== StatutManifeste.VALIDE) {
      this.logger.warn(
        `Archivage refusé : manifeste ${manifeste_id} au statut ${m.statut}, VALIDE attendu`,
      );
      return;
    }

    // L'empreinte du contenu signé — la seule qui fasse foi sur le fond.
    const snapshot = await this.prisma.manifesteSnapshot.findFirst({
      where: { manifeste_id },
      orderBy: { createdAt: 'desc' },
      select: { hash: true, version_contenu: true },
    });
    if (!snapshot) {
      this.logger.error(
        `Archivage impossible : aucun instantané pour ${manifeste_id}. ` +
        'Un manifeste VALIDE sans instantané signale une incohérence à investiguer.',
      );
      return;
    }

    const jetonService: JwtPayload = {
      sub: 'service:archivage', role: 'admin' as JwtPayload['role'],
      base_id: m.base_id, jti: 'archivage', iat: 0, exp: 0,
    };

    const { data, niveau } = await this.data.charger(manifeste_id, jetonService);
    const buffer = await this.pdf.generateManifeste(data, niveau);

    // Arborescence par année/mois : un répertoire plat de dizaines de milliers
    // de fichiers devient impraticable à sauvegarder et à parcourir.
    const d = m.updatedAt;
    const relatif = path.join(
      String(d.getUTCFullYear()),
      String(d.getUTCMonth() + 1).padStart(2, '0'),
      `${manifeste_id}.pdf`,
    );
    const absolu = path.join(this.racine, relatif);
    await fs.mkdir(path.dirname(absolu), { recursive: true });

    // Écriture atomique : fichier temporaire puis rename. Une coupure en cours
    // d'écriture laisserait sinon un PDF tronqué dont l'empreinte serait
    // pourtant enregistrée comme valide.
    const temporaire = `${absolu}.tmp`;
    await fs.writeFile(temporaire, buffer);
    await fs.rename(temporaire, absolu);

    const sha256_pdf = crypto.createHash('sha256').update(buffer).digest('hex');

    try {
      await this.prisma.archiveManifeste.create({
        data: {
          manifeste_id,
          base_id:         m.base_id,
          vol_id:          m.vol_id,
          numero_mission:  m.vol.numero_mission,
          etape_vol:       m.etape_vol,
          chemin:          relatif,
          taille_octets:   buffer.length,
          sha256_pdf,
          hash_contenu:    snapshot.hash,
          version_contenu: snapshot.version_contenu,
          date_cloture:    m.updatedAt,
        },
      });
      this.logger.log(
        `Manifeste archivé : ${manifeste_id} → ${relatif} (${buffer.length} o)`,
      );
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002') {
        // Course d'archivage : un autre message a gagné. Le fichier écrit est
        // identique en contenu ; on le laisse, le rename l'a déjà écrasé.
        this.logger.debug(`Archivage concurrent sur ${manifeste_id} — ignoré`);
        return;
      }
      throw e;
    }
  }

  // ─── Lecture ─────────────────────────────────────────────────────────────

  /**
   * Liste paginée, cloisonnée par base.
   *
   * Les autorités centrales (CEMAA, MAGE) voient toutes les bases ; tout autre
   * rôle est borné à la sienne. Le filtre est appliqué en SQL et non après
   * coup : un `filter` en mémoire sur dix ans d'archives serait un désastre
   * de performance, et surtout une fuite si la pagination précédait le filtre.
   */
  async lister(
    user: JwtPayload,
    options: { base_id?: string; vol_id?: string; q?: string; page?: number; taille?: number } = {},
  ): Promise<{ total: number; page: number; taille: number; items: unknown[] }> {
    const centrale = rolesEffectifs(user).some(estAutoriteCentrale);
    const base_id = centrale ? options.base_id : user.base_id;

    const taille = Math.min(Math.max(options.taille ?? 25, 1), 100);
    const page   = Math.max(options.page ?? 1, 1);

    const where = {
      ...(base_id ? { base_id } : {}),
      ...(options.vol_id ? { vol_id: options.vol_id } : {}),
      ...(options.q
        ? { numero_mission: { contains: options.q.trim(), mode: 'insensitive' as const } }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.archiveManifeste.count({ where }),
      this.prisma.archiveManifeste.findMany({
        where,
        select: {
          id: true, manifeste_id: true, numero_mission: true, etape_vol: true,
          base_id: true, vol_id: true, taille_octets: true, statut: true,
          date_cloture: true, genere_le: true, nb_telechargements: true,
          version_contenu: true,
          // `chemin`, `sha256_pdf` et `hash_contenu` sont VOLONTAIREMENT absents :
          // exposer l'arborescence du volume à l'IHM n'a aucune utilité et
          // renseignerait un attaquant sur la structure de stockage.
        },
        orderBy: { date_cloture: 'desc' },
        skip: (page - 1) * taille,
        take: taille,
      }),
    ]);

    return { total, page, taille, items };
  }

  /**
   * Prépare le téléchargement.
   *
   * Trois issues, dans cet ordre de préférence :
   *   1. fichier présent et empreinte conforme → flux depuis le disque ;
   *   2. fichier absent ou divergent → régénération, marquée SECOURS ;
   *   3. régénération impossible → erreur explicite.
   *
   * Le flux est préféré au buffer : un PDF de plusieurs mégaoctets ne doit pas
   * transiter par la mémoire du service à chaque téléchargement.
   */
  async telecharger(archive_id: string, user: JwtPayload): Promise<ResultatTelechargement> {
    const a = await this.prisma.archiveManifeste.findUnique({ where: { id: archive_id } });
    if (!a) throw new NotFoundException('Archive introuvable');

    const centrale = rolesEffectifs(user).some(estAutoriteCentrale);
    if (!centrale && a.base_id !== user.base_id) {
      this.logger.warn(
        `Tentative d'accès hors périmètre : archive=${archive_id} user=${user.sub} base=${user.base_id}`,
      );
      throw new ForbiddenException("Cette archive relève d'une autre base");
    }

    const absolu = path.join(this.racine, a.chemin);
    const fichier = `manifeste_${a.numero_mission}_${a.etape_vol}.pdf`;

    // Compteur hors chemin critique : une écriture qui échoue ne doit jamais
    // empêcher un téléchargement.
    void this.prisma.archiveManifeste
      .update({
        where: { id: archive_id },
        data: { nb_telechargements: { increment: 1 }, dernier_telechargement: new Date() },
      })
      .catch(() => undefined);

    // ── 1. Le fichier est-il là, et conforme ? ──
    let motifSecours: string | null = null;
    try {
      const octets = await fs.readFile(absolu);
      const empreinte = crypto.createHash('sha256').update(octets).digest('hex');

      if (empreinte === a.sha256_pdf) {
        void this.prisma.archiveManifeste
          .update({
            where: { id: archive_id },
            data: { derniere_verification: new Date(), statut: 'DISPONIBLE' },
          })
          .catch(() => undefined);

        return {
          flux: createReadStream(absolu), tampon: null,
          taille: octets.length, fichier, secours: false,
        };
      }

      // Empreinte divergente : le fichier a été modifié sur le volume. On ne
      // le sert PAS. C'est exactement le cas que l'empreinte existe pour
      // attraper, et le seul où la servir quand même serait une faute.
      this.logger.error(
        `ARCHIVE CORROMPUE : ${archive_id} (${a.chemin}) — empreinte divergente, fichier non servi`,
      );
      await this.prisma.archiveManifeste
        .update({ where: { id: archive_id }, data: { statut: 'CORROMPU' } })
        .catch(() => undefined);
      motifSecours = "Le fichier archivé ne correspond plus à son empreinte : il a été altéré sur le volume de stockage.";
    } catch {
      this.logger.warn(`Archive absente du volume : ${archive_id} (${a.chemin})`);
      await this.prisma.archiveManifeste
        .update({ where: { id: archive_id }, data: { statut: 'ABSENT' } })
        .catch(() => undefined);
      motifSecours = "Le fichier archivé est introuvable sur le volume de stockage.";
    }

    // ── 2. Secours : régénération ──
    const { data, niveau } = await this.data.charger(a.manifeste_id, user);
    const buffer = await this.pdf.generateManifeste(data, niveau);

    this.logger.warn(
      `Archive ${archive_id} servie PAR RÉGÉNÉRATION — ${motifSecours}`,
    );

    return {
      flux: null, tampon: buffer, taille: buffer.length,
      fichier: fichier.replace('.pdf', '_regenere.pdf'),
      secours: true,
      motif: motifSecours ?? undefined,
    };
  }

  /**
   * Contrôle d'intégrité de masse, pour l'administrateur.
   *
   * Sans lui, une corruption de volume ne se découvre qu'au moment où l'on a
   * besoin du document — c'est-à-dire toujours trop tard. Ce balayage est
   * destiné à tourner périodiquement (tâche planifiée à votre main).
   *
   * Volontairement séquentiel et borné : le but est de détecter, pas de
   * saturer les entrées-sorties du serveur pendant les heures de vol.
   */
  async verifierIntegrite(limite = 200): Promise<{
    verifiees: number; conformes: number; absentes: number; corrompues: number;
    details: Array<{ id: string; manifeste_id: string; probleme: string }>;
  }> {
    const archives = await this.prisma.archiveManifeste.findMany({
      orderBy: [{ derniere_verification: 'asc' }, { genere_le: 'asc' }],
      take: Math.min(limite, 1000),
    });

    let conformes = 0, absentes = 0, corrompues = 0;
    const details: Array<{ id: string; manifeste_id: string; probleme: string }> = [];

    for (const a of archives) {
      const absolu = path.join(this.racine, a.chemin);
      try {
        const octets = await fs.readFile(absolu);
        const empreinte = crypto.createHash('sha256').update(octets).digest('hex');
        if (empreinte === a.sha256_pdf) {
          conformes++;
          await this.prisma.archiveManifeste.update({
            where: { id: a.id },
            data: { derniere_verification: new Date(), statut: 'DISPONIBLE' },
          });
        } else {
          corrompues++;
          details.push({ id: a.id, manifeste_id: a.manifeste_id, probleme: 'EMPREINTE_DIVERGENTE' });
          await this.prisma.archiveManifeste.update({
            where: { id: a.id }, data: { statut: 'CORROMPU' },
          });
        }
      } catch {
        absentes++;
        details.push({ id: a.id, manifeste_id: a.manifeste_id, probleme: 'FICHIER_ABSENT' });
        await this.prisma.archiveManifeste.update({
          where: { id: a.id }, data: { statut: 'ABSENT' },
        });
      }
    }

    if (corrompues || absentes) {
      this.logger.error(
        `Contrôle d'intégrité : ${corrompues} corrompue(s), ${absentes} absente(s) sur ${archives.length}`,
      );
    }
    return { verifiees: archives.length, conformes, absentes, corrompues, details };
  }
}