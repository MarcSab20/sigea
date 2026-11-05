// apps/liste-service/src/potentialites/dto/potentialite.dto.ts

import {
  IsString, IsOptional, IsEnum, IsInt, IsNumber, IsUUID, IsDateString,
  MinLength, MaxLength, Min, Matches, IsIn, IsBase64,
} from 'class-validator';
import {
  CategoriePassager, Priorite, StatutPotentialite, NaturePiece,
} from '@sigea/shared-types';
import { Type } from 'class-transformer';

/**
 * Téléphone camerounais ou international.
 *
 * Permissif sur la forme, strict sur la présence : ce numéro est le seul canal
 * par lequel le voyageur recevra son heure de présentation.
 */
const TELEPHONE = /^\+?[0-9][0-9\s.-]{7,19}$/;

export class CreatePotentialiteDto {
  @IsString() @MinLength(2) @MaxLength(60) nom!: string;
  @IsString() @MinLength(2) @MaxLength(60) prenom!: string;

  @IsOptional() @IsString() @MaxLength(30) grade?: string;
  @IsOptional() @IsString() @MaxLength(30) matricule?: string;
  @IsOptional() @IsString() @MaxLength(30) cni?: string;
  @IsOptional() @IsString() @MaxLength(60) unite?: string;

  @IsString()
  @Matches(TELEPHONE, { message: 'telephone : numéro invalide' })
  telephone!: string;

  @IsEnum(CategoriePassager) categorie!: CategoriePassager;

  /** Priorité PROPOSÉE. L'ADJ_AIR et le COMRMIA la révisent sur la liste. */
  @IsOptional() @IsEnum(Priorite) priorite_proposee?: Priorite;

  // ── Besoin de transport ──
  //
  // Le trio jour / départ / arrivée remplace l'ancienne « base de
  // présentation ». C'est ce que le demandeur exprime réellement, et c'est sur
  // ces trois critères que le secrétaire le retrouvera le jour d'un vol.

  /**
   * Jour souhaité. Facultatif : un demandeur en attente d'ordre peut s'inscrire
   * sans date. Il figurera alors dans le vivier sans date, et le secrétaire
   * devra le chercher — ce qui est le comportement attendu, pas un défaut.
   */
  @IsOptional() @IsDateString() date_vol_souhaitee?: string;
  @IsOptional() @IsString() base_depart_id?: string;
  @IsOptional() @IsString() base_arrivee_id?: string;

  @IsOptional() @IsString() @MaxLength(300) motif?: string;
  @IsOptional() @IsString() @MaxLength(60)  ref_autorisation?: string;

  @IsOptional() @IsInt() @Min(0)    nb_bagages?: number;
  @IsOptional() @IsNumber() @Min(0) masse_bagages_kg?: number;

  @IsOptional() @IsString() @MaxLength(60) contact_urgence_nom?: string;
  @IsOptional() @IsString() @Matches(TELEPHONE) contact_urgence_tel?: string;
  @IsOptional() @IsString() @MaxLength(40) contact_urgence_qual?: string;

  /**
   * Péremption. À défaut, le service applique un horizon par défaut : un vivier
   * sans date de validité se transforme en liste de noms dont plus personne ne
   * sait s'ils sont encore demandeurs.
   */
  @IsOptional() @IsDateString() valable_jusqu_au?: string;
}

export class UpdatePotentialiteDto extends CreatePotentialiteDto {}

export class FiltrePotentialiteDto {
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @IsEnum(StatutPotentialite) statut?: StatutPotentialite;
  @IsOptional() @IsEnum(CategoriePassager) categorie?: CategoriePassager;

  // ── Filtres de rapprochement avec un vol ──
  //
  // Ce sont eux qui donnent son intérêt au vivier : à la diffusion d'un vol,
  // l'écran de sélection les préremplit à partir de la date et de l'itinéraire.
  @IsOptional() @IsDateString() date_debut?: string;
  @IsOptional() @IsDateString() date_fin?: string;
  @IsOptional() @IsString() base_depart_id?: string;
  @IsOptional() @IsString() base_arrivee_id?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) taille?: number;

  /** Inclut les potentialités périmées. Exclues par défaut. */
  @IsOptional() @IsIn(['0', '1']) inclure_perimees?: string;
  /** Inclut celles sans date souhaitée lors d'un filtre par période. */
  @IsOptional() @IsIn(['0', '1']) inclure_sans_date?: string;
}

export class ArchiverPotentialiteDto {
  @IsString() @MinLength(3) @MaxLength(300) motif!: string;
}

/**
 * Dépôt d'une pièce justificative.
 *
 * ── Pourquoi du base64 et non un envoi multipart ──
 * Les pièces attendues sont des ordres de mission et des scans d'identité :
 * quelques centaines de kilo-octets. Le base64 coûte un tiers de volume en
 * plus, ce qui est sans portée à cette échelle, et évite d'introduire multer,
 * sa configuration de stockage temporaire et ses types dans un service qui
 * n'en a aucun autre usage. Moins de pièces mobiles pour un gain nul.
 *
 * Le plafond est appliqué côté service, sur la taille décodée — un contrôle
 * sur la chaîne base64 se tromperait d'un tiers.
 */
export class DeposerPieceDto {
  @IsEnum(NaturePiece) nature!: NaturePiece;

  @IsString() @MinLength(1) @MaxLength(200)
  @Matches(/^[^\\/:*?"<>|]+$/, {
    message: 'nom_fichier : caractères de chemin interdits',
  })
  nom_fichier!: string;

  @IsString() @MaxLength(100) type_mime!: string;

  @IsString()
  @IsBase64(undefined, { message: 'contenu : base64 invalide' })
  contenu_base64!: string;
}

export class IdsDto {
  @IsUUID('4', { each: true }) ids!: string[];
}