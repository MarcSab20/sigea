// apps/vol-service/src/vols/dto/create-vol.dto.ts
import { IsString, IsUUID, IsDateString, IsEnum, IsInt, IsOptional,
  IsArray, IsNumber, ValidateNested, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { TypeMission } from '@sigea/shared-types';

export class EscaleCapaciteDto {
  @IsString() base_id!: string;
  @IsInt() capacite_places!: number;
  @IsNumber() capacite_cargo_kg!: number;
}

export class CreateVolDto {
  @IsString() numero_mission!: string;
  @IsString() immatriculation!: string;
  @IsDateString() date_heure!: string;
  @IsString() base_depart_id!: string;
  @IsString() base_arrivee_id!: string;
  @IsEnum(TypeMission) type_mission!: TypeMission;
  @IsInt() capacite_places!: number;
  @IsNumber() capacite_cargo_kg!: number;

  // Commandant de bord
  @IsString() @MinLength(2) combord_grade!: string;
  @IsString() @MinLength(2) combord_nom!: string;
  @IsString() @MinLength(2) combord_prenom!: string;

  // Escales intermédiaires avec capacités propres
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscaleCapaciteDto)
  escales?: EscaleCapaciteDto[];
}