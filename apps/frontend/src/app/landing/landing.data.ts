// apps/frontend/src/app/landing/landing.data.ts
//
// Contenu éditorial de la vitrine publique. Ce fichier ne fait AUCUN appel
// réseau et n'interroge pas le référentiel : la page doit s'afficher même
// passerelle éteinte. Modifier le texte ici ne demande de toucher à aucun
// composant.

/* ═══════════════════════════════════════════════════════════════════════════
   ①  VOS IMAGES — L'UNIQUE ENDROIT À MODIFIER
   ───────────────────────────────────────────────────────────────────────────
   Déposez vos fichiers dans  apps/frontend/public/medias/  puis ajustez les
   chemins ci-dessous. Vite sert `public/` à la racine : un fichier placé en
   `public/medias/flotte/transport.jpg` s'adresse par `/medias/transport.jpg`.

   Chaque emplacement possède un repli vectoriel : tant que le fichier est
   absent, une silhouette sobre s'affiche. Aucun cadre cassé, jamais.

   Recommandations : JPEG progressif ou WebP, qualité 78–85, largeur max
   1 800 px pour les vignettes de flotte, 2 400 px pour le fond de héros.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Visuel {
  /** Chemin servi. `null` = emplacement volontairement vide (repli affiché). */
  src: string | null;
  /** Texte alternatif — obligatoire, il est lu par les lecteurs d'écran. */
  alt: string;
}

export const VISUELS = {
  /** Fond du héros. Fortement assombri par-dessus : une image sombre et peu
   *  contrastée fonctionne mieux qu'une image lumineuse.
   *  Format conseillé : 2400 × 1400 px, paysage. */
  hero: {
    src: '/medias/hero.jpg',
    alt: "Aéronef en préparation sur une aire de stationnement, de nuit",
  } as Visuel,

  /** Insigne / logo affiché dans l'en-tête et le pied de page.
   *  Format conseillé : SVG, ou PNG 256 × 256 px à fond transparent.
   *  Laisser `null` conserve le monogramme vectoriel généré. */
  insigne: {
    src: null,
    alt: 'Insigne des Forces Aériennes Camerounaises',
  } as Visuel,

  /** Illustration de la section « Preuve ». Photographie d'un poste
   *  d'exploitation, d'une salle d'opérations ou d'un document tamponné.
   *  Format conseillé : 1600 × 1200 px. */
  preuve: {
    src: '/medias/salle-operations.jpg',
    alt: "Poste d'exploitation en salle d'opérations",
  } as Visuel,
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   ②  FLOTTE PRÉSENTÉE
   Liste purement éditoriale : elle n'interroge pas le référentiel aéronefs.
   Renommez, ajoutez ou retirez librement des entrées.
   Chaque `visuel.src` pointe vers public/medias/flotte/.
   Format conseillé : 1600 × 1200 px (4/3), paysage.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Appareil {
  nom: string;
  role: string;
  note: string;
  visuel: Visuel;
}

export const FLOTTE: Appareil[] = [
  {
    nom: 'Transport tactique',
    role: 'Projection',
    note: "Acheminement de troupes et de fret sur terrains sommaires. Les capacités en places et en soute bornent la saisie du manifeste.",
    visuel: { src: '/medias/flotte/transport.jpg', alt: 'Aéronef de transport tactique' },
  },
  {
    nom: 'Voilure tournante',
    role: 'Liaison · EVASAN',
    note: "Évacuation sanitaire et liaison entre emprises isolées. Les vols EVASAN suivent un circuit de visa raccourci.",
    visuel: { src: '/medias/flotte/helicoptere.jpg', alt: 'Hélicoptère de liaison' },
  },
  {
    nom: 'Appui aérien',
    role: 'Opérations',
    note: "Missions d'appui au profit des forces engagées. Les vols classés sensibles franchissent un verrou CEMAA supplémentaire.",
    visuel: { src: '/medias/flotte/appui.jpg', alt: "Aéronef d'appui aérien" },
  },
  {
    nom: 'Aviation légère',
    role: 'Instruction',
    note: "Formation des équipages et liaisons de commandement. Les vols d'instruction restent tracés au même titre que les autres.",
    visuel: { src: '/medias/flotte/liaison.jpg', alt: 'Aéronef léger de liaison' },
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   ③  BASES AÉRIENNES
   Coordonnées des villes, reprises de CameroonMap.tsx pour rester cohérent
   avec l'IHM interne. Vocation illustrative — voir la mention légale affichée
   sous la carte.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Base {
  code: string; nom: string; ville: string;
  lat: number; lng: number; region: string;
}

export const BASES: Base[] = [
  { code: 'BA101', nom: 'Base Aérienne 101', ville: 'Yaoundé',    lat: 3.8480,  lng: 11.5021, region: 'Centre' },
  { code: 'BA102', nom: 'Base Aérienne 102', ville: 'Bertoua',    lat: 4.5772,  lng: 13.6846, region: 'Est' },
  { code: 'BA201', nom: 'Base Aérienne 201', ville: 'Douala',     lat: 4.0061,  lng: 9.7069,  region: 'Littoral' },
  { code: 'BA301', nom: 'Base Aérienne 301', ville: 'Garoua',     lat: 9.3347,  lng: 13.3781, region: 'Nord' },
  { code: 'BA302', nom: 'Base Aérienne 302', ville: 'Ngaoundéré', lat: 7.3570,  lng: 13.5720, region: 'Adamaoua' },
  { code: 'BA401', nom: 'Base Aérienne 401', ville: 'Maroua',     lat: 10.5957, lng: 14.3273, region: 'Extrême-Nord' },
  { code: 'BA501', nom: 'Base Aérienne 501', ville: 'Bamenda',    lat: 5.9597,  lng: 10.1494, region: 'Nord-Ouest' },
];

/**
 * Contour approximatif du Cameroun, en degrés (lat, lng), sens horaire depuis
 * la pointe nord (lac Tchad).
 *
 * ⚠ Tracé SCHÉMATIQUE, saisi à la main pour l'illustration. Il n'a aucune
 * valeur cartographique et ne constitue pas une représentation officielle des
 * frontières. Il est projeté avec la même fonction que les positions de bases,
 * ce qui garantit au moins la cohérence interne du dessin.
 */
export const CONTOUR_CM: [number, number][] = [
  [13.08, 14.55], [12.62, 14.64], [12.15, 15.00], [11.60, 15.06], [11.02, 15.10],
  [10.50, 15.26], [10.00, 15.16], [9.55, 15.05],  [8.90, 15.32],  [8.55, 15.62],
  [7.80, 15.50],  [7.30, 15.20],  [6.80, 14.60],  [6.38, 14.60],  [6.00, 15.02],
  [5.58, 15.52],  [5.18, 16.19],  [4.60, 15.12],  [4.20, 15.00],  [3.60, 14.50],
  [2.90, 14.60],  [2.20, 14.55],  [2.20, 13.30],  [2.20, 11.75],  [2.20, 10.40],
  [2.35, 9.90],   [2.95, 9.80],   [3.55, 9.65],   [3.90, 9.55],   [4.05, 9.10],
  [4.40, 8.90],   [4.55, 8.50],   [5.30, 8.85],   [6.00, 9.30],   [6.60, 9.80],
  [7.10, 10.15],  [7.60, 10.60],  [8.20, 11.30],  [9.00, 12.20],  [9.60, 12.80],
  [10.10, 13.20], [10.60, 13.35], [11.10, 13.70], [11.60, 13.60], [12.10, 14.20],
  [12.60, 14.30],
];

export const CADRE = { latMin: 1.9, latMax: 13.35, lngMin: 8.15, lngMax: 16.55, w: 382, h: 520 };

export function projeter(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng - CADRE.lngMin) / (CADRE.lngMax - CADRE.lngMin)) * CADRE.w,
    y: ((CADRE.latMax - lat) / (CADRE.latMax - CADRE.latMin)) * CADRE.h,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ④  CIRCUIT DE VISA — le rack de strips
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Etape {
  rang: number;
  role: string;
  statut: string;
  titre: string;
  texte: string;
  garde: string;
}

export const CIRCUIT: Etape[] = [
  {
    rang: 1, role: "Chef d'escale", statut: 'VU',
    titre: "Le manifeste est établi",
    texte: "Passagers, matériels, équipage et marchandises dangereuses sont saisis une seule fois. Les totaux sont contrôlés à la saisie contre les capacités réelles de l'aéronef ; un dépassement bloque la soumission plutôt que de la signaler après coup.",
    garde: "La soumission vaut visa : elle est horodatée et le contenu est figé.",
  },
  {
    rang: 2, role: 'COMESO', statut: 'VU',
    titre: "L'escale contrôle la conformité",
    texte: "Le commandement de l'escale vérifie la cohérence du document avec la réalité du terrain — créneaux, moyens de piste, conditions d'accueil — puis appose son visa.",
    garde: "Un rejet renvoie le manifeste au chef d'escale, motif obligatoire.",
  },
  {
    rang: 3, role: 'COMGMO', statut: 'VU',
    titre: "Les moyens engagés sont vérifiés",
    texte: "Le groupement de maintenance opérationnelle confronte le manifeste à l'aéronef réellement affecté et à son état de disponibilité.",
    garde: "Un changement d'aéronef après ce visa rouvre le circuit à cette étape.",
  },
  {
    rang: 4, role: 'COMBASE', statut: 'ACCORD',
    titre: "La base donne son accord",
    texte: "Le commandant de base statue au titre du commandement. Pour un vol classé sensible, un verrou CEMAA s'interpose avant cet accord et ne peut être franchi par personne d'autre.",
    garde: "Le commandant de base accorde, mais ne planifie pas — les deux prérogatives sont distinctes.",
  },
  {
    rang: 5, role: 'Commandant de bord', statut: 'CLOS',
    titre: "Le bord clôt le circuit",
    texte: "Dernier visa avant vol. À sa pose, le manifeste devient définitif : le tirage papier porte alors un code de contrôle dont la lecture atteste que le document présenté correspond bien à cet état signé.",
    garde: "Après clôture, toute modification crée une nouvelle version, jamais une réécriture.",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   ⑤  CAPACITÉS
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Capacite { cle: string; titre: string; texte: string; }

export const CAPACITES: Capacite[] = [
  {
    cle: 'manifeste',
    titre: 'Manifeste dématérialisé',
    texte: "Une saisie unique, contrôlée contre les capacités de l'aéronef. Fini le report manuel d'un formulaire à l'autre et les totaux qui divergent d'une copie à la suivante.",
  },
  {
    cle: 'circuit',
    titre: 'Circuit de visa ordonné',
    texte: "Cinq niveaux, franchis dans l'ordre et jamais deux fois. Le tampon est composé et figé à l'instant de la signature : une mutation ultérieure du signataire ne le modifie pas.",
  },
  {
    cle: 'empreinte',
    titre: 'Contenu historisé',
    texte: "À chaque étape, le contenu exact visé est figé sous forme d'empreinte. Un manifeste rejeté puis corrigé garde la trace de ce sur quoi les signataires s'étaient prononcés.",
  },
  {
    cle: 'degrade',
    titre: 'Mode dégradé',
    texte: "La saisie reste possible hors ligne. Les brouillons partent en file d'attente et remontent dès le retour de la liaison, sans double saisie ni ressaisie de contrôle.",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   ⑥  CHIFFRES DU HÉROS
   Constantes d'affichage. Elles décrivent le système, pas une activité
   opérationnelle : aucune donnée de vol ne transite par cette page.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CHIFFRES = [
  { valeur: BASES.length, suffixe: '',   libelle: 'bases aériennes desservies' },
  { valeur: 5,            suffixe: '',   libelle: 'niveaux de visa ordonnés' },
  { valeur: 256,          suffixe: ' bits', libelle: "d'empreinte par version" },
];