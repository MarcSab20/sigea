// apps/liste-service/src/listes/dto/ligne.dto.ts

import {
  IsString, IsOptional, IsEnum, IsInt, IsNumber, IsUUID, IsArray, IsBoolean,
  ValidateNested, MinLength, MaxLength, Min, ArrayMinSize, ArrayMaxSize, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CategoriePassager, NatureLigne, Priorite, TypeMissionLogistique, AutoriteCentrale,
} from '@sigea/shared-types';

const TELEPHONE = /^\+?[0-9][0-9\s.-]{7,19}$/;

/**
 * Sélection d'une personne du vivier vers la liste.
 *
 * `debarquement_ordre` est OBLIGATOIRE et n'a pas de valeur par défaut :
 * sans lui, on ne sait pas quels tronçons la personne occupe, et le contrôle
 * de sur-réservation aux escales devient faux. La destination « souhaitée »
 * enregistrée sur la potentialité est indicative et ne peut pas en tenir lieu.
 */
export class SelectionDto {
  @IsUUID() potentialite_id!: string;

  @IsInt() @Min(2) debarquement_ordre!: number;

  /** Par défaut : la priorité proposée sur la potentialité. */
  @IsOptional() @IsEnum(Priorite) priorite?: Priorite;

  /** Par défaut : HIERARCHISEE, dans la limite du quota ; ATTENTE au-delà. */
  @IsOptional() @IsEnum(NatureLigne) nature?: NatureLigne;
}

export class SelectionnerDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SelectionDto)
  selections!: SelectionDto[];

  /**
   * Bascule automatiquement en liste d'attente ce qui dépasse le quota, au lieu
   * de rejeter toute la sélection.
   *
   * Activé par défaut côté IHM : un secrétaire qui sélectionne quarante noms
   * pour vingt places veut vingt retenus et vingt en attente, pas un message
   * d'erreur et quarante noms à ressaisir.
   */
  @IsOptional() @IsBoolean() deborder_en_attente?: boolean;
}

/** Saisie directe, lorsque le demandeur ne figure pas au vivier. */
export class CreateLigneDto {
  @IsString() @MinLength(2) @MaxLength(60) nom!: string;
  @IsString() @MinLength(2) @MaxLength(60) prenom!: string;
  @IsOptional() @IsString() @MaxLength(30) grade?: string;
  @IsOptional() @IsString() @MaxLength(30) matricule?: string;
  @IsOptional() @IsString() @MaxLength(30) cni?: string;
  @IsOptional() @IsString() @MaxLength(60) unite?: string;

  @IsString() @Matches(TELEPHONE, { message: 'telephone : numéro invalide' })
  telephone!: string;

  @IsEnum(CategoriePassager) categorie!: CategoriePassager;
  @IsOptional() @IsEnum(Priorite) priorite?: Priorite;
  @IsOptional() @IsEnum(NatureLigne) nature?: NatureLigne;

  @IsInt() @Min(2) debarquement_ordre!: number;

  @IsOptional() @IsInt() @Min(0)    nb_bagages?: number;
  @IsOptional() @IsNumber() @Min(0) masse_bagages_kg?: number;
  @IsOptional() @IsString() @MaxLength(40) couleur_bagages?: string;

  @IsOptional() @IsString() @MaxLength(60) contact_urgence_nom?: string;
  @IsOptional() @IsString() @Matches(TELEPHONE) contact_urgence_tel?: string;
  @IsOptional() @IsString() @MaxLength(40) contact_urgence_qual?: string;
  @IsOptional() @IsString() @MaxLength(60) ref_autorisation?: string;
}

/**
 * Discrimination d'une ligne par une autorité.
 *
 * Les trois leviers de la directive — retirer, changer l'ordre, changer la
 * priorité — sont réunis dans un seul appel : ils s'exercent souvent ensemble
 * (« je le passe en P2 et je le remonte en tête »), et les séparer imposerait
 * deux écritures là où une décision a été prise.
 *
 * `motif` est obligatoire. Une discrimination sans motif est une décision que
 * personne ne pourra justifier six mois plus tard.
 */
export class DiscriminerDto {
  @IsOptional() @IsEnum(NatureLigne) nature?: NatureLigne;
  @IsOptional() @IsEnum(Priorite) priorite?: Priorite;
  /** Nouveau rang au sein de (nature, priorité). 1 = tête de tableau. */
  @IsOptional() @IsInt() @Min(1) rang?: number;

  @IsString() @MinLength(3) @MaxLength(500) motif!: string;
}

/** Réordonnancement complet d'un tableau de priorité, par glisser-déposer. */
export class ReordonnerDto {
  @IsEnum(NatureLigne) nature!: NatureLigne;
  @IsEnum(Priorite) priorite!: Priorite;

  /** Identifiants des lignes, dans l'ordre voulu. Doit couvrir TOUT le tableau. */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  ordre!: string[];

  @IsString() @MinLength(3) @MaxLength(500) motif!: string;
}

export class CreateFretDto {
  @IsString() @MinLength(2) @MaxLength(120) designation!: string;
  @IsEnum(TypeMissionLogistique) type_mission_log!: TypeMissionLogistique;
  @IsString() @MinLength(2) @MaxLength(80) proprietaire!: string;

  @IsNumber() @Min(0.01) poids_kg!: number;
  @IsOptional() @IsNumber() @Min(0) volume?: number;

  @IsInt() @Min(2) debarquement_ordre!: number;

  @IsString() @MinLength(2) @MaxLength(60) expediteur_nom!: string;
  @IsString() @MinLength(2) @MaxLength(60) expediteur_fonction!: string;
  @IsString() @Matches(TELEPHONE) expediteur_tel!: string;

  /** Renseignée si et seulement si la marchandise est classée dangereuse. */
  @IsOptional() @IsString() @MaxLength(20) classe_iata?: string;
  @IsOptional() @IsString() @MaxLength(80) conditionnement?: string;
}

/**
 * Imposition d'un embarquement par une autorité centrale.
 *
 * C'est le seul cas où quelqu'un d'autre que le SEC_ADJ_AIR écrit sur une
 * liste, et il correspond à l'espace CEMAA conservé pour les urgences. La ligne
 * créée est verrouillée dès l'origine : aucune discrimination aval ne peut la
 * retirer — sinon l'imposition ne serait qu'une suggestion.
 */
export class ImposerDto extends CreateLigneDto {
  @IsEnum(AutoriteCentrale) autorite!: AutoriteCentrale;
  @IsString() @MinLength(10) @MaxLength(500) justification!: string;
}