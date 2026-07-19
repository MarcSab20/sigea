import { IsUUID, IsEnum, IsOptional, IsString, IsNumber, Min, MaxLength } from 'class-validator';
import { TypeConsigne } from '@sigea/shared-types';

export class CreateConsigneDto {
  @IsUUID() vol_id!: string;

  // escale_base_id référence Base.id. En base, cet id vaut le code_base
  // ("BA101") imposé par le seed, PAS un UUID : on valide donc une chaîne.
  @IsOptional() @IsString() escale_base_id?: string;

  @IsEnum(TypeConsigne) type!: TypeConsigne;
  @IsString() @MaxLength(5000) contenu!: string;
  @IsOptional() @IsNumber() @Min(0) places_bloquees?: number;
  @IsOptional() @IsNumber() @Min(0) masse_bloquee_kg?: number;
}

export class UpdateConsigneDto {
  @IsOptional() @IsString() @MaxLength(5000) contenu?: string;
  @IsOptional() @IsNumber() @Min(0) places_bloquees?: number;
  @IsOptional() @IsNumber() @Min(0) masse_bloquee_kg?: number;
}