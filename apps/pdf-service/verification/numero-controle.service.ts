// apps/pdf-service/src/verification/numero-controle.service.ts
//
// Génération, vérification et révélation du numéro de contrôle.
//
// Ce service est le SEUL point du système qui manipule un numéro en clair.
// Tout le reste — page publique, cartouche, journaux — ne voit que le
// condensat ou la forme masquée.

import {
  Injectable, Logger, NotFoundException, ForbiddenException,
  OnModuleInit, InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { CemaaCryptoService } from '@sigea/shared-crypto';
import { EncryptedPayload } from '@sigea/shared-types';
import * as crypto from 'crypto';

/**
 * Alphabet sans caractère ambigu.
 *
 * Retirés : B/8, I/1/L, O/0, S/5, Z/2. Le numéro est destiné à être RECOPIÉ
 * À LA MAIN par un contrôleur au sol, parfois sur un carnet, parfois dicté au
 * téléphone. Un « O » lu « zéro » invalide le contrôle et fait suspecter un
 * faux là où il n'y avait qu'une confusion de graphie.
 *
 * 26 caractères, 16 positions → ~75 bits d'entropie. Hors de portée d'une
 * énumération, d'autant que l'endpoint public est limité à 20 requêtes/minute.
 */
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';
const GROUPES = 4;
const TAILLE_GROUPE = 4;
const PREFIXE = 'CM';

@Injectable()
export class NumeroControleService implements OnModuleInit {
  private readonly logger = new Logger(NumeroControleService.name);
  private cle!: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CemaaCryptoService,
  ) {}

  /**
   * Chargement de la clé au démarrage, en échec bloquant.
   *
   * Un service qui démarre sans clé et échoue à la première impression est
   * pire qu'un service qui refuse de démarrer : la panne survient en escale,
   * pas au déploiement. On échoue tôt et bruyamment.
   */
  onModuleInit(): void {
    const brut = process.env.NUMERO_CONTROLE_KEY;
    if (!brut) {
      throw new Error(
        'NUMERO_CONTROLE_KEY absente. Générez-la par : ' +
        'openssl rand -base64 32  — puis renseignez-la dans l\'environnement du pdf-service.',
      );
    }
    const cle = Buffer.from(brut, 'base64');
    if (cle.length !== 32) {
      throw new Error(
        `NUMERO_CONTROLE_KEY invalide : ${cle.length} octets décodés, 32 attendus (AES-256).`,
      );
    }
    this.cle = cle;
    this.logger.log('Clé de numéro de contrôle chargée');
  }

  // ─── Génération ──────────────────────────────────────────────────────────

  /**
   * Tirage cryptographique. `randomInt` et non `Math.random` : le numéro est
   * un secret, et un générateur prévisible le rendrait devinable à partir de
   * quelques numéros connus.
   */
  private tirer(): string {
    const groupes: string[] = [];
    for (let g = 0; g < GROUPES; g++) {
      let bloc = '';
      for (let i = 0; i < TAILLE_GROUPE; i++) {
        bloc += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
      }
      groupes.push(bloc);
    }
    return `${PREFIXE}-${groupes.join('-')}`;
  }

  /** Normalisation : casse, espaces et tirets ignorés à la saisie. */
  private normaliser(code: string): string {
    return code.trim().toUpperCase().replace(/[\s-]/g, '');
  }

  private empreinte(code: string): string {
    return crypto.createHash('sha256').update(this.normaliser(code), 'utf8').digest('hex');
  }

  /**
   * Numéro du manifeste : le lit, ou l'émet s'il n'existe pas encore.
   *
   * Émission paresseuse, au premier rendu du document, plutôt qu'à la création
   * du manifeste. Un brouillon jamais imprimé n'a aucun besoin d'un numéro, et
   * en émettre un consommerait de l'entropie et une ligne pour rien.
   *
   * Idempotent : deux impressions simultanées ne produisent pas deux numéros.
   * La contrainte d'unicité sur manifeste_id arbitre, et l'on relit alors la
   * ligne gagnante.
   */
  async obtenir(manifeste_id: string, etape?: string): Promise<{ code: string; suffixe: string }> {
    const existant = await this.prisma.numeroControle.findUnique({
      where: { manifeste_id },
      select: { code_chiffre: true, suffixe: true },
    });
    if (existant) {
      return { code: this.dechiffrer(existant.code_chiffre), suffixe: existant.suffixe };
    }

    const code = this.tirer();
    const compact = this.normaliser(code);
    const suffixe = compact.slice(-4);

    try {
      await this.prisma.numeroControle.create({
        data: {
          manifeste_id,
          code_hash:    this.empreinte(code),
          code_chiffre: JSON.stringify(this.crypto.encrypt(code, this.cle)),
          suffixe,
          genere_etape: etape ?? null,
        },
      });
      this.logger.log(`Numéro de contrôle émis : manifeste=${manifeste_id} suffixe=${suffixe}`);
      return { code, suffixe };
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002') {
        // Course d'impression : un autre processus a gagné. On relit le sien.
        const gagnant = await this.prisma.numeroControle.findUnique({
          where: { manifeste_id },
          select: { code_chiffre: true, suffixe: true },
        });
        if (gagnant) {
          return { code: this.dechiffrer(gagnant.code_chiffre), suffixe: gagnant.suffixe };
        }
      }
      throw e;
    }
  }

  private dechiffrer(chiffre: string): string {
    try {
      return this.crypto.decrypt(JSON.parse(chiffre) as EncryptedPayload, this.cle);
    } catch {
      // Clé changée, ou ligne corrompue. Ne JAMAIS renvoyer un numéro faux :
      // il serait recopié sur un document et invaliderait tous les contrôles.
      this.logger.error('Déchiffrement du numéro de contrôle impossible — clé incorrecte ?');
      throw new InternalServerErrorException(
        'Numéro de contrôle illisible. Vérifiez NUMERO_CONTROLE_KEY.',
      );
    }
  }

  // ─── Vérification publique ───────────────────────────────────────────────

  /**
   * Le numéro présenté correspond-il à celui du manifeste ?
   *
   * Comparaison à temps constant sur les CONDENSATS, jamais sur les codes.
   * Ce chemin ne déchiffre rien : l'endpoint public n'a aucun accès au clair,
   * même en cas de faille applicative.
   *
   * Renvoie `null` — et non `false` — lorsqu'aucun numéro n'a été présenté :
   * « absent » et « faux » n'appellent pas le même message au contrôleur.
   */
  async concordant(manifeste_id: string, presente?: string): Promise<boolean | null> {
    if (!presente) return null;

    const ligne = await this.prisma.numeroControle.findUnique({
      where: { manifeste_id },
      select: { id: true, code_hash: true },
    });
    // Manifeste antérieur au dispositif : rien à comparer, on ne crie pas au faux.
    if (!ligne) return null;

    const attendu = Buffer.from(ligne.code_hash, 'hex');
    const fourni  = Buffer.from(this.empreinte(presente), 'hex');
    const ok = attendu.length === fourni.length && crypto.timingSafeEqual(attendu, fourni);

    // Compteur mis à jour hors du chemin critique : une écriture qui échoue ne
    // doit jamais faire échouer un contrôle au sol.
    this.prisma.numeroControle
      .update({
        where: { id: ligne.id },
        data: { nb_verifications: { increment: 1 }, derniere_verification: new Date() },
      })
      .catch(() => undefined);

    if (!ok) {
      this.logger.warn(
        `Numéro de contrôle DISCORDANT présenté pour le manifeste ${manifeste_id}`,
      );
    }
    return ok;
  }

  /** Forme publiable : « CM-****-****-7T1D ». */
  masquer(suffixe: string): string {
    return `${PREFIXE}-****-****-${suffixe}`;
  }

  /** Suffixe seul, sans déchiffrement — pour la page publique. */
  async suffixe(manifeste_id: string): Promise<string | null> {
    const l = await this.prisma.numeroControle.findUnique({
      where: { manifeste_id },
      select: { suffixe: true },
    });
    return l?.suffixe ?? null;
  }

  // ─── Réservé à l'administrateur ──────────────────────────────────────────

  /**
   * Révèle le numéro en clair. Appelée UNIQUEMENT depuis un contrôleur porteur
   * de la garde ADMIN, et journalisée : consulter un numéro est un acte, pas
   * une lecture anodine.
   */
  async reveler(manifeste_id: string, adminId: string): Promise<{
    manifeste_id: string; code: string; genere_le: Date;
    nb_verifications: number; derniere_verification: Date | null;
  }> {
    const l = await this.prisma.numeroControle.findUnique({ where: { manifeste_id } });
    if (!l) throw new NotFoundException("Aucun numéro de contrôle émis pour ce manifeste");

    this.logger.warn(`Numéro de contrôle RÉVÉLÉ : manifeste=${manifeste_id} admin=${adminId}`);

    return {
      manifeste_id,
      code: this.dechiffrer(l.code_chiffre),
      genere_le: l.genere_le,
      nb_verifications: l.nb_verifications,
      derniere_verification: l.derniere_verification,
    };
  }

  /**
   * Recherche inverse : à quel manifeste appartient ce numéro ?
   *
   * C'est la réponse au contrôleur qui téléphone en annonçant un numéro relevé
   * sur un document. La recherche porte sur le condensat, via l'index unique :
   * une seule lecture indexée, aucun parcours de table.
   *
   * Une recherche par SUFFIXE seul est volontairement absente : elle
   * renverrait des dizaines de manifestes et transformerait le second facteur
   * en oracle. Le contrôleur dicte le numéro entier, ou rien.
   */
  async rechercher(code: string, adminId: string): Promise<unknown> {
    const compact = this.normaliser(code);
    if (compact.length !== PREFIXE.length + GROUPES * TAILLE_GROUPE) {
      throw new ForbiddenException(
        `Numéro incomplet : ${GROUPES * TAILLE_GROUPE} caractères attendus après le préfixe. ` +
        'La recherche par fragment n\'est pas autorisée.',
      );
    }

    const l = await this.prisma.numeroControle.findUnique({
      where: { code_hash: this.empreinte(code) },
      include: {
        manifeste: {
          select: {
            id: true, statut: true, etape_courante: true, etape_vol: true,
            version: true, flag_sensible: true, createdAt: true,
            base: { select: { code_base: true, nom: true } },
            vol:  { select: { numero_mission: true, date_heure: true, immatriculation: true } },
          },
        },
      },
    });

    this.logger.warn(
      `Recherche par numéro de contrôle : admin=${adminId} résultat=${l ? l.manifeste_id : 'AUCUN'}`,
    );

    if (!l) {
      // Message identique à celui d'un numéro mal formé côté IHM : on ne
      // confirme pas qu'un numéro « existe presque ».
      throw new NotFoundException('Aucun manifeste ne porte ce numéro de contrôle');
    }
    return {
      manifeste: l.manifeste,
      genere_le: l.genere_le,
      nb_verifications: l.nb_verifications,
      derniere_verification: l.derniere_verification,
    };
  }
}