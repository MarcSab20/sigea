// apps/manifeste-service/src/manifestes/dto/manifeste.dto.ts

import {
  IsString, IsEnum, IsArray, ValidateNested, MinLength, MaxLength,
  ArrayMinSize, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FonctionEquipage } from '@sigea/shared-types';

/**
 * Motif de retrait.
 *
 * Obligatoire, et pas seulement par formalisme : un retrait en bout de chaîne
 * défait une décision prise par trois autorités successives. Sans motif, cette
 * décision devient inexplicable dès le lendemain.
 */
export class RetraitDto {
  @IsString() @MinLength(3) @MaxLength(500) motif!: string;
}

export class MembreEquipageDto {
  @IsString() @MinLength(2) @MaxLength(60) nom!: string;
  @IsString() @MinLength(2) @MaxLength(60) prenom!: string;
  @IsString() @MinLength(1) @MaxLength(30) grade!: string;
  @IsEnum(FonctionEquipage) fonction!: FonctionEquipage;
}

export class EquipageDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MembreEquipageDto)
  membres!: MembreEquipageDto[];
}