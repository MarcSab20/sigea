import { IsString, IsEnum, MinLength, MaxLength, Matches, IsOptional, IsEmail } from 'class-validator';
import { RoleUtilisateur } from '@sigea/shared-types';

export class CreateUtilisateurDto {
  @IsString() @MinLength(2) nom!: string;
  @IsString() @MinLength(2) prenom!: string;
  @IsString() grade!: string;
  @IsString() @MinLength(3) @MaxLength(50) login!: string;
  @IsEnum(RoleUtilisateur) role!: RoleUtilisateur;
  @IsString() base_id!: string;
  @IsOptional() @IsEmail() email?: string;

  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{14,}$/, {
    message: 'Mot de passe : 14 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial',
  })
  password!: string;
}