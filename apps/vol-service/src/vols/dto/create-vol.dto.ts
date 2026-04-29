import { IsString, IsUUID, IsDateString, IsEnum, IsInt, IsOptional, IsArray } from 'class-validator';
import { TypeMission } from '@sigea/shared-types';

export class CreateVolDto {
  @IsString() numero_mission!: string;
  @IsString() immatriculation!: string;
  @IsDateString() date_heure!: string;
  @IsUUID() base_depart_id!: string;
  @IsUUID() base_arrivee_id!: string;
  @IsEnum(TypeMission) type_mission!: TypeMission;
  @IsInt() capacite_places!: number;
  @IsInt() capacite_cargo_kg!: number;
  @IsArray() @IsOptional() escales?: string[];
}
