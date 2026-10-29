// libs/shared-integrity/src/liste-snapshot.service.ts
//
// Historisation du contenu visé.
//
// VisaListe conserve QUI a signé et QUAND. ListeSnapshot conserve SUR QUOI.
// Sans lui, une liste rejetée puis corrigée perdrait toute trace de l'état sur
// lequel l'ADJ_AIR s'était prononcé — c'est précisément la question qui sera
// posée en cas d'incident ou de contestation.
//
// Un instantané est immuable : aucune méthode d'écriture autre que `figer`
// n'est exposée.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import {
  ContenuListe, canoniserListe, empreinteListe, VERSION_FORMAT_LISTE,
} from './liste-empreinte';

/**
 * Sous-ensemble de Prisma suffisant pour figer un instantané.
 *
 * Typé par les modèles utilisés plutôt que par `PrismaClient` : le client de
 * transaction que Prisma passe à `$transaction` n'expose ni `$connect` ni
 * `$transaction`, il ne serait donc pas assignable à PrismaService.
 */
export type ClientListe = Pick<PrismaService, 'listeEmbarquement' | 'listeSnapshot'>;

export interface ResultatSnapshotListe {
  hash:          string;
  version:       number;
  deja_existant: boolean;
}

@Injectable()
export class ListeSnapshotService {
  private readonly logger = new Logger(ListeSnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recharge le contenu d'une liste sous forme canonique.
   *
   * `client` permet de lire DANS la transaction appelante. Sans lui, la lecture
   * partirait sur une seconde connexion du pool pendant que la transaction en
   * retient déjà une : deux connexions mobilisées par visa, et un risque
   * d'épuisement du pool sous charge.
   */
  async lireContenu(liste_id: string, client?: ClientListe): Promise<ContenuListe | null> {
    const l = await (client ?? this.prisma).listeEmbarquement.findUnique({
      where: { id: liste_id },
      include: {
        vol:   { select: { numero_mission: true, immatriculation: true, date_heure: true } },
        etape: { select: { ordre: true, base_id: true } },
        // Tri SQL en plus du tri applicatif de `canoniserListe` : ceinture et
        // bretelles, et le payload archivé reste lisible dans un ordre stable.
        lignes: { orderBy: [{ priorite: 'asc' }, { rang: 'asc' }, { nom: 'asc' }] },
        frets:  { orderBy: [{ designation: 'asc' }] },
      },
    });
    if (!l) return null;

    return {
      liste_id:       l.id,
      version:        l.version,
      etape_ordre:    l.etape.ordre,
      base_id:        l.etape.base_id,
      rmia:           String(l.rmia),
      quota_places:   l.quota_places,
      quota_masse_kg: l.quota_masse_kg,
      vol: l.vol
        ? {
            numero_mission:  l.vol.numero_mission,
            immatriculation: l.vol.immatriculation,
            date_heure:      l.vol.date_heure,
          }
        : null,
      lignes: l.lignes.map((x) => ({
        nature: String(x.nature), priorite: String(x.priorite), rang: x.rang,
        nom: x.nom, prenom: x.prenom, grade: x.grade, matricule: x.matricule,
        categorie: String(x.categorie),
        embarquement_ordre: x.embarquement_ordre,
        debarquement_ordre: x.debarquement_ordre,
        masse_bagages_kg:   x.masse_bagages_kg,
        origine:            String(x.origine),
      })),
      frets: l.frets.map((f) => ({
        designation: f.designation, proprietaire: f.proprietaire, poids_kg: f.poids_kg,
        embarquement_ordre: f.embarquement_ordre,
        debarquement_ordre: f.debarquement_ordre,
        retire: f.retire, origine: String(f.origine),
      })),
    };
  }

  /**
   * Fige le contenu de la liste au franchissement d'une étape.
   *
   * ── Pourquoi `etape` est une chaîne et non un enum ──
   * Les passages répétés sur une même étape — visa, rejet, correction, nouveau
   * visa — doivent coexister. Ils sont suffixés « ETAPE#2 », « ETAPE#3 ». Une
   * contrainte d'unicité sur (liste, étape) les écraserait, et avec eux la
   * trace de ce qui a été corrigé.
   */
  async figer(
    liste_id: string,
    etape: string,
    signataire_id: string | null,
    client?: ClientListe,
    options?: { versionner?: boolean },
  ): Promise<ResultatSnapshotListe> {
    const db = client ?? this.prisma;

    const contenu = await this.lireContenu(liste_id, db);
    if (!contenu) {
      throw new Error(`Instantané impossible : liste ${liste_id} introuvable`);
    }

    const hash    = empreinteListe(contenu);
    const payload = canoniserListe(contenu);

    let cle = etape;
    if (options?.versionner) {
      const deja = await db.listeSnapshot.count({
        where: { liste_id, etape: { startsWith: etape } },
      });
      if (deja > 0) cle = `${etape}#${deja + 1}`;
    }

    const existant = await db.listeSnapshot.findUnique({
      where: { liste_id_etape: { liste_id, etape: cle } },
      select: { hash: true, version_contenu: true },
    });
    if (existant) {
      // Rejouer une signature ne doit pas réécrire l'instantané. On signale la
      // divergence si elle existe : c'est le symptôme d'un contenu modifié
      // entre deux tentatives, et cela mérite une trace.
      if (existant.hash !== hash) {
        this.logger.warn(
          `Instantané ${cle} déjà figé pour la liste ${liste_id} avec une empreinte ` +
            `différente (${existant.hash.slice(0, 12)}… ≠ ${hash.slice(0, 12)}…). ` +
            "L'instantané d'origine est conservé.",
        );
      }
      return { hash: existant.hash, version: existant.version_contenu, deja_existant: true };
    }

    await db.listeSnapshot.create({
      data: {
        liste_id,
        etape:           cle,
        version_contenu: contenu.version,
        version_format:  VERSION_FORMAT_LISTE,
        hash,
        payload,
        signataire_id,
      },
    });

    return { hash, version: contenu.version, deja_existant: false };
  }
}