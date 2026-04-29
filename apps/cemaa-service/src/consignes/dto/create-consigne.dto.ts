import { IsUUID, IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import { TypeConsigne } from '@sigea/shared-types';

export class CreateConsigneDto {
  @IsUUID() vol_id!: string;
  @IsOptional() @IsUUID() escale_base_id?: string;
  @IsEnum(TypeConsigne) type!: TypeConsigne;
  @IsString() contenu!: string;
  @IsOptional() @IsNumber() places_bloquees?: number;
  @IsOptional() @IsNumber() masse_bloquee_kg?: number;
}
