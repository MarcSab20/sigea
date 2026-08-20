import { IsUUID, IsOptional, IsString } from 'class-validator';

export class CreateManifesteDto {
  @IsUUID() vol_id!: string;

  /**
   * Étape de la route — IGNORÉE si elle est transmise.
   *
   * Le service la déduit de la position de la base du créateur sur la route du
   * vol ('A' au départ, 'B', 'C'… aux escales). La laisser déclarer par le
   * client permettrait à deux chefs d'escale de revendiquer la même étape, ou
   * d'en désigner une qui n'existe pas sur ce vol.
   *
   * Conservée dans le DTO pour ne pas rejeter les appels existants.
   */
  @IsOptional() @IsString() etape_vol?: string;

  @IsOptional() @IsUUID() manifeste_maitre_id?: string;
}
