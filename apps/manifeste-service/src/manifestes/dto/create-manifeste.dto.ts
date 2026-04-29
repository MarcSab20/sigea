import { IsUUID, IsOptional, IsString } from 'class-validator';

export class CreateManifesteDto {
  @IsUUID() vol_id!: string;
  @IsOptional() @IsString() etape_vol?: string;
  @IsOptional() @IsUUID() manifeste_maitre_id?: string;
}
