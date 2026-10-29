// libs/shared-types/src/circuit-liste.ts
//
// Circuit de la liste hiérarchisée ET arithmétique d'occupation des tronçons.
//
// Ces deux sujets cohabitent ici parce qu'ils ne se séparent pas : chaque
// autorité du circuit discrimine SOUS CONTRAINTE de quota, et le quota ne se
// calcule pas sans la notion de tronçon.
//
// Aucune dépendance à Prisma ni à NestJS : le frontend importe le même fichier,
// ce qui interdit qu'un écran propose une sélection que le serveur refusera.

import {
  EtapeListe, MentionVisa, RoleUtilisateur, NatureLigne, Priorite,
  PRIORITES_ORDONNEES, OrigineEnregistrement,
} from './enums';

// ═══════════════════════════════════════════════════════════════════════════
// Séquence du circuit
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SEC_ADJ_AIR constitue → ADJ_AIR discrimine → COMRMIA discrimine et signe →
 * COMBASE discrimine, arrête, et le manifeste est émis → COMBORD discrimine
 * une dernière fois et vise.
 *
 * L'étape COMBORD figure dans CETTE séquence bien qu'elle porte sur le
 * manifeste : c'est la même progression, et la scinder obligerait à
 * synchroniser deux machines à états sur un même dossier.
 */
export const ETAPE_LISTE_SEQUENCE: readonly EtapeListe[] = [
  EtapeListe.SEC_ADJ_AIR,
  EtapeListe.ADJ_AIR,
  EtapeListe.COMRMIA,
  EtapeListe.COMBASE,
  EtapeListe.COMBORD,
] as const;

/** Étape à partir de laquelle le manifeste existe. */
export const ETAPE_EMISSION_MANIFESTE: EtapeListe = EtapeListe.COMBASE;

/**
 * Étape dont le franchissement est bloqué par une consigne d'autorité non
 * confirmée.
 *
 * Le COMBORD, parce qu'il s'agit de constater ce qui est RÉELLEMENT à bord.
 * Déplacer ce point ne demande que de changer cette constante : la machine à
 * états la lit, elle ne code aucune étape en dur.
 */
export const ETAPE_BLOQUEE_PAR_CONSIGNE: EtapeListe = EtapeListe.COMBORD;

export const ROLE_TO_ETAPE_LISTE: Readonly<Partial<Record<RoleUtilisateur, EtapeListe>>> = {
  [RoleUtilisateur.SEC_ADJ_AIR]: EtapeListe.SEC_ADJ_AIR,
  [RoleUtilisateur.ADJ_AIR]:     EtapeListe.ADJ_AIR,
  [RoleUtilisateur.COMRMIA]:     EtapeListe.COMRMIA,
  [RoleUtilisateur.COMBASE]:     EtapeListe.COMBASE,
  [RoleUtilisateur.COMBORD]:     EtapeListe.COMBORD,
} as const;

export const ETAPE_LISTE_TO_ROLE: Readonly<Record<EtapeListe, RoleUtilisateur>> = {
  [EtapeListe.SEC_ADJ_AIR]: RoleUtilisateur.SEC_ADJ_AIR,
  [EtapeListe.ADJ_AIR]:     RoleUtilisateur.ADJ_AIR,
  [EtapeListe.COMRMIA]:     RoleUtilisateur.COMRMIA,
  [EtapeListe.COMBASE]:     RoleUtilisateur.COMBASE,
  [EtapeListe.COMBORD]:     RoleUtilisateur.COMBORD,
} as const;

export const MENTION_PAR_ETAPE: Readonly<Record<EtapeListe, MentionVisa>> = {
  [EtapeListe.SEC_ADJ_AIR]: MentionVisa.VU,
  [EtapeListe.ADJ_AIR]:     MentionVisa.VU,
  [EtapeListe.COMRMIA]:     MentionVisa.SIGNATURE,
  [EtapeListe.COMBASE]:     MentionVisa.ACCORD,
  [EtapeListe.COMBORD]:     MentionVisa.VISA,
} as const;

export const LIBELLE_ETAPE_LISTE: Readonly<Record<EtapeListe, string>> = {
  [EtapeListe.SEC_ADJ_AIR]: "Secrétaire de l'Adjoint Air",
  [EtapeListe.ADJ_AIR]:     'Adjoint Air',
  [EtapeListe.COMRMIA]:     'Commandant de RMIA',
  [EtapeListe.COMBASE]:     'Commandant de base',
  [EtapeListe.COMBORD]:     'Commandant de bord',
} as const;

export const LIBELLE_MENTION: Readonly<Record<MentionVisa, string>> = {
  [MentionVisa.VU]:        'VU NUMÉRIQUE',
  [MentionVisa.SIGNATURE]: 'SIGNATURE NUMÉRIQUE',
  [MentionVisa.ACCORD]:    'ACCORD',
  [MentionVisa.VISA]:      'VISA',
} as const;

/**
 * Étapes autorisées à DISCRIMINER : retirer, réordonner, requalifier.
 *
 * Le SEC_ADJ_AIR n'y figure pas, et ce n'est pas un oubli : il CONSTITUE la
 * liste — il insère, ce qu'aucune autre étape ne peut faire — mais il ne
 * discrimine pas, puisque discriminer suppose un acte déjà posé.
 */
export const ETAPES_DISCRIMINANTES: readonly EtapeListe[] = [
  EtapeListe.ADJ_AIR,
  EtapeListe.COMRMIA,
  EtapeListe.COMBASE,
  EtapeListe.COMBORD,
] as const;

/** Étapes qui voient la liste d'attente. Le COMBORD ne la voit pas. */
export const ETAPES_VOYANT_LISTE_ATTENTE: readonly EtapeListe[] = [
  EtapeListe.SEC_ADJ_AIR,
  EtapeListe.ADJ_AIR,
  EtapeListe.COMRMIA,
  EtapeListe.COMBASE,
] as const;

export function voitListeAttente(etape: EtapeListe): boolean {
  return ETAPES_VOYANT_LISTE_ATTENTE.includes(etape);
}

export function peutDiscriminer(etape: EtapeListe): boolean {
  return ETAPES_DISCRIMINANTES.includes(etape);
}

export function etapeListeSuivante(etape: EtapeListe): EtapeListe | null {
  const i = ETAPE_LISTE_SEQUENCE.indexOf(etape);
  if (i === -1 || i === ETAPE_LISTE_SEQUENCE.length - 1) return null;
  return ETAPE_LISTE_SEQUENCE[i + 1];
}

export function etapeListePrecedente(etape: EtapeListe): EtapeListe | null {
  const i = ETAPE_LISTE_SEQUENCE.indexOf(etape);
  return i <= 0 ? null : ETAPE_LISTE_SEQUENCE[i - 1];
}

export function rangEtapeListe(etape: EtapeListe): number {
  return ETAPE_LISTE_SEQUENCE.indexOf(etape) + 1;
}

export function estEtapeListeFinale(etape: EtapeListe): boolean {
  return etape === ETAPE_LISTE_SEQUENCE[ETAPE_LISTE_SEQUENCE.length - 1];
}

/** Une ligne imposée par une autorité centrale échappe à la discrimination. */
export function estImposee(origine: OrigineEnregistrement): boolean {
  return origine !== OrigineEnregistrement.SAISIE;
}

// ═══════════════════════════════════════════════════════════════════════════
// Occupation des tronçons
// ═══════════════════════════════════════════════════════════════════════════

export interface LigneOccupante {
  nature:             NatureLigne;
  embarquement_ordre: number;
  /** Strictement supérieur à `embarquement_ordre`. */
  debarquement_ordre: number;
  masse_bagages_kg:   number;
}

export interface FretOccupant {
  retire:             boolean;
  embarquement_ordre: number;
  debarquement_ordre: number;
  poids_kg:           number;
}

export interface OccupationTroncon {
  /** Tronçon reliant le point `ordre` au point `ordre + 1`. */
  ordre:             number;
  places_occupees:   number;
  masse_occupee_kg:  number;
  capacite_places:   number;
  capacite_masse_kg: number;
  /** Négatif = sur-réservation. */
  places_restantes:  number;
  masse_restante_kg: number;
}

/**
 * Occupation de chaque tronçon, toutes listes confondues.
 *
 * ── Le point que l'ancien modèle ne pouvait pas traiter ──
 * Un voyageur inscrit à Yaoundé pour Garoua est à bord sur le tronçon
 * Yaoundé→Douala ET sur le tronçon Douala→Garoua. Il ne figure pourtant sur
 * AUCUNE liste de Douala. Compter les seules inscriptions de Douala conduit
 * donc à y embarquer des gens pour des sièges déjà occupés.
 *
 * D'où l'intervalle : une ligne occupe tous les tronçons k tels que
 * `embarquement_ordre <= k < debarquement_ordre`. C'est cette formule, et rien
 * d'autre, qui empêche le surplus décrit par la directive.
 *
 * Les lignes ATTENTE et RETIREE, et le fret retiré, ne comptent pas : ils ne
 * sont pas à bord.
 */
export function occupationTroncons(
  lignes: readonly LigneOccupante[],
  frets: readonly FretOccupant[],
  nbPoints: number,
  capacite: { places: number; masse_kg: number },
): OccupationTroncon[] {
  const troncons: OccupationTroncon[] = [];

  for (let k = 1; k < nbPoints; k++) {
    let places = 0;
    let masse  = 0;

    for (const l of lignes) {
      if (l.nature !== NatureLigne.HIERARCHISEE) continue;
      if (l.embarquement_ordre <= k && k < l.debarquement_ordre) {
        places += 1;
        masse  += Number(l.masse_bagages_kg) || 0;
      }
    }
    for (const f of frets) {
      if (f.retire) continue;
      if (f.embarquement_ordre <= k && k < f.debarquement_ordre) {
        masse += Number(f.poids_kg) || 0;
      }
    }

    troncons.push({
      ordre:             k,
      places_occupees:   places,
      masse_occupee_kg:  arrondir(masse),
      capacite_places:   capacite.places,
      capacite_masse_kg: capacite.masse_kg,
      places_restantes:  capacite.places - places,
      masse_restante_kg: arrondir(capacite.masse_kg - masse),
    });
  }

  return troncons;
}

export interface DisponibiliteEmbarquement {
  places:           number;
  masse_kg:         number;
  facteur_limitant: 'QUOTA' | 'AERONEF';
}

/**
 * Places et masse encore disponibles à l'embarquement au point `ordre`.
 *
 * Deux plafonds se superposent, et c'est le plus bas qui s'applique :
 *   • le QUOTA alloué par le SCOPS — une décision de commandement ;
 *   • la place PHYSIQUE restante sur le tronçon qui part de ce point, transit
 *     compris — une contrainte d'aéronef.
 *
 * Les confondre serait une faute : un quota de 20 places à Douala ne vaut rien
 * si 18 passagers de Yaoundé restent à bord pour Garoua.
 */
export function disponibiliteAuPoint(
  quota: { places: number; masse_kg: number },
  dejaInscrits: { places: number; masse_kg: number },
  troncon: OccupationTroncon | undefined,
): DisponibiliteEmbarquement {
  const resteQuota = {
    places:   quota.places   - dejaInscrits.places,
    masse_kg: quota.masse_kg - dejaInscrits.masse_kg,
  };
  if (!troncon) return { ...resteQuota, facteur_limitant: 'QUOTA' };

  const places = Math.min(resteQuota.places, troncon.places_restantes);
  const masse  = Math.min(resteQuota.masse_kg, troncon.masse_restante_kg);

  return {
    places,
    masse_kg: arrondir(masse),
    facteur_limitant:
      places < resteQuota.places || masse < resteQuota.masse_kg ? 'AERONEF' : 'QUOTA',
  };
}

/** Deux décimales : la masse est en kilogrammes, pas en micrgrammes. */
function arrondir(n: number): number {
  return Math.round(n * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════
// Présentation par priorité
// ═══════════════════════════════════════════════════════════════════════════

export interface TableauPriorite<T> {
  priorite: Priorite;
  libelle:  string;
  lignes:   T[];
}

/**
 * Répartit les lignes hiérarchisées en six tableaux, P1 à P6, chacun trié par
 * rang.
 *
 * La directive impose cette présentation. Le découpage est fait ici, en amont
 * de l'IHM et du PDF, pour que l'écran et le document imprimé présentent
 * rigoureusement le même ordre — une divergence entre les deux serait
 * indéfendable lors d'un contrôle.
 *
 * Les six tableaux sont TOUJOURS produits, même vides : un tableau absent se
 * lit comme un oubli, un tableau vide comme une absence de candidat.
 */
export function repartirParPriorite<T extends { priorite: Priorite; rang: number }>(
  lignes: readonly T[],
): TableauPriorite<T>[] {
  return PRIORITES_ORDONNEES.map((priorite) => ({
    priorite,
    libelle: `Priorité ${priorite.slice(1)}`,
    lignes: lignes.filter((l) => l.priorite === priorite).sort((a, b) => a.rang - b.rang),
  }));
}