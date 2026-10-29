// apps/vol-service/src/vols/dto/create-vol.dto.ts
//
// Évolution par rapport au lot 1 : `combord_id` devient OBLIGATOIRE.
//
// Sans compte rattaché, personne ne peut apposer le visa final et le dossier
// s'arrête définitivement à l'arrêté du commandant de base. Un avertissement au
// log ne suffisait pas : il laissait créer des vols structurellement incapables
// d'aboutir, et le défaut n'apparaissait qu'au dernier moment, devant l'appareil.

import {
  IsString, IsDateString, IsEnum, IsInt, IsOptional, IsArray,
  IsNumber, ValidateNested, MinLength, Min, ArrayMinSize, ArrayMaxSize, Matches, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TypeMission } from '@sigea/shared-types';

/**
 * Point de l'itinéraire APRÈS le départ.
 * Le point de départ n'est pas listé : il est imposé par le serveur.
 * Le dernier élément du tableau est la destination finale.
 */
export class PointItineraireDto {
  @IsString() @MinLength(1)
  base_id!: string;

  @IsOptional() @IsDateString() heure_arrivee?: string;
  @IsOptional() @IsDateString() heure_depart?:  string;
}

export class CreateVolDto {
  @IsString()
  @Matches(/^[A-Z0-9-]{3,20}$/, {
    message: 'numero_mission : majuscules, chiffres et tirets uniquement (3 à 20 caractères)',
  })
  numero_mission!: string;

  @IsString() immatriculation!: string;
  @IsDateString() date_heure!: string;

  @IsEnum(TypeMission) type_mission!: TypeMission;

  /** Plafond absolu que le SCOPS ne pourra pas dépasser en allouant. */
  @IsInt() @Min(1) capacite_places!: number;
  @IsNumber() @Min(0) capacite_cargo_kg!: number;

  // ── Commandant de bord ──
  /**
   * Compte SIGEA du commandant de bord. OBLIGATOIRE.
   * Le service vérifie en outre que ce compte porte bien le rôle `combord` et
   * qu'il est actif : un identifiant valide mais rattaché à un autre rôle
   * produirait le même blocage, plus tard et plus difficile à diagnostiquer.
   */
  @IsUUID() combord_id!: string;

  @IsString() @MinLength(2) combord_grade!: string;
  @IsString() @MinLength(2) combord_nom!: string;
  @IsString() @MinLength(2) combord_prenom!: string;

  /** Obligatoire côté service lorsque le créateur est COMEA. */
  @IsOptional() @IsUUID() escadron_id?: string;

  /**
   * Itinéraire, départ exclu, dans l'ordre de la route.
   *
   * Exemple de la directive — un COMBASE de Yaoundé déclarant
   * Yaoundé → Douala → Garoua → Douala → Yaoundé transmet :
   *   [ Douala, Garoua, Douala, Yaoundé ]
   * Les répétitions sont ADMISES : c'est le cas nominal de l'aller-retour.
   */
  @IsArray()
  @ArrayMinSize(1, { message: "L'itinéraire doit comporter au moins une destination" })
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PointItineraireDto)
  itineraire!: PointItineraireDto[];
}