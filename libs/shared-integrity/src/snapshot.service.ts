// libs/shared-integrity/src/snapshot.service.ts
//
// Historisation du contenu du manifeste.
//
// Le manifeste ne porte plus qu'un visa, celui du commandant de bord. Il n'y a
// donc, en régime normal, qu'un seul instantané par manifeste : celui figé au
// moment où le document devient opposable. Le mécanisme de versionnement est
// conservé malgré tout, parce qu'un manifeste peut être annulé par un renvoi
// amont puis réémis sous le même numéro de liste.
//
// Un instantané est immuable : aucune méthode d'écriture autre que `figer`
// n'est exposée.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { ContenuManifeste, canoniser, empreinte, VERSION_FORMAT } from './empreinte';

/**
 * Sous-ensemble de Prisma suffisant pour figer un instantané.
 *
 * Typé par les modèles utilisés plutôt que par `PrismaClient` : le client de
 * transaction que Prisma passe à `$transaction` n'expose ni `$connect` ni
 * `$transaction`, il ne serait donc pas assignable à PrismaService.
 */
export type ClientPrisma = Pick<PrismaService, 'manifeste' | 'manifesteSnapshot'>;

export interface ResultatSnapshot {
  hash:          string;
  version:       number;
  deja_existant: boolean;
}

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recharge le contenu métier d'un manifeste sous forme canonique.
   *
   * `client` permet de lire DANS la transaction appelante. Sans lui, la lecture
   * partirait sur une seconde connexion du pool pendant que la transaction en
   * retient déjà une : deux connexions mobilisées par signature, et un risque
   * d'épuisement du pool sous charge.
   */
  async lireContenu(manifeste_id: string, client?: ClientPrisma): Promise<ContenuManifeste | null> {
    const m = await (client ?? this.prisma).manifeste.findUnique({
      where: { id: manifeste_id },
      include: {
        vol: {
          select: { numero_mission: true, immatriculation: true, date_heure: true },
        },
        etape: { select: { ordre: true } },
        // Tri SQL en plus du tri applicatif de `canoniser` : ceinture et
        // bretelles, et le payload archivé reste lisible dans un ordre stable.
        passagers: { orderBy: [{ priorite: 'asc' }, { rang: 'asc' }, { nom: 'asc' }] },
        materiels: { orderBy: { designation: 'asc' } },
        equipages: { orderBy: [{ nom: 'asc' }, { prenom: 'asc' }] },
      },
    });
    if (!m) return null;

    return {
      manifeste_id:     m.id,
      numero_manifeste: m.numero_manifeste,
      version:          m.version,
      base_id:          m.base_id,
      etape_ordre:      m.etape?.ordre ?? 0,
      flag_sensible:    m.flag_sensible,
      vol: m.vol
        ? {
            numero_mission:  m.vol.numero_mission,
            immatriculation: m.vol.immatriculation,
            date_heure:      m.vol.date_heure,
          }
        : null,
      passagers: m.passagers.map((p) => ({
        nom: p.nom, prenom: p.prenom, grade: p.grade,
        categorie: String(p.categorie), unite: p.unite,
        priorite: String(p.priorite), rang: p.rang,
        debarquement_ordre: p.debarquement_ordre,
        retire: p.retire,
      })),
      materiels: m.materiels.map((x) => ({
        designation: x.designation, poids_kg: x.poids_kg,
        debarquement_ordre: x.debarquement_ordre,
        classe_iata: x.classe_iata, retire: x.retire,
      })),
      equipages: m.equipages.map((e) => ({
        nom: e.nom, prenom: e.prenom, fonction: String(e.fonction),
      })),
    };
  }

  async figer(
    manifeste_id: string,
    etape: string,
    signataire_id: string | null,
    client?: ClientPrisma,
    options?: { versionner?: boolean },
  ): Promise<ResultatSnapshot> {
    const db = client ?? this.prisma;

    const contenu = await this.lireContenu(manifeste_id, db);
    if (!contenu) {
      throw new Error(`Instantané impossible : manifeste ${manifeste_id} introuvable`);
    }

    const hash    = empreinte(contenu);
    const payload = canoniser(contenu);

    let cle = etape;
    if (options?.versionner) {
      const deja = await db.manifesteSnapshot.count({
        where: { manifeste_id, etape: { startsWith: etape } },
      });
      if (deja > 0) cle = `${etape}#${deja + 1}`;
    }

    const existant = await db.manifesteSnapshot.findUnique({
      where: { manifeste_id_etape: { manifeste_id, etape: cle } },
      select: { hash: true, version_contenu: true },
    });
    if (existant) {
      // Rejouer une signature ne doit pas réécrire l'instantané. On signale la
      // divergence si elle existe : c'est le symptôme d'un contenu modifié
      // entre deux tentatives, et cela mérite une trace.
      if (existant.hash !== hash) {
        this.logger.warn(
          `Instantané ${cle} déjà figé pour le manifeste ${manifeste_id} avec une ` +
            `empreinte différente (${existant.hash.slice(0, 12)}… ≠ ${hash.slice(0, 12)}…). ` +
            "L'instantané d'origine est conservé.",
        );
      }
      return { hash: existant.hash, version: existant.version_contenu, deja_existant: true };
    }

    await db.manifesteSnapshot.create({
      data: {
        manifeste_id,
        etape:           cle,
        version_contenu: contenu.version,
        version_format:  VERSION_FORMAT,
        hash,
        payload,
        signataire_id,
      },
    });

    return { hash, version: contenu.version, deja_existant: false };
  }

  /**
   * Empreinte la plus récente d'un manifeste, pour composer le cartouche QR.
   *
   * Tri sur `createdAt` et non sur l'étape : le manifeste n'a plus qu'une étape
   * nominale, mais un renvoi amont suivi d'une réémission en produit plusieurs
   * sous les clés « COMBORD », « COMBORD#2 »… L'ordre alphabétique les
   * classerait à l'envers.
   */
  async empreinteCourante(
    manifeste_id: string,
  ): Promise<{ hash: string; etape: string; date: Date } | null> {
    const dernier = await this.prisma.manifesteSnapshot.findFirst({
      where: { manifeste_id },
      orderBy: { createdAt: 'desc' },
      select: { hash: true, etape: true, createdAt: true },
    });
    return dernier
      ? { hash: dernier.hash, etape: dernier.etape, date: dernier.createdAt }
      : null;
  }

  /**
   * Vérifie qu'un manifeste correspond toujours à un instantané donné.
   *
   * `conforme: false` signifie que le document présenté ne reflète plus l'état
   * historisé — soit le papier est une version périmée, soit la base a été
   * modifiée hors circuit. Les deux cas appellent la même prudence, et c'est
   * pourquoi on ne cherche pas à les distinguer ici.
   */
  async verifier(manifeste_id: string, hash: string): Promise<{
    connu: boolean;
    conforme: boolean;
    etape?: string;
    date?: Date;
    hash_courant?: string;
  }> {
    const snap = await this.prisma.manifesteSnapshot.findFirst({
      where: { manifeste_id, hash },
      select: { etape: true, createdAt: true },
    });
    if (!snap) return { connu: false, conforme: false };

    const contenu = await this.lireContenu(manifeste_id);
    const actuel = contenu ? empreinte(contenu) : undefined;

    return {
      connu: true,
      conforme: actuel === hash,
      etape: snap.etape,
      date: snap.createdAt,
      hash_courant: actuel,
    };
  }
}