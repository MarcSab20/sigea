import { IsString, IsEnum, MinLength, Matches, IsOptional, IsEmail, IsBoolean } from 'class-validator';
import { RoleUtilisateur } from '@sigea/shared-types';

export class UpdateUtilisateurDto {
  @IsOptional() @IsString() @MinLength(2) nom?: string;
  @IsOptional() @IsString() @MinLength(2) prenom?: string;
  @IsOptional() @IsString() grade?: string;
  @IsOptional() @IsString() login?: string;
  @IsOptional() @IsEnum(RoleUtilisateur) role?: RoleUtilisateur;
  @IsOptional() @IsString() base_id?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() actif?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{14,}$/, {
    message: 'Mot de passe : 14 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial',
  })
  password?: string;
}