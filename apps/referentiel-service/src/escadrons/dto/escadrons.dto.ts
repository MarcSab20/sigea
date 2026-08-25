import {
  IsString, IsOptional, IsBoolean, MinLength, MaxLength, Matches,
} from 'class-validator';

export class CreateEscadronDto {
  /**
   * Numéro tel qu'il se dit : « 21 », « 22 », « 31 », « 13 »…
   *
   * Le suffixe ordinal (« ème ») n'est PAS stocké : il est ajouté à
   * l'affichage. Le stocker exposerait à « 21ème », « 21e », « 21 ème » pour
   * un même escadron, et rendrait tout regroupement statistique impossible.
   */
  @IsString()
  @Matches(/^\d{1,3}$/, { message: 'code : numéro d\'escadron, 1 à 3 chiffres (ex. 21, 31, 13)' })
  code!: string;

  @IsString() @MinLength(3) @MaxLength(120) nom!: string;

  /** Vocation : TRANSPORT, CHASSE, HELICOPTERE, ECOLE, MIXTE… */
  @IsOptional() @IsString() @MaxLength(40) type?: string;

  /** Identifiant OU code_base (« BA101 ») — les deux sont résolus. */
  @IsString() base_id!: string;
}

export class UpdateEscadronDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) nom?: string;
  @IsOptional() @IsString() @MaxLength(40) type?: string;
  @IsOptional() @IsBoolean() actif?: boolean;
  // `code` et `base_id` ne sont PAS modifiables : un escadron ne change ni de
  // numéro ni de base. Une réorganisation crée un nouvel escadron et désactive
  // l'ancien, ce qui préserve le rattachement historique des COMEA passés.
}