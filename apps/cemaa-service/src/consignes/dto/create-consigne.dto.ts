import { IsUUID, IsEnum, IsOptional, IsString, IsNumber, Min, MaxLength } from 'class-validator';
import { TypeConsigne, StatutConsigne } from '@sigea/shared-types';

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

export class ConfirmerConsigneDto {
  /** REALISEE, NON_REALISEE ou ANNULEE. EMISE est refusé : on ne revient pas en arrière. */
  @IsEnum(StatutConsigne) statut!: StatutConsigne;

  /**
   * Obligatoire si `statut` vaut NON_REALISEE — la règle dépend d'un autre
   * champ, elle est donc tenue par le service et non par un décorateur.
   *
   * Cette observation est reprise TELLE QUELLE dans le message d'erreur opposé
   * au commandant de base. Écrivez-la pour lui.
   */
  @IsOptional() @IsString() @MaxLength(500) observation?: string;
}