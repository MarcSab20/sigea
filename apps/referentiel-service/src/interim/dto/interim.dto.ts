import {
  IsString, IsUUID, IsEnum, IsOptional, IsDateString, MinLength, MaxLength,
} from 'class-validator';
import { RoleUtilisateur, TypeMouvement } from '@sigea/shared-types';

export class CreateInterimDto {
  /** Titulaire empêché dont les attributions sont déléguées. */
  @IsUUID() titulaire_id!: string;

  /** Suppléant qui exercera le rôle EN PLUS du sien. */
  @IsUUID() suppleant_id!: string;

  /**
   * Rôle délégué. Optionnel : par défaut, celui du titulaire.
   *
   * Le rendre explicite permet le cas — réel — d'une délégation partielle,
   * où l'on confie à un tiers les seules attributions de signature d'un poste
   * qui en cumule plusieurs.
   */
  @IsOptional() @IsEnum(RoleUtilisateur) role_delegue?: RoleUtilisateur;

  @IsOptional() @IsString() @MaxLength(300) motif?: string;

  /** Défaut : maintenant. */
  @IsOptional() @IsDateString() date_debut?: string;

  /** Absente = durée indéterminée, jusqu'à révocation explicite. */
  @IsOptional() @IsDateString() date_fin?: string;
}

export class RevoquerInterimDto {
  @IsString() @MinLength(3) @MaxLength(300) motif!: string;
}

export class CreateMouvementDto {
  @IsUUID() utilisateur_id!: string;
  @IsEnum(TypeMouvement) type!: TypeMouvement;

  /** Nouvelle base — identifiant OU code_base. Requis pour une MUTATION. */
  @IsOptional() @IsString() base_apres?: string;

  /** Nouveau rôle, si le mouvement s'accompagne d'un changement de fonction. */
  @IsOptional() @IsEnum(RoleUtilisateur) role_apres?: RoleUtilisateur;

  /** Nouvel escadron. Obligatoire si role_apres vaut comea. */
  @IsOptional() @IsUUID() escadron_apres?: string;

  /**
   * Successeur désigné sur le poste libéré.
   *
   * Purement documentaire ici : le transfert effectif des attributions se fait
   * en mettant à jour le compte du successeur (rôle, base, escadron), ce que
   * le service exécute dans la même transaction si ce champ est renseigné.
   */
  @IsOptional() @IsUUID() successeur_id?: string;

  @IsOptional() @IsDateString() date_effet?: string;
  @IsOptional() @IsString() @MaxLength(300) motif?: string;
  /** Référence de la décision (message, note de service, ordre de mutation). */
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}