// apps/vol-service/src/vols/dto/create-vol.dto.ts
import {
  IsString, IsDateString, IsEnum, IsInt, IsOptional, IsArray,
  IsNumber, ValidateNested, MinLength, Min, ArrayMaxSize, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TypeMission } from '@sigea/shared-types';

export class EscaleCapaciteDto {
  // NB : les identifiants de base sont des codes métier ("BA101"), pas des
  // UUID — le seed les impose comme clé primaire. Pas de @IsUUID() ici.
  @IsString() base_id!: string;
  @IsInt() @Min(0) capacite_places!: number;
  @IsNumber() @Min(0) capacite_cargo_kg!: number;
}

export class CreateVolDto {
  @IsString()
  @Matches(/^[A-Z0-9-]{3,20}$/, {
    message: 'numero_mission : majuscules, chiffres et tirets uniquement (3 à 20 caractères)',
  })
  numero_mission!: string;

  @IsString() immatriculation!: string;
  @IsDateString() date_heure!: string;

  /**
   * Base de départ — IGNORÉE si elle est transmise.
   *
   * Le service impose la base d'affectation du créateur (COMBASE ou COMGMO) :
   * un commandant de base ne planifie pas un vol au départ d'une autre base.
   * Le champ reste optionnel dans le DTO pour ne pas casser les appels
   * existants ni les tests end-to-end, mais sa valeur n'est jamais retenue.
   *
   * L'administrateur fait exception : lui seul peut désigner une base de
   * départ, précisément parce qu'il n'a pas de périmètre opérationnel propre.
   */
  @IsOptional() @IsString() base_depart_id?: string;

  @IsString() base_arrivee_id!: string;
  @IsEnum(TypeMission) type_mission!: TypeMission;
  @IsInt() @Min(0) capacite_places!: number;
  @IsNumber() @Min(0) capacite_cargo_kg!: number;

  // ── Commandant de bord : figé sur le vol, alimente le tampon COMBORD ──
  @IsString() @MinLength(2) combord_grade!: string;
  @IsString() @MinLength(2) combord_nom!: string;
  @IsString() @MinLength(2) combord_prenom!: string;

  // ── Escales intermédiaires, dans l'ordre de la route ──
  // L'ordre du tableau fait foi : il est matérialisé en EscaleVol.ordre.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => EscaleCapaciteDto)
  escales?: EscaleCapaciteDto[];
}