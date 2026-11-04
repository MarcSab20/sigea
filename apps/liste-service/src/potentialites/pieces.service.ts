// apps/liste-service/src/potentialites/pieces.service.ts
//
// Pièces justificatives d'un voyageur potentiel.
//
// ═══════════════════════════════════════════════════════════════════════════
// DEUX DÉCISIONS À CONNAÎTRE
// ═══════════════════════════════════════════════════════════════════════════
//
// 1. LES OCTETS NE SONT PAS EN BASE.
//    Ils vivent sur le volume PIECES_ROOT ; seules les métadonnées sont en
//    PostgreSQL. Stocker des scans en base gonflerait chaque sauvegarde de
//    plusieurs gigaoctets et rendrait toute restauration interminable, pour un
//    contenu que personne n'interroge en SQL.
//
// 2. LE DÉPÔT EST RÉSERVÉ AU SECRÉTAIRE, LA LECTURE EST OUVERTE À LA CHAÎNE.
//    Toutes les autorités de discrimination — ADJ_AIR, COMRMIA, COMBASE et ses
//    délégataires, COMBORD — doivent pouvoir consulter un ordre de mission
//    avant de retirer quelqu'un. Discriminer sans pouvoir vérifier la pièce,
//    c'est décider sur un nom.
//    Chaque consultation est journalisée : ce sont des documents nominatifs.

import {
  Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '@sigea/shared-database';
import {
  JwtPayload, RoleUtilisateur, Rmia,
  Perimetre, perimetreEffectif, rolesEffectifs, rmiasCouvertes,
  ROLES_DELEGATAIRES_COMBASE,
} from '@sigea/shared-types';
import { DeposerPieceDto } from './dto/potentialite.dto';

/** Racine de stockage. Monté en volume, jamais dans l'image. */
const PIECES_ROOT = process.env.PIECES_ROOT ?? '/data/pieces';

/** Plafond par pièce, sur la taille DÉCODÉE. */
const TAILLE_MAX = 8 * 1024 * 1024;

/**
 * Types acceptés.
 *
 * Liste blanche, et non liste noire : une liste noire laisse toujours passer
 * le format qu'on n'avait pas anticipé. Les exécutables, les archives et le
 * HTML sont absents à dessein — un HTML servi depuis le domaine de
 * l'application permettrait d'y exécuter du script.
 */
const TYPES_ADMIS = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
]);

const EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg', 'image/png': '.png',
  'image/webp': '.webp', 'image/tiff': '.tif',
};

@Injectable()
export class PiecesService {
  private readonly logger = new Logger(PiecesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Droit de LECTURE sur les pièces d'une potentialité.
   *
   * Ouvert à toute la chaîne de discrimination, mais toujours borné par le
   * périmètre : un ADJ_AIR ne lit que les pièces de sa RMIA. Le COMBASE et le
   * COMBORD, eux, n'ont pas de RMIA — ils accèdent parce qu'une liste de leur
   * ressort porte cette personne. D'où la jointure par les lignes de liste :
   * c'est le fait d'avoir le dossier en main qui ouvre la pièce, pas le rôle.
   */
  private async autoriserLecture(potentialite_id: string, user: JwtPayload): Promise<void> {
    const roles = rolesEffectifs(user);

    if (perimetreEffectif(user) === Perimetre.NATIONAL) return;

    const rmias = rmiasCouvertes(user);
    if (rmias.length) {
      const p = await this.prisma.potentialite.findFirst({
        where: { id: potentialite_id, rmia: { in: rmias as Rmia[] } },
        select: { id: true },
      });
      if (p) return;
    }

    const roleDeBase =
      roles.includes(RoleUtilisateur.COMBASE) ||
      roles.includes(RoleUtilisateur.COMBORD) ||
      roles.some((r) => ROLES_DELEGATAIRES_COMBASE.includes(r));

    if (roleDeBase) {
      const portee = await this.prisma.ligneListe.findFirst({
        where: {
          potentialite_id,
          liste: {
            OR: [
              ...(user.base_id ? [{ etape: { base_id: user.base_id } }] : []),
              { vol: { combord_id: user.sub } },
            ],
          },
        },
        select: { id: true },
      });
      if (portee) return;
    }

    // 404 et non 403 : confirmer l'existence d'une pièce que l'appelant n'a pas
    // le droit de lire renseigne déjà sur la personne concernée.
    throw new NotFoundException('Pièce introuvable.');
  }

  async deposer(
    potentialite_id: string, dto: DeposerPieceDto, user: JwtPayload,
  ): Promise<unknown> {
    if (!rolesEffectifs(user).includes(RoleUtilisateur.SEC_ADJ_AIR)) {
      throw new ForbiddenException(
        "Seul le secrétaire de l'Adjoint Air dépose les pièces justificatives.",
      );
    }
    if (!TYPES_ADMIS.has(dto.type_mime)) {
      throw new BadRequestException(
        `Type « ${dto.type_mime} » non admis. Formats acceptés : PDF, JPEG, PNG, WEBP, TIFF.`,
      );
    }

    const rmias = rmiasCouvertes(user);
    const p = await this.prisma.potentialite.findFirst({
      where: { id: potentialite_id, rmia: { in: rmias as Rmia[] } },
      select: { id: true, nom: true, prenom: true, rmia: true },
    });
    if (!p) throw new NotFoundException('Potentialité introuvable ou hors de votre région.');

    const octets = Buffer.from(dto.contenu_base64, 'base64');
    if (!octets.length) throw new BadRequestException('Contenu vide.');
    if (octets.length > TAILLE_MAX) {
      throw new BadRequestException(
        `Pièce de ${(octets.length / 1024 / 1024).toFixed(1)} Mo : le plafond est de ` +
          `${TAILLE_MAX / 1024 / 1024} Mo. Réduisez la résolution du scan.`,
      );
    }

    const sha256 = createHash('sha256').update(octets).digest('hex');

    // Chemin dérivé de l'empreinte, jamais du nom fourni. Le nom d'origine est
    // conservé en base pour l'affichage et le téléchargement, mais ne touche
    // jamais le système de fichiers : c'est la seule façon d'exclure
    // définitivement la traversée de répertoire.
    const relatif = path.posix.join(
      String(p.rmia), sha256.slice(0, 2), `${sha256}${EXTENSIONS[dto.type_mime] ?? ''}`,
    );
    const absolu = path.join(PIECES_ROOT, relatif);

    await fs.mkdir(path.dirname(absolu), { recursive: true });
    // `wx` échouerait si le fichier existe. On écrit donc sans drapeau : deux
    // dépôts du même document produisent la même empreinte, donc le même
    // contenu — réécrire est sans effet, et refuser serait incompréhensible
    // pour un secrétaire qui dépose la même pièce pour deux personnes.
    await fs.writeFile(absolu, octets);

    const piece = await this.prisma.pieceJointe.create({
      data: {
        potentialite_id,
        nature:        dto.nature,
        nom_fichier:   dto.nom_fichier.trim(),
        type_mime:     dto.type_mime,
        taille_octets: octets.length,
        chemin:        relatif,
        sha256,
        depose_par:    user.sub,
      },
      select: {
        id: true, nature: true, nom_fichier: true, type_mime: true,
        taille_octets: true, sha256: true, createdAt: true,
      },
    });

    this.logger.log(
      `Pièce déposée : ${dto.nature} pour ${p.nom} ${p.prenom} ` +
        `(${octets.length} o) par ${user.sub}`,
    );
    return piece;
  }

  /** Renvoie les octets d'une pièce, après contrôle de périmètre. */
  async telecharger(
    piece_id: string, user: JwtPayload,
  ): Promise<{ octets: Buffer; nom: string; type: string }> {
    const piece = await this.prisma.pieceJointe.findUnique({
      where: { id: piece_id },
      select: {
        potentialite_id: true, chemin: true, nom_fichier: true,
        type_mime: true, sha256: true,
      },
    });
    if (!piece) throw new NotFoundException('Pièce introuvable.');

    await this.autoriserLecture(piece.potentialite_id, user);

    const absolu = path.join(PIECES_ROOT, piece.chemin);
    let octets: Buffer;
    try {
      octets = await fs.readFile(absolu);
    } catch {
      // Métadonnée présente, fichier absent : le volume n'est pas monté, ou il
      // a été purgé. On le dit, plutôt que de renvoyer un 404 qui ferait
      // croire à une erreur de référence.
      this.logger.error(`Pièce ${piece_id} absente du volume : ${piece.chemin}`);
      throw new NotFoundException(
        "Le fichier n'est plus disponible sur le serveur de stockage.",
      );
    }

    const empreinte = createHash('sha256').update(octets).digest('hex');
    if (empreinte !== piece.sha256) {
      // Divergence entre le fichier servi et celui qui a été déposé. On refuse
      // de le servir : une pièce justificative altérée est pire qu'une pièce
      // absente, parce qu'elle sera lue comme authentique.
      this.logger.error(
        `Intégrité rompue sur la pièce ${piece_id} : ` +
          `${empreinte.slice(0, 12)}… ≠ ${piece.sha256.slice(0, 12)}…`,
      );
      throw new NotFoundException(
        "Le fichier stocké ne correspond plus à la pièce déposée. Signalez-le à l'administrateur.",
      );
    }

    this.logger.log(`Pièce ${piece_id} consultée par ${user.sub} (${user.role})`);
    return { octets, nom: piece.nom_fichier, type: piece.type_mime };
  }

  async supprimer(piece_id: string, user: JwtPayload): Promise<{ supprime: boolean }> {
    if (!rolesEffectifs(user).includes(RoleUtilisateur.SEC_ADJ_AIR)) {
      throw new ForbiddenException(
        "Seul le secrétaire de l'Adjoint Air retire une pièce justificative.",
      );
    }
    const rmias = rmiasCouvertes(user);
    const piece = await this.prisma.pieceJointe.findFirst({
      where: { id: piece_id, potentialite: { rmia: { in: rmias as Rmia[] } } },
      select: { id: true, chemin: true, sha256: true },
    });
    if (!piece) throw new NotFoundException('Pièce introuvable.');

    await this.prisma.pieceJointe.delete({ where: { id: piece_id } });

    // Le fichier n'est PAS effacé du volume : la même empreinte peut être
    // référencée par la pièce d'une autre personne — même ordre de mission
    // collectif, par exemple. L'effacer ici la rendrait illisible ailleurs.
    // Le nettoyage des fichiers orphelins relève d'une tâche d'exploitation.
    const encoreReference = await this.prisma.pieceJointe.count({
      where: { sha256: piece.sha256 },
    });
    this.logger.log(
      `Pièce ${piece_id} retirée par ${user.sub}` +
        (encoreReference ? ` (fichier conservé, ${encoreReference} autre(s) référence(s))` : ''),
    );
    return { supprime: true };
  }
}