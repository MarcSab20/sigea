import {
  IsString, IsEnum, MinLength, Matches, IsOptional, IsEmail, IsBoolean, IsUUID,
} from 'class-validator';
import { RoleUtilisateur } from '@sigea/shared-types';

export class UpdateUtilisateurDto {
  @IsOptional() @IsString() @MinLength(2) nom?: string;
  @IsOptional() @IsString() @MinLength(2) prenom?: string;
  @IsOptional() @IsString() grade?: string;
  @IsOptional() @IsEnum(RoleUtilisateur) role?: RoleUtilisateur;
  @IsOptional() @IsString() base_id?: string;

  /**
   * Rattachement d'escadron.
   *
   * `null` explicite = détacher. Distinct de l'absence du champ, qui signifie
   * « ne pas toucher ». Cette distinction compte : elle permet de retirer un
   * escadron sans en imposer un autre.
   */
  @IsOptional() @IsUUID() escadron_id?: string | null;

  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() actif?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{14,}$/, {
    message: 'Mot de passe : 14 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial',
  })
  password?: string;
}