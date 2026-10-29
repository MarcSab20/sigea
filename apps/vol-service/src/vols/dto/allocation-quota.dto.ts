// apps/vol-service/src/vols/dto/allocation-quota.dto.ts

import {
  IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min,
  ValidateNested, ArrayMinSize, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuotaPointDto {
  /** Identifiant du point d'itinéraire (EtapeItineraire.id). */
  @IsUUID() etape_id!: string;

  @IsInt() @Min(0) quota_places!: number;
  @IsNumber() @Min(0) quota_masse_kg!: number;
}

/**
 * Allocation initiale du SCOPS : elle couvre TOUS les points d'embarquement
 * d'un coup.
 *
 * Volontairement tout-ou-rien. Une allocation partielle laisserait des RMIA
 * notifiées d'un vol sur lequel elles n'ont encore aucun quota, donc aucune
 * liste à constituer — et des officiers qui ouvrent un écran vide finissent par
 * ne plus l'ouvrir du tout.
 */
export class AllocationQuotaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuotaPointDto)
  quotas!: QuotaPointDto[];

  @IsOptional() @IsString() @MaxLength(500)
  observation?: string;
}

/** Réajustement d'un point déjà alloué, après diffusion. */
export class AjustementQuotaDto {
  @IsInt() @Min(0) quota_places!: number;
  @IsNumber() @Min(0) quota_masse_kg!: number;

  @IsString() @MaxLength(500)
  motif!: string;
}