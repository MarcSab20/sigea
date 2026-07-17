import { EtapeValidation, MentionSignature, RoleUtilisateur } from './enums';

// ─── Ordre du circuit ──────────────────────────────────────────────────────

/**
 * Séquence ordonnée du circuit, du dépôt à la signature finale.
 *
 * CEMAA_SENSIBLE est VOLONTAIREMENT absente : ce n'est pas une étape de la
 * séquence mais un verrou conditionnel, qui ne s'applique qu'aux manifestes
 * `flag_sensible` et qui bloque l'accès à l'étape COMBASE. La traiter comme
 * une étape ordinaire imposerait un passage CEMAA à tous les vols.
 */
export const ETAPE_SEQUENCE: readonly EtapeValidation[] = [
  EtapeValidation.CHEF_ESCALE,
  EtapeValidation.COMESO,
  EtapeValidation.COMGMO,
  EtapeValidation.COMBORD,
  EtapeValidation.COMBASE,
] as const;

/** Les 5 blocs de signature imprimés sur le manifeste, dans l'ordre du document. */
export const BLOCS_SIGNATURE: readonly EtapeValidation[] = ETAPE_SEQUENCE;

// ─── Correspondance rôle ⇄ étape ───────────────────────────────────────────

export const ROLE_TO_ETAPE: Readonly<Partial<Record<RoleUtilisateur, EtapeValidation>>> = {
  [RoleUtilisateur.CHEF_ESCALE]: EtapeValidation.CHEF_ESCALE,
  [RoleUtilisateur.COMESO]:      EtapeValidation.COMESO,
  [RoleUtilisateur.COMGMO]:      EtapeValidation.COMGMO,
  [RoleUtilisateur.COMBORD]:     EtapeValidation.COMBORD,
  [RoleUtilisateur.COMBASE]:     EtapeValidation.COMBASE,
  [RoleUtilisateur.CEMAA]:       EtapeValidation.CEMAA_SENSIBLE,
} as const;

export const ETAPE_TO_ROLE: Readonly<Partial<Record<EtapeValidation, RoleUtilisateur>>> = {
  [EtapeValidation.CHEF_ESCALE]:    RoleUtilisateur.CHEF_ESCALE,
  [EtapeValidation.COMESO]:         RoleUtilisateur.COMESO,
  [EtapeValidation.COMGMO]:         RoleUtilisateur.COMGMO,
  [EtapeValidation.COMBORD]:        RoleUtilisateur.COMBORD,
  [EtapeValidation.COMBASE]:        RoleUtilisateur.COMBASE,
  [EtapeValidation.CEMAA_SENSIBLE]: RoleUtilisateur.CEMAA,
} as const;

// ─── Composition des tampons ───────────────────────────────────────────────

/**
 * Titre imprimé sous la mention, pour les étapes dont le tampon porte
 * « TITRE + numéro de base » (ex. « COMESCALE 201 », « COMGMO 102 »).
 *
 * Absent pour COMBORD (nom + immatriculation) et COMBASE (nom + code base),
 * dont le tampon ne suit pas cette forme.
 */
export const TITRE_TAMPON: Readonly<Partial<Record<EtapeValidation, string>>> = {
  [EtapeValidation.CHEF_ESCALE]: 'COMESCALE',
  [EtapeValidation.COMESO]:      'COMESO',
  [EtapeValidation.COMGMO]:      'COMGMO',
} as const;

/** Mention portée par le tampon : ACCORD pour le COMBASE, VU pour les autres. */
export const MENTION_TAMPON: Readonly<Record<EtapeValidation, MentionSignature>> = {
  [EtapeValidation.CHEF_ESCALE]:    MentionSignature.VU,
  [EtapeValidation.COMESO]:         MentionSignature.VU,
  [EtapeValidation.COMGMO]:         MentionSignature.VU,
  [EtapeValidation.COMBORD]:        MentionSignature.VU,
  [EtapeValidation.CEMAA_SENSIBLE]: MentionSignature.VU,
  [EtapeValidation.COMBASE]:        MentionSignature.ACCORD,
} as const;

/** Libellé lisible d'une étape, pour l'IHM et les notifications. */
export const LIBELLE_ETAPE: Readonly<Record<EtapeValidation, string>> = {
  [EtapeValidation.CHEF_ESCALE]:    "Chef d'escale",
  [EtapeValidation.COMESO]:         'COMESO',
  [EtapeValidation.COMGMO]:         'COMGMO',
  [EtapeValidation.COMBORD]:        'Commandant de bord',
  [EtapeValidation.CEMAA_SENSIBLE]: 'CEMAA (vol sensible)',
  [EtapeValidation.COMBASE]:        'Commandant de base',
} as const;

// ─── Contenu d'un tampon, figé à la signature ──────────────────────────────

export interface EmpreinteTampon {
  mention:          MentionSignature;
  /** Ligne 1 : « COMGMO 102 », ou le nom du COMBORD, ou le nom du COMBASE. */
  tampon_ligne1:    string;
  /** Ligne 2 : immatriculation (COMBORD) ou code base (COMBASE). Sinon absente. */
  tampon_ligne2?:   string;
  signataire_nom:   string;
  signataire_grade: string;
}

export interface ContexteSignature {
  etape:            EtapeValidation;
  /** Numéro seul de la base du signataire, ex. « 102 ». */
  base_numero:      string;
  /** Code complet de la base, ex. « BA101 ». */
  base_code:        string;
  signataire_nom:   string;
  signataire_prenom: string;
  signataire_grade: string;
  /** Immatriculation de l'aéronef — requise pour le tampon COMBORD uniquement. */
  immatriculation?: string;
}

/**
 * Compose le contenu du tampon à apposer.
 *
 * Le résultat est destiné à être PERSISTÉ dans ValidationEtape, pas recalculé
 * à l'impression : un COMGMO muté ne doit pas modifier rétroactivement le
 * tampon d'un manifeste déjà signé.
 */
export function composerTampon(ctx: ContexteSignature): EmpreinteTampon {
  const base = {
    mention:          MENTION_TAMPON[ctx.etape],
    signataire_nom:   ctx.signataire_nom,
    signataire_grade: ctx.signataire_grade,
  };

  switch (ctx.etape) {
    // « VU / <NOM DU COMBORD> / <IMMATRICULATION> »
    case EtapeValidation.COMBORD: {
      if (!ctx.immatriculation) {
        throw new Error('Tampon COMBORD : immatriculation requise');
      }
      return {
        ...base,
        tampon_ligne1: `${ctx.signataire_grade} ${ctx.signataire_nom}`.trim(),
        tampon_ligne2: ctx.immatriculation,
      };
    }

    // « ACCORD / <NOM DU COMBASE> / <CODE BASE> »
    case EtapeValidation.COMBASE:
      return {
        ...base,
        tampon_ligne1: `${ctx.signataire_grade} ${ctx.signataire_nom}`.trim(),
        tampon_ligne2: ctx.base_code,
      };

    // « VU / <TITRE> <NUMÉRO DE BASE> »
    default: {
      const titre = TITRE_TAMPON[ctx.etape];
      if (!titre) {
        throw new Error(`Aucun titre de tampon défini pour l'étape ${ctx.etape}`);
      }
      return { ...base, tampon_ligne1: `${titre} ${ctx.base_numero}` };
    }
  }
}

// ─── Progression dans le circuit ───────────────────────────────────────────

/** Étape suivante après `etape`, ou null si `etape` clôt le circuit. */
export function etapeSuivante(etape: EtapeValidation): EtapeValidation | null {
  const i = ETAPE_SEQUENCE.indexOf(etape);
  if (i === -1 || i === ETAPE_SEQUENCE.length - 1) return null;
  return ETAPE_SEQUENCE[i + 1];
}

/** Rang 1..n d'une étape dans le circuit ; 0 si hors séquence (CEMAA_SENSIBLE). */
export function rangEtape(etape: EtapeValidation): number {
  return ETAPE_SEQUENCE.indexOf(etape) + 1;
}

/** Vrai si `etape` clôt le circuit. */
export function estEtapeFinale(etape: EtapeValidation): boolean {
  return etape === ETAPE_SEQUENCE[ETAPE_SEQUENCE.length - 1];
}