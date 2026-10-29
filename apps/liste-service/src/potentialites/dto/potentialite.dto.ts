// apps/liste-service/src/potentialites/dto/potentialite.dto.ts

import {
  IsString, IsOptional, IsEnum, IsInt, IsNumber, IsUUID, IsDateString,
  MinLength, MaxLength, Min, Matches, IsIn,
} from 'class-validator';
import { CategoriePassager, Priorite, StatutPotentialite } from '@sigea/shared-types';

/**
 * Téléphone camerounais ou international.
 *
 * Volontairement permissif sur la forme (espaces, tirets, indicatif) mais
 * strict sur la présence : ce numéro est le SEUL canal par lequel le voyageur
 * recevra son heure de présentation. Un enregistrement sans numéro exploitable
 * produit un passager qui ne se présentera pas.
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

  @IsOptional() @IsString() @MaxLength(60)  destination_souhaitee?: string;
  @IsOptional() @IsString() @MaxLength(300) motif?: string;
  @IsOptional() @IsString() @MaxLength(60)  ref_autorisation?: string;

  @IsOptional() @IsInt() @Min(0)    nb_bagages?: number;
  @IsOptional() @IsNumber() @Min(0) masse_bagages_kg?: number;

  @IsOptional() @IsString() @MaxLength(60) contact_urgence_nom?: string;
  @IsOptional() @IsString() @Matches(TELEPHONE) contact_urgence_tel?: string;
  @IsOptional() @IsString() @MaxLength(40) contact_urgence_qual?: string;

  /**
   * Péremption. Si elle n'est pas fournie, le service applique un horizon par
   * défaut : un vivier sans date de validité se transforme en liste de noms
   * dont plus personne ne sait s'ils sont encore demandeurs.
   */
  @IsOptional() @IsDateString() valable_jusqu_au?: string;

  /**
   * Base de présentation. Optionnelle : par défaut celle du secrétaire.
   * Utile lorsqu'une RMIA couvre plusieurs bases de présentation.
   */
  @IsOptional() @IsString() base_id?: string;
}

export class UpdatePotentialiteDto extends CreatePotentialiteDto {}

export class FiltrePotentialiteDto {
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @IsEnum(StatutPotentialite) statut?: StatutPotentialite;
  @IsOptional() @IsEnum(CategoriePassager) categorie?: CategoriePassager;
  @IsOptional() @IsString() base_id?: string;

  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) taille?: number;

  /** Masque les potentialités périmées. Actif par défaut. */
  @IsOptional() @IsIn(['0', '1']) inclure_perimees?: string;
}

export class ArchiverPotentialiteDto {
  @IsString() @MinLength(3) @MaxLength(300) motif!: string;
}

export class IdsDto {
  @IsUUID('4', { each: true }) ids!: string[];
}