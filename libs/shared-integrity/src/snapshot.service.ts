// libs/shared-integrity/src/snapshot.service.ts
//
// Historisation du contenu signé.
//
// Problème résolu : jusqu'ici, `ValidationEtape` conservait QUI avait signé et
// QUAND, mais jamais QUOI. Un manifeste rejeté puis corrigé perdait toute trace
// de l'état sur lequel le COMGMO s'était prononcé. En cas d'incident aérien et
// d'enquête, c'est précisément la question qui sera posée.
//
// Un instantané est figé à chaque franchissement d'étape. Il est immuable :
// aucune méthode d'écriture autre que `figer` n'est exposée.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { ContenuManifeste, canoniser, empreinte, VERSION_FORMAT } from './empreinte';

/**
 * Sous-ensemble de Prisma suffisant pour figer un instantané.
 *
 * Volontairement typé par les modèles utilisés plutôt que par `PrismaClient` :
 * le client de transaction que Prisma passe à `$transaction` n'expose pas
 * `$connect`/`$transaction`, il ne serait donc pas assignable à PrismaService.
 */
export type ClientPrisma = Pick<PrismaService, 'manifeste' | 'manifesteSnapshot'>;

export interface ResultatSnapshot {
  hash: string;
  version: number;
  deja_existant: boolean;
}

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recharge le contenu métier d'un manifeste sous la forme canonique.
   *
   * Chaque collection est triée en SQL en plus du tri applicatif de
   * `canoniser` : ceinture et bretelles, et cela rend le payload archivé
   * lisible dans un ordre stable.
   */
  async lireContenu(manifeste_id: string, client?: ClientPrisma): Promise<ContenuManifeste | null> {
    // `client` permet de lire DANS la transaction appelante. Sans lui, la
    // lecture partirait sur une seconde connexion du pool pendant que la
    // transaction en retient déjà une : deux connexions mobilisées par
    // validation, et un risque d'épuisement du pool sous charge.
    const m = await (client ?? this.prisma).manifeste.findUnique({
      where: { id: manifeste_id },
      include: {
        vol: {
          select: {
            numero_mission: true, immatriculation: true, date_heure: true,
            base_depart_id: true, base_arrivee_id: true,
          },
        },
        passagers:    { orderBy: [{ nom: 'asc' }, { prenom: 'asc' }] },
        materiels:    { orderBy: { designation: 'asc' } },
        marchandises: { orderBy: { nature: 'asc' } },
        equipages:    { orderBy: [{ nom: 'asc' }, { prenom: 'asc' }] },
      },
    });
    if (!m) return null;

    return {
      manifeste_id:  m.id,
      version:       m.version,
      base_id:       m.base_id,
      flag_sensible: m.flag_sensible,
      vol: m.vol
        ? {
            numero_mission:  m.vol.numero_mission,
            immatriculation: m.vol.immatriculation,
            date_heure:      m.vol.date_heure,
            base_depart_id:  m.vol.base_depart_id,
            base_arrivee_id: m.vol.base_arrivee_id,
          }
        : null,
      passagers: m.passagers.map((p) => ({
        nom: p.nom, prenom: p.prenom, grade: p.grade,
        categorie: String(p.categorie), unite: p.unite,
      })),
      materiels:    m.materiels.map((x) => ({ designation: x.designation, poids_kg: x.poids_kg })),
      marchandises: m.marchandises.map((x) => ({
        nature: x.nature, classe_iata: x.classe_iata, poids_kg: x.poids_kg,
      })),
      equipages: m.equipages.map((e) => ({
        nom: e.nom, prenom: e.prenom, fonction: String(e.fonction),
      })),
    };
  }

  /**
   * Fige l'état courant du manifeste et l'attache à une étape du circuit.
   *
   * Idempotent sur (manifeste_id, etape) : rejouer une validation — redelivery
   * RabbitMQ, double-clic, reprise après incident — ne crée pas un second
   * instantané et ne réécrit pas le premier.
   *
   * `tx` permet d'inscrire l'instantané DANS la transaction de la state
   * machine : soit l'étape est franchie ET historisée, soit ni l'un ni l'autre.
   */
  async figer(
    manifeste_id: string,
    etape: string,
    validateur_id: string | null,
    tx?: ClientPrisma,
    options?: { versionner?: boolean },
  ): Promise<ResultatSnapshot | null> {
    const client = tx ?? this.prisma;
    const contenu = await this.lireContenu(manifeste_id, client);
    if (!contenu) {
      this.logger.warn(`Instantané impossible : manifeste ${manifeste_id} introuvable`);
      return null;
    }

    const hash = empreinte(contenu);
    const payload = canoniser(contenu);

    // Un manifeste peut repasser plusieurs fois par la même étape : rejeté,
    // corrigé, resoumis, rejeté à nouveau. Sans versionnement de la clé, le
    // second passage retomberait sur l'instantané du premier et NE SERAIT PAS
    // historisé — précisément le cas qui compte en cas d'enquête. Les étapes
    // appelées avec `versionner` reçoivent donc un suffixe incrémental.
    let cle = etape;
    if (options?.versionner) {
      const passages = await client.manifesteSnapshot.count({
        where: { manifeste_id, etape: { startsWith: `${etape}#` } },
      });
      cle = `${etape}#${passages + 1}`;
    }

    const existant = await client.manifesteSnapshot.findUnique({
      where: { manifeste_id_etape: { manifeste_id, etape: cle } },
      select: { hash: true, version_contenu: true },
    });
    if (existant) {
      if (existant.hash !== hash) {
        // Le contenu a changé entre deux passages sur la même étape sans que le
        // circuit soit reparti de zéro. Ce ne devrait pas arriver : on le trace
        // au niveau ERROR sans écraser l'instantané d'origine, qui fait foi.
        this.logger.error(
          `Instantané divergent sur ${manifeste_id}/${cle} : ` +
            `figé=${existant.hash.slice(0, 12)} recalculé=${hash.slice(0, 12)}`,
        );
      }
      return { hash: existant.hash, version: existant.version_contenu, deja_existant: true };
    }

    await client.manifesteSnapshot.create({
      data: {
        manifeste_id,
        etape: cle,
        version_contenu: contenu.version,
        version_format:  VERSION_FORMAT,
        hash,
        payload,
        validateur_id,
      },
    });

    this.logger.log(`Instantané figé : ${manifeste_id}/${cle} sha256=${hash.slice(0, 12)}…`);
    return { hash, version: contenu.version, deja_existant: false };
  }

  /**
   * Empreinte de référence d'un manifeste : celle du dernier instantané.
   *
   * C'est elle qui est imprimée sur le PDF et encodée dans le QR code.
   */
  async empreinteCourante(manifeste_id: string): Promise<{ hash: string; etape: string; date: Date } | null> {
    const dernier = await this.prisma.manifesteSnapshot.findFirst({
      where: { manifeste_id },
      orderBy: { createdAt: 'desc' },
      select: { hash: true, etape: true, createdAt: true },
    });
    return dernier ? { hash: dernier.hash, etape: dernier.etape, date: dernier.createdAt } : null;
  }

  /**
   * Vérifie qu'un manifeste correspond toujours à un instantané donné.
   *
   * `conforme: false` signifie que le document présenté ne reflète plus l'état
   * historisé — soit le papier est une version périmée, soit la base a été
   * modifiée hors circuit.
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
