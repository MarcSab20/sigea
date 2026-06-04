// apps/manifeste-service/src/passagers/dto/create-passager.dto.ts
import { IsString, IsEnum, IsOptional, IsInt, IsNumber, MinLength, MaxLength } from 'class-validator';
import { CategoriePassager } from '@sigea/shared-types';

export class CreatePassagerDto {
  @IsString() @MinLength(2) nom!: string;
  @IsString() @MinLength(2) prenom!: string;
  @IsOptional() @IsString() grade?: string;
  @IsEnum(CategoriePassager) categorie!: CategoriePassager;
  @IsOptional() @IsString() matricule?: string;
  @IsOptional() @IsString() unite?: string;
  @IsString() destination!: string;
  @IsInt() nb_bagages!: number;
  @IsNumber() masse_bagages_kg!: number;
  @IsOptional() @IsString() couleur_bagages?: string;
  @IsString() contact_urgence_nom!: string;
  @IsString() contact_urgence_tel!: string;
  @IsOptional() @IsString() contact_urgence_qual?: string;
  @IsOptional() @IsString() ref_autorisation?: string;
}