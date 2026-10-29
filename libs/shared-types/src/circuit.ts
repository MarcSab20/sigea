// libs/shared-types/src/circuit.ts
//
// Circuit du MANIFESTE.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI CHANGE
// ═══════════════════════════════════════════════════════════════════════════
// Le manifeste ne circule plus. C'est la LISTE HIÉRARCHISÉE qui circule, du
// secrétaire de l'Adjoint Air au commandant de base — voir circuit-liste.ts.
// Le manifeste en est l'EXTRAIT, émis à l'arrêté du COMBASE, et il ne porte
// qu'une signature : celle du commandant de bord, à la fin du document.
//
// ETAPE_SEQUENCE ne compte donc plus qu'une étape. Ce n'est pas une
// simplification de confort : tant que la séquence en comptait cinq, le PDF
// imprimait cinq blocs de signature, et la directive en exige un seul.
//
// Les valeurs CHEF_ESCALE / COMESO / COMGMO / COMBASE restent déclarées dans
// l'enum, et ETAPES_HISTORIQUES les recense : des manifestes signés sous
// l'ancien circuit les portent, et les écrans d'historique doivent savoir les
// afficher sans les confondre avec des étapes vivantes. `composerTampon()`
// lève si on tente d'en produire une nouvelle.

import { EtapeValidation, MentionSignature, RoleUtilisateur, AutoriteCentrale } from './enums';

// ─── Séquence ──────────────────────────────────────────────────────────────

/** Unique étape du circuit manifeste : le visa du commandant de bord. */
export const ETAPE_SEQUENCE: readonly EtapeValidation[] = [
  EtapeValidation.COMBORD,
] as const;

/** Blocs de signature imprimés sur le manifeste. Un seul, en pied de document. */
export const BLOCS_SIGNATURE: readonly EtapeValidation[] = ETAPE_SEQUENCE;

/**
 * Étapes plus jamais produites.
 *
 * Les quatre étapes de l'ancien circuit y entrent : leurs attributions sont
 * désormais exercées sur la LISTE, pas sur le manifeste.
 */
export const ETAPES_HISTORIQUES: readonly EtapeValidation[] = [
  EtapeValidation.CHEF_ESCALE,
  EtapeValidation.COMESO,
  EtapeValidation.COMGMO,
  EtapeValidation.COMBASE,
  EtapeValidation.CEMAA_SENSIBLE,
  EtapeValidation.MAGE_SENSIBLE,
] as const;

export function estEtapeHistorique(etape: EtapeValidation): boolean {
  return ETAPES_HISTORIQUES.includes(etape);
}

// ─── Consignes d'autorité centrale ─────────────────────────────────────────

/**
 * Étape que le manifeste ne peut franchir tant qu'une consigne d'autorité
 * reste non confirmée.
 *
 * Elle était portée par le COMBASE, qui ne signe plus le manifeste. Le verrou
 * passe au COMBORD, dernier et seul signataire — et c'est d'ailleurs plus juste :
 * il s'agit de constater ce qui est réellement à bord.
 */
export const ETAPE_BLOQUEE_PAR_CONSIGNE: EtapeValidation = EtapeValidation.COMBORD;

export const AUTORITE_TO_ROLE: Readonly<Record<AutoriteCentrale, RoleUtilisateur>> = {
  [AutoriteCentrale.CEMAA]: RoleUtilisateur.CEMAA,
  [AutoriteCentrale.MAGE]:  RoleUtilisateur.MAGE,
} as const;

export const ROLE_TO_AUTORITE: Readonly<Partial<Record<RoleUtilisateur, AutoriteCentrale>>> = {
  [RoleUtilisateur.CEMAA]: AutoriteCentrale.CEMAA,
  [RoleUtilisateur.MAGE]:  AutoriteCentrale.MAGE,
} as const;

// ─── Correspondance rôle ⇄ étape ───────────────────────────────────────────

/**
 * Seul le COMBORD figure ici, et c'est le mécanisme même de l'exclusion de tous
 * les autres : `ROLE_TO_ETAPE[role]` vaut `undefined`, et la machine à états
 * refuse la validation. Aucune règle supplémentaire à écrire.
 */
export const ROLE_TO_ETAPE: Readonly<Partial<Record<RoleUtilisateur, EtapeValidation>>> = {
  [RoleUtilisateur.COMBORD]: EtapeValidation.COMBORD,
} as const;

export const ETAPE_TO_ROLE: Readonly<Partial<Record<EtapeValidation, RoleUtilisateur>>> = {
  [EtapeValidation.COMBORD]: RoleUtilisateur.COMBORD,
} as const;

// ─── Tampon ────────────────────────────────────────────────────────────────

export const MENTION_TAMPON: Readonly<Record<EtapeValidation, MentionSignature>> = {
  [EtapeValidation.COMBORD]:        MentionSignature.VU,
  [EtapeValidation.CHEF_ESCALE]:    MentionSignature.VU,
  [EtapeValidation.COMESO]:         MentionSignature.VU,
  [EtapeValidation.COMGMO]:         MentionSignature.VU,
  [EtapeValidation.COMBASE]:        MentionSignature.ACCORD,
  [EtapeValidation.CEMAA_SENSIBLE]: MentionSignature.VU,
  [EtapeValidation.MAGE_SENSIBLE]:  MentionSignature.VU,
} as const;

export const LIBELLE_ETAPE: Readonly<Record<EtapeValidation, string>> = {
  [EtapeValidation.COMBORD]:        'Commandant de bord',
  [EtapeValidation.CHEF_ESCALE]:    "Chef d'escale (étape historique)",
  [EtapeValidation.COMESO]:         'COMESO (étape historique)',
  [EtapeValidation.COMGMO]:         'COMGMO (étape historique)',
  [EtapeValidation.COMBASE]:        'Commandant de base (étape historique)',
  [EtapeValidation.CEMAA_SENSIBLE]: 'CEMAA (étape historique)',
  [EtapeValidation.MAGE_SENSIBLE]:  'MAGE (étape historique)',
} as const;

export const MENTION_INTERIM = 'P/I';

export interface EmpreinteTampon {
  mention:          MentionSignature;
  tampon_ligne1:    string;
  tampon_ligne2?:   string;
  signataire_nom:   string;
  signataire_grade: string;
  par_interim:      boolean;
  titulaire_nom?:   string;
  titulaire_grade?: string;
}

export interface ContexteSignature {
  etape:             EtapeValidation;
  base_numero:       string;
  base_code:         string;
  signataire_nom:    string;
  signataire_prenom: string;
  signataire_grade:  string;
  immatriculation?:  string;
  par_interim?:      boolean;
  titulaire_nom?:    string;
  titulaire_grade?:  string;
}

/**
 * Compose le tampon du commandant de bord — le seul encore apposé.
 *
 * Le résultat est PERSISTÉ dans ValidationEtape, pas recalculé à l'impression :
 * un commandant de bord muté ne doit pas modifier rétroactivement le visa d'un
 * manifeste déjà clos.
 */
export function composerTampon(ctx: ContexteSignature): EmpreinteTampon {
  if (estEtapeHistorique(ctx.etape)) {
    throw new Error(
      `L'étape ${ctx.etape} n'est plus produite et n'appose aucun tampon. ` +
        'Les attributions correspondantes sont exercées sur la liste hiérarchisée.',
    );
  }
  if (ctx.par_interim && !ctx.titulaire_nom) {
    throw new Error('Tampon par intérim : nom du titulaire requis');
  }
  if (!ctx.immatriculation) {
    throw new Error('Tampon COMBORD : immatriculation requise');
  }

  return {
    mention:          MENTION_TAMPON[ctx.etape],
    tampon_ligne1:    `${ctx.signataire_grade} ${ctx.signataire_nom}`.trim(),
    tampon_ligne2:    ctx.immatriculation,
    signataire_nom:   ctx.signataire_nom,
    signataire_grade: ctx.signataire_grade,
    par_interim:      ctx.par_interim === true,
    titulaire_nom:    ctx.par_interim ? ctx.titulaire_nom   : undefined,
    titulaire_grade:  ctx.par_interim ? ctx.titulaire_grade : undefined,
  };
}

// ─── Progression ───────────────────────────────────────────────────────────

export function etapeSuivante(etape: EtapeValidation): EtapeValidation | null {
  const i = ETAPE_SEQUENCE.indexOf(etape);
  if (i === -1 || i === ETAPE_SEQUENCE.length - 1) return null;
  return ETAPE_SEQUENCE[i + 1];
}

export function rangEtape(etape: EtapeValidation): number {
  return ETAPE_SEQUENCE.indexOf(etape) + 1;
}

export function estEtapeFinale(etape: EtapeValidation): boolean {
  return etape === ETAPE_SEQUENCE[ETAPE_SEQUENCE.length - 1];
}