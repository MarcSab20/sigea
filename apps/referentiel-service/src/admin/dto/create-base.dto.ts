import { IsString, MinLength, IsOptional, Matches } from 'class-validator';

export class CreateBaseDto {
  @IsString() @MinLength(2) code_base!: string;

  // Numéro de la base (ex. "101"). Sert à composer les tampons de signature
  // ("COMGMO 102", "COMESCALE 201"). Optionnel : dérivé de code_base si absent.
  @IsOptional() @IsString() @Matches(/^\d{1,5}$/, { message: 'numero : chiffres uniquement' })
  numero?: string;

  @IsString() @MinLength(2) nom!: string;
  @IsString() @MinLength(2) region!: string;
}

export class UpdateBaseDto {
  @IsOptional() @IsString() code_base?: string;
  @IsOptional() @IsString() @Matches(/^\d{1,5}$/, { message: 'numero : chiffres uniquement' })
  numero?: string;
  @IsOptional() @IsString() nom?: string;
  @IsOptional() @IsString() region?: string;
}
