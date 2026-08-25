import {
  IsString, IsEnum, MinLength, MaxLength, Matches, IsOptional, IsEmail, IsUUID,
} from 'class-validator';
import { RoleUtilisateur } from '@sigea/shared-types';

export class CreateUtilisateurDto {
  @IsString() @MinLength(2) nom!: string;
  @IsString() @MinLength(2) prenom!: string;
  @IsString() grade!: string;
  @IsString() @MinLength(3) @MaxLength(50) login!: string;
  @IsEnum(RoleUtilisateur) role!: RoleUtilisateur;

  /** Identifiant OU code_base (« BA101 »). */
  @IsString() base_id!: string;

  /**
   * Escadron de rattachement.
   *
   * OBLIGATOIRE pour le rôle comea, INTERDIT pour tous les autres. La règle
   * n'est pas exprimable en décorateur class-validator seul (elle dépend d'un
   * autre champ) : elle est tenue par AdminService, doublée d'une contrainte
   * CHECK en base. Ici, on se contente de valider la forme.
   *
   * L'IHM ne propose que les escadrons de la base choisie
   * (GET /api/referentiel/escadrons?base_id=…&actif=1) ; le service revérifie
   * ce rattachement, un formulaire n'étant jamais une garantie.
   */
  @IsOptional() @IsUUID() escadron_id?: string;

  @IsOptional() @IsEmail() email?: string;

  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{14,}$/, {
    message: 'Mot de passe : 14 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial',
  })
  password!: string;
}