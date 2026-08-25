import { EtapeValidation, MentionSignature, RoleUtilisateur, AutoriteCentrale } from './enums';

// ─── Ordre du circuit ──────────────────────────────────────────────────────

/**
 * Séquence du circuit, du dépôt à la signature finale.
 *
 * IDENTIQUE POUR TOUS LES VOLS, sensibles compris.
 *
 * ── Correction du lot 3 ──
 * J'avais intercalé CEMAA_SENSIBLE puis MAGE_SENSIBLE comme des étapes, pour
 * les manifestes sensibles. C'était faux. L'autorité qui émet une consigne ne
 * SIGNE pas le manifeste : elle CONFIRME que sa consigne a été exécutée. Ce
 * n'est pas un visa, c'est un accusé d'exécution — aucun tampon n'est apposé
 * à ce titre.
 *
 * Le contrôle correspondant vit donc sur la CONSIGNE (StatutConsigne) et non
 * dans cette séquence. Voir ETAPE_BLOQUEE_PAR_CONSIGNE ci-dessous.
 */
export const ETAPE_SEQUENCE: readonly EtapeValidation[] = [
  EtapeValidation.CHEF_ESCALE,
  EtapeValidation.COMESO,
  EtapeValidation.COMGMO,
  EtapeValidation.COMBASE,
  EtapeValidation.COMBORD,
] as const;

/** Les 5 blocs de signature imprimés sur le manifeste, dans l'ordre du document. */
export const BLOCS_SIGNATURE: readonly EtapeValidation[] = ETAPE_SEQUENCE;

// ─── Consignes d'autorité centrale ─────────────────────────────────────────

/**
 * Étape que le manifeste ne peut franchir tant qu'une consigne reste non
 * confirmée par son émetteur.
 *
 * ── Pourquoi le COMBASE ──
 * C'est lui qui donne l'ACCORD, seul acte de commandement du circuit. Une
 * consigne du CEMAA ou du MAGE non exécutée doit l'arrêter avant qu'il engage
 * son accord, pas après.
 *
 * ── Comment déplacer ce point ──
 * Une seule ligne. Si la vérification doit plutôt intervenir juste avant la
 * clôture par le commandant de bord — au motif qu'il s'agit de constater ce
 * qui est réellement à bord —, remplacez par COMBORD. Rien d'autre à changer :
 * la state machine lit cette constante, elle ne code aucune étape en dur.
 */
export const ETAPE_BLOQUEE_PAR_CONSIGNE: EtapeValidation = EtapeValidation.COMBASE;

export const AUTORITE_TO_ROLE: Readonly<Record<AutoriteCentrale, RoleUtilisateur>> = {
  [AutoriteCentrale.CEMAA]: RoleUtilisateur.CEMAA,
  [AutoriteCentrale.MAGE]:  RoleUtilisateur.MAGE,
} as const;

export const ROLE_TO_AUTORITE: Readonly<Partial<Record<RoleUtilisateur, AutoriteCentrale>>> = {
  [RoleUtilisateur.CEMAA]: AutoriteCentrale.CEMAA,
  [RoleUtilisateur.MAGE]:  AutoriteCentrale.MAGE,
} as const;

/**
 * Étapes historiques, plus jamais produites.
 *
 * Conservées parce que des lignes ValidationEtape existantes portent
 * CEMAA_SENSIBLE : les effacer détruirait la piste d'audit de manifestes déjà
 * signés. Cette liste sert aux écrans d'historique, qui doivent savoir les
 * afficher sans les confondre avec des étapes vivantes.
 */
export const ETAPES_HISTORIQUES: readonly EtapeValidation[] = [
  EtapeValidation.CEMAA_SENSIBLE,
  EtapeValidation.MAGE_SENSIBLE,
] as const;

export function estEtapeHistorique(etape: EtapeValidation): boolean {
  return ETAPES_HISTORIQUES.includes(etape);
}

// ─── Correspondance rôle ⇄ étape ───────────────────────────────────────────

/**
 * COMEA, CEMAA et MAGE sont ABSENTS de cette table, et c'est le mécanisme même
 * de leur exclusion du circuit : `ROLE_TO_ETAPE[role]` vaut undefined, et la
 * state machine refuse la validation. Aucune règle supplémentaire à écrire.
 *
 * Le COMEA planifie les vols. Le CEMAA et le MAGE émettent des consignes et en
 * confirment l'exécution. Aucun des trois n'appose de tampon.
 */
export const ROLE_TO_ETAPE: Readonly<Partial<Record<RoleUtilisateur, EtapeValidation>>> = {
  [RoleUtilisateur.CHEF_ESCALE]: EtapeValidation.CHEF_ESCALE,
  [RoleUtilisateur.COMESO]:      EtapeValidation.COMESO,
  [RoleUtilisateur.COMGMO]:      EtapeValidation.COMGMO,
  [RoleUtilisateur.COMBORD]:     EtapeValidation.COMBORD,
  [RoleUtilisateur.COMBASE]:     EtapeValidation.COMBASE,
} as const;

export const ETAPE_TO_ROLE: Readonly<Partial<Record<EtapeValidation, RoleUtilisateur>>> = {
  [EtapeValidation.CHEF_ESCALE]: RoleUtilisateur.CHEF_ESCALE,
  [EtapeValidation.COMESO]:      RoleUtilisateur.COMESO,
  [EtapeValidation.COMGMO]:      RoleUtilisateur.COMGMO,
  [EtapeValidation.COMBORD]:     RoleUtilisateur.COMBORD,
  [EtapeValidation.COMBASE]:     RoleUtilisateur.COMBASE,
} as const;

// ─── Composition des tampons ───────────────────────────────────────────────

export const TITRE_TAMPON: Readonly<Partial<Record<EtapeValidation, string>>> = {
  [EtapeValidation.CHEF_ESCALE]: 'COMESCALE',
  [EtapeValidation.COMESO]:      'COMESO',
  [EtapeValidation.COMGMO]:      'COMGMO',
} as const;

/** Mention portée par le tampon : ACCORD pour le COMBASE, VU pour les autres. */
export const MENTION_TAMPON: Readonly<Record<EtapeValidation, MentionSignature>> = {
  [EtapeValidation.CHEF_ESCALE]: MentionSignature.VU,
  [EtapeValidation.COMESO]:      MentionSignature.VU,
  [EtapeValidation.COMGMO]:      MentionSignature.VU,
  [EtapeValidation.COMBORD]:     MentionSignature.VU,
  [EtapeValidation.COMBASE]:     MentionSignature.ACCORD,
  // Historiques — jamais imprimées. Présentes parce que le Record est total.
  [EtapeValidation.CEMAA_SENSIBLE]: MentionSignature.VU,
  [EtapeValidation.MAGE_SENSIBLE]:  MentionSignature.VU,
} as const;

export const LIBELLE_ETAPE: Readonly<Record<EtapeValidation, string>> = {
  [EtapeValidation.CHEF_ESCALE]: "Chef d'escale",
  [EtapeValidation.COMESO]:      'COMESO',
  [EtapeValidation.COMGMO]:      'COMGMO',
  [EtapeValidation.COMBORD]:     'Commandant de bord',
  [EtapeValidation.COMBASE]:     'Commandant de base',
  [EtapeValidation.CEMAA_SENSIBLE]: 'CEMAA (étape historique)',
  [EtapeValidation.MAGE_SENSIBLE]:  'MAGE (étape historique)',
} as const;

/** Mention imprimée sur le tampon lorsqu'il est apposé par un suppléant. */
export const MENTION_INTERIM = 'P/I';

// ─── Contenu d'un tampon, figé à la signature ──────────────────────────────

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
 * Compose le contenu du tampon à apposer.
 *
 * Le résultat est destiné à être PERSISTÉ dans ValidationEtape, pas recalculé
 * à l'impression : un COMGMO muté ne doit pas modifier rétroactivement le
 * tampon d'un manifeste déjà signé.
 *
 * Les étapes historiques ne passent JAMAIS par ici — le garde en tête
 * transforme un appel erroné en erreur immédiate, plutôt qu'en tampon fantôme
 * sur un document officiel.
 */
export function composerTampon(ctx: ContexteSignature): EmpreinteTampon {
  if (estEtapeHistorique(ctx.etape)) {
    throw new Error(
      `L'étape ${ctx.etape} n'est plus produite et n'appose aucun tampon`,
    );
  }
  if (ctx.par_interim && !ctx.titulaire_nom) {
    throw new Error('Tampon par intérim : nom du titulaire requis');
  }

  const base = {
    mention:          MENTION_TAMPON[ctx.etape],
    signataire_nom:   ctx.signataire_nom,
    signataire_grade: ctx.signataire_grade,
    par_interim:      ctx.par_interim === true,
    titulaire_nom:    ctx.par_interim ? ctx.titulaire_nom   : undefined,
    titulaire_grade:  ctx.par_interim ? ctx.titulaire_grade : undefined,
  };

  switch (ctx.etape) {
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

    case EtapeValidation.COMBASE:
      return {
        ...base,
        tampon_ligne1: `${ctx.signataire_grade} ${ctx.signataire_nom}`.trim(),
        tampon_ligne2: ctx.base_code,
      };

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

/**
 * Étape suivante, ou null si `etape` clôt le circuit.
 *
 * Plus aucune condition sur `flag_sensible` : la progression est la même pour
 * tous les vols. C'est le blocage par consigne non confirmée, et lui seul, qui
 * distingue le cas particulier — et il ne modifie pas la séquence, il l'arrête.
 */
export function etapeSuivante(etape: EtapeValidation): EtapeValidation | null {
  const i = ETAPE_SEQUENCE.indexOf(etape);
  if (i === -1 || i === ETAPE_SEQUENCE.length - 1) return null;
  return ETAPE_SEQUENCE[i + 1];
}

/**
 * @deprecated Alias de `etapeSuivante`. Le paramètre `sensible` est ignoré.
 *
 * Conservé pour ne pas casser les appelants issus du lot 3, où les verrous
 * d'autorité étaient — à tort — insérés dans la séquence.
 */
export function prochaineEtapeCircuit(
  etape: EtapeValidation,
  _sensible?: boolean,
): EtapeValidation | null {
  return etapeSuivante(etape);
}

/** Rang 1..n d'une étape dans la séquence ; 0 hors séquence. */
export function rangEtape(etape: EtapeValidation): number {
  return ETAPE_SEQUENCE.indexOf(etape) + 1;
}

/** Vrai si `etape` clôt le circuit. */
export function estEtapeFinale(etape: EtapeValidation): boolean {
  return etape === ETAPE_SEQUENCE[ETAPE_SEQUENCE.length - 1];
}