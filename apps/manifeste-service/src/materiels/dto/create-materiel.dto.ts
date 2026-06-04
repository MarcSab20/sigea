// apps/manifeste-service/src/materiels/dto/create-materiel.dto.ts
import { IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { TypeMissionLogistique } from '@sigea/shared-types';

export class CreateMaterielDto {
  @IsString() designation!: string;
  @IsEnum(TypeMissionLogistique) type_mission_log!: TypeMissionLogistique;
  @IsString() proprietaire!: string;
  @IsNumber() poids_kg!: number;
  @IsOptional() @IsNumber() volume?: number;
  @IsString() destination!: string;
  @IsString() expediteur_nom!: string;
  @IsString() expediteur_fonction!: string;
  @IsString() expediteur_tel!: string;
}