// apps/frontend/src/app/landing/landing.data.ts
//
// Contenu éditorial de la vitrine publique. Aucun appel réseau, aucune donnée
// opérationnelle : la page s'affiche passerelle éteinte.

/* ═══════════════════════════════════════════════════════════════════════════
   ①  VOS MÉDIAS — L'UNIQUE ENDROIT À MODIFIER
   ───────────────────────────────────────────────────────────────────────────
   Déposez vos fichiers dans  apps/frontend/public/medias/  puis ajustez les
   chemins ici. Vite sert `public/` à la racine : `public/medias/hero.jpg`
   s'adresse par `/medias/hero.jpg`.

   Chaque emplacement possède un repli : tant que le fichier est absent, une
   silhouette sobre s'affiche. Aucun cadre cassé, jamais.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Visuel {
  /** Chemin servi. `null` = emplacement volontairement vide (repli affiché). */
  src: string | null;
  /** Texte alternatif — obligatoire, lu par les lecteurs d'écran. */
  alt: string;
}

export const VISUELS = {
  /** Fond du héros. Superposé en `multiply` : une image contrastée passe bien,
   *  une image délavée disparaît. Conseillé : 2400 × 1400 px. */
  hero: { src: '/medias/hero.jpg', alt: "Aéronef sur une aire de stationnement" } as Visuel,

  /** Insigne de l'en-tête et du pied de page. SVG, ou PNG 256 × 256 transparent.
   *  `null` conserve le monogramme vectoriel généré. */
  insigne: { src: null, alt: 'Insigne des Forces Aériennes Camerounaises' } as Visuel,

  /** Illustration de la section « Vérifiabilité ». Conseillé : 1600 × 1200 px. */
  preuve: { src: '/medias/salle-operations.jpg', alt: "Poste d'exploitation" } as Visuel,
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   ②  LES QUATRE FONCTIONS
   ───────────────────────────────────────────────────────────────────────────
   Chaque carte s'ouvre au clic sur une démonstration animée. Cette animation
   est VECTORIELLE, construite pour la fonction — ce n'est pas un fichier
   vidéo. Deux raisons : elle pèse quelques kilo-octets au lieu de plusieurs
   méga-octets, et elle reste nette à toute résolution.

   Si vous préférez une vraie capture d'écran filmée, renseignez `video` :
       video: { src: '/medias/demos/manifeste.mp4', poster: '/medias/demos/manifeste.jpg' }
   La vidéo prend alors la place de l'animation vectorielle, automatiquement.
   Conseillé : MP4 H.264, 1280 × 800, sans bande-son, 10 à 20 s, sous 4 Mo.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Video { src: string; poster?: string; }

export interface Fonction {
  cle: 'manifeste' | 'circuit' | 'empreinte' | 'degrade';
  titre: string;
  texte: string;
  /** Texte affiché sous la démonstration, dans la fenêtre. */
  detail: string;
  /** Laisser `null` pour conserver l'animation vectorielle. */
  video: Video | null;
}

export const FONCTIONS: Fonction[] = [
  {
    cle: 'manifeste',
    titre: 'Manifeste dématérialisé',
    texte: "Une saisie unique, contrôlée contre les capacités de l'aéronef. Fini le report manuel d'un formulaire à l'autre et les totaux qui divergent d'une copie à la suivante.",
    detail: "Le contrôle est appliqué à la saisie, pas après coup : la barre de charge se remplit en direct et le dépassement bloque la soumission au lieu de la signaler une fois le document parti.",
    video: null,
  },
  {
    cle: 'circuit',
    titre: 'Circuit de visa ordonné',
    texte: "Cinq niveaux, franchis dans l'ordre et jamais deux fois. Le tampon est composé et figé à l'instant de la signature : une mutation ultérieure du signataire ne le modifie pas.",
    detail: "Un rejet ne fait pas disparaître les visas déjà posés : il renvoie le document à son rédacteur avec un motif obligatoire, et le circuit reprend à l'étape concernée.",
    video: null,
  },
  {
    cle: 'empreinte',
    titre: 'Contenu historisé',
    texte: "À chaque étape, le contenu exact visé est figé sous forme d'empreinte. Un manifeste rejeté puis corrigé garde la trace de ce sur quoi les signataires s'étaient prononcés.",
    detail: "Changer un seul caractère du contenu produit une empreinte entièrement différente. C'est ce qui rend une substitution détectable sans avoir à comparer les documents ligne à ligne.",
    video: null,
  },
  {
    cle: 'degrade',
    titre: 'Mode dégradé',
    texte: "La saisie reste possible hors ligne. Les brouillons partent en file d'attente et remontent dès le retour de la liaison, sans double saisie ni ressaisie de contrôle.",
    detail: "La file est ordonnée et rejouée telle quelle au retour du réseau. Un brouillon refusé côté serveur revient dans la file avec son motif, il n'est jamais perdu en silence.",
    video: null,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   ③  FLOTTE — VUES 360° ET POINTS D'EXPLORATION
   ───────────────────────────────────────────────────────────────────────────
   ⚠ À LIRE AVANT DE PRÉPARER LES IMAGES.

   Une rotation 360° réaliste n'est pas un effet : c'est une SÉQUENCE DE
   PHOTOGRAPHIES, prises tout autour de l'appareil à pas constant. Il n'existe
   aucun moyen honnête de fabriquer les autres angles à partir d'une seule
   photo — ce que l'on voit derrière l'aile n'est nulle part dans l'image.

   Deux modes, selon ce dont vous disposez :

   ┌─ MODE « 360 » ─────────────────────────────────────────────────────────┐
   │ `frames: 36` et `dossier: '/medias/flotte/transport/'`                 │
   │ Attendu : 000.jpg, 001.jpg … 035.jpg (numérotation sur 3 chiffres).    │
   │ 36 vues = un pas de 10°, c'est le standard et c'est fluide.            │
   │ 24 vues (15°) suffisent si la prise de vue est contrainte.             │
   │ Cadrage, distance et exposition IDENTIQUES d'une vue à l'autre, sinon  │
   │ l'appareil « saute » à chaque pas.                                     │
   │ Conseillé : 1600 × 1200 px, JPEG qualité 80. 36 vues ≈ 6 à 9 Mo — les  │
   │ images sont chargées à l'ouverture de la fenêtre, pas au chargement de │
   │ la page.                                                               │
   └────────────────────────────────────────────────────────────────────────┘

   ┌─ MODE « IMAGE FIXE » (repli) ──────────────────────────────────────────┐
   │ `frames: 0` et une simple `vignette`.                                  │
   │ La fenêtre s'ouvre quand même : image agrandie, déplacement au         │
   │ pointeur, points d'exploration actifs. Seule la rotation est absente,  │
   │ et rien n'affiche de fausse rotation.                                  │
   └────────────────────────────────────────────────────────────────────────┘

   ⚠ Les caractéristiques ci-dessous sont des EMPLACEMENTS À RENSEIGNER. Je
   n'ai inscrit aucun chiffre : publier des capacités inventées sur un site
   institutionnel serait pire que de ne rien afficher. Une entrée laissée
   vide n'est simplement pas affichée.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PointExploration {
  /** Position sur l'image, en pourcentage de largeur / hauteur. */
  x: number; y: number;
  titre: string;
  texte: string;
}

export interface Appareil {
  slug: string;
  nom: string;
  role: string;
  note: string;
  /** Vignette de la grille, et repli de la fenêtre si `frames` vaut 0. */
  vignette: Visuel;
  /** Nombre de vues de la séquence 360°. 0 = pas de séquence. */
  frames: number;
  /** Dossier des vues, avec la barre finale. */
  dossier: string;
  /** Caractéristiques affichées dans la fenêtre. Laissez vide tant que vous
   *  n'avez pas les valeurs officielles. */
  caracteristiques: { cle: string; valeur: string }[];
  /** Points cliquables superposés à l'appareil. Ajustez x/y une fois vos
   *  images en place — les valeurs ci-dessous sont des positions de départ. */
  points: PointExploration[];
}

export const FLOTTE: Appareil[] = [
  {
    slug: 'transport',
    nom: 'Transport tactique',
    role: 'Projection',
    note: "Acheminement de troupes et de fret sur terrains sommaires.",
    vignette: { src: '/medias/flotte/transport.jpg', alt: 'Aéronef de transport tactique' },
    frames: 0,
    dossier: '/medias/flotte/transport/',
    caracteristiques: [
      { cle: 'Places', valeur: '' },
      { cle: 'Charge utile', valeur: '' },
      { cle: 'Distance franchissable', valeur: '' },
    ],
    points: [
      { x: 26, y: 46, titre: 'Poste de pilotage', texte: "L'équipage figure au manifeste au même titre que les passagers : il est décompté dans la charge." },
      { x: 52, y: 58, titre: 'Soute', texte: "Le volume et la charge utile bornent la saisie du fret. Un dépassement bloque la soumission du manifeste." },
      { x: 74, y: 52, titre: 'Rampe arrière', texte: "Les chargements par rampe sont saisis comme matériels, avec leur masse unitaire." },
    ],
  },
  {
    slug: 'helicoptere',
    nom: 'Voilure tournante',
    role: 'Liaison · EVASAN',
    note: "Évacuation sanitaire et liaison entre emprises isolées.",
    vignette: { src: '/medias/flotte/helicoptere.jpg', alt: 'Hélicoptère de liaison' },
    frames: 0,
    dossier: '/medias/flotte/helicoptere/',
    caracteristiques: [
      { cle: 'Places', valeur: '' },
      { cle: 'Charge utile', valeur: '' },
      { cle: "Rayon d'action", valeur: '' },
    ],
    points: [
      { x: 46, y: 30, titre: 'Rotor principal', texte: "Les créneaux de maintenance du rotor conditionnent la disponibilité déclarée au COMGMO." },
      { x: 50, y: 60, titre: 'Cabine', texte: "En configuration EVASAN, les places civières sont saisies distinctement des places assises." },
    ],
  },
  {
    slug: 'appui',
    nom: 'Appui aérien',
    role: 'Opérations',
    note: "Missions d'appui au profit des forces engagées.",
    vignette: { src: '/medias/flotte/appui.jpg', alt: "Aéronef d'appui aérien" },
    frames: 0,
    dossier: '/medias/flotte/appui/',
    caracteristiques: [
      { cle: 'Équipage', valeur: '' },
      { cle: 'Emports', valeur: '' },
    ],
    points: [
      { x: 34, y: 44, titre: 'Verrière', texte: "Les vols classés sensibles franchissent un verrou CEMAA avant l'accord du commandant de base." },
      { x: 62, y: 56, titre: "Points d'emport", texte: "Les emports relèvent du suivi opérationnel et ne figurent pas au manifeste d'escale." },
    ],
  },
  {
    slug: 'liaison',
    nom: 'Aviation légère',
    role: 'Instruction',
    note: "Formation des équipages et liaisons de commandement.",
    vignette: { src: '/medias/flotte/liaison.jpg', alt: 'Aéronef léger de liaison' },
    frames: 0,
    dossier: '/medias/flotte/liaison/',
    caracteristiques: [
      { cle: 'Places', valeur: '' },
      { cle: 'Autonomie', valeur: '' },
    ],
    points: [
      { x: 40, y: 46, titre: 'Cabine', texte: "Les vols d'instruction sont tracés au même titre que les autres — pas de circuit dérogatoire." },
      { x: 68, y: 50, titre: 'Empennage', texte: "Chaque vol est rattaché à un aéronef du référentiel, identifié par son immatriculation." },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   ④  BASES AÉRIENNES
   Coordonnées des villes, reprises de CameroonMap.tsx. `regionId` correspond à
   l'identifiant du tracé dans cameroon.geo.ts — c'est ce qui permet
   d'illuminer la région de la base survolée.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Base {
  code: string; nom: string; ville: string;
  lat: number; lng: number; region: string; regionId: string;
}

export const BASES: Base[] = [
  { code: 'BA101', nom: 'Base Aérienne 101', ville: 'Yaoundé',    lat: 3.8480,  lng: 11.5021, region: 'Centre',       regionId: 'CM-CE' },
  { code: 'BA102', nom: 'Base Aérienne 102', ville: 'Bertoua',    lat: 4.5772,  lng: 13.6846, region: 'Est',          regionId: 'CM-ES' },
  { code: 'BA201', nom: 'Base Aérienne 201', ville: 'Douala',     lat: 4.0061,  lng: 9.7069,  region: 'Littoral',     regionId: 'CM-LT' },
  { code: 'BA301', nom: 'Base Aérienne 301', ville: 'Garoua',     lat: 9.3347,  lng: 13.3781, region: 'Nord',         regionId: 'CM-NO' },
  { code: 'BA302', nom: 'Base Aérienne 302', ville: 'Ngaoundéré', lat: 7.3570,  lng: 13.5720, region: 'Adamaoua',     regionId: 'CM-AD' },
  { code: 'BA401', nom: 'Base Aérienne 401', ville: 'Maroua',     lat: 10.5957, lng: 14.3273, region: 'Extrême-Nord', regionId: 'CM-EN' },
  { code: 'BA501', nom: 'Base Aérienne 501', ville: 'Bamenda',    lat: 5.9597,  lng: 10.1494, region: 'Nord-Ouest',   regionId: 'CM-NW' },
];

/**
 * Liaisons tracées sur la carte.
 *
 * ⚠ Maillage ILLUSTRATIF. Il ne représente aucune desserte réelle et n'est
 * tiré d'aucun plan de vol : il montre que les bases sont reliées entre elles
 * dans le système, rien de plus. Modifiez librement.
 *
 * Chaque paire est un couple d'indices dans BASES. `courbe` règle la flèche de
 * l'arc (en fraction de la distance) ; le signe choisit le côté.
 */
export const LIAISONS: { a: number; b: number; courbe: number }[] = [
  { a: 0, b: 2, courbe:  0.16 },  // Yaoundé    ↔ Douala
  { a: 0, b: 1, courbe: -0.14 },  // Yaoundé    ↔ Bertoua
  { a: 0, b: 4, courbe:  0.18 },  // Yaoundé    ↔ Ngaoundéré
  { a: 0, b: 6, courbe: -0.20 },  // Yaoundé    ↔ Bamenda
  { a: 2, b: 6, courbe:  0.22 },  // Douala     ↔ Bamenda
  { a: 1, b: 4, courbe:  0.20 },  // Bertoua    ↔ Ngaoundéré
  { a: 4, b: 3, courbe: -0.16 },  // Ngaoundéré ↔ Garoua
  { a: 3, b: 5, courbe:  0.15 },  // Garoua     ↔ Maroua
  { a: 4, b: 5, courbe: -0.24 },  // Ngaoundéré ↔ Maroua
  { a: 6, b: 3, courbe:  0.26 },  // Bamenda    ↔ Garoua
  { a: 2, b: 4, courbe: -0.26 },  // Douala     ↔ Ngaoundéré
  { a: 1, b: 3, courbe:  0.24 },  // Bertoua    ↔ Garoua
];

/* ═══════════════════════════════════════════════════════════════════════════
   ⑤  CIRCUIT DE VISA
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Etape {
  rang: number; role: string; statut: string;
  titre: string; texte: string; garde: string;
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
   ⑥  CHIFFRES DU HÉROS
   Constantes d'affichage : elles décrivent le système, pas une activité.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CHIFFRES = [
  { valeur: BASES.length, suffixe: '',      libelle: 'bases aériennes desservies' },
  { valeur: 5,            suffixe: '',      libelle: 'niveaux de visa ordonnés' },
  { valeur: 256,          suffixe: ' bits', libelle: "d'empreinte par version" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   ⑦  MANIFESTES DE DÉMONSTRATION
   La séquence du héros rejoue en boucle ; chaque tour reprend un jeu de
   valeurs différent pour que la reprise ne soit pas une simple répétition.
   Données FICTIVES, sans rapport avec un mouvement réel.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SPECIMENS = [
  { ref: 'MFT-0417', aeronef: 'Transport tactique', route: 'BA 101 → BA 301 → BA 401', charge: '38 passagers · 4 200 kg',
    hash: '9f2c41ab7e08d3556c1ea94f0b7728d3a6ef15c284b09d7e3f6a1c8025be4713' },
  { ref: 'MFT-0418', aeronef: 'Voilure tournante',  route: 'BA 201 → BA 501',          charge: '11 passagers · 640 kg',
    hash: '3d80b6e5c1472fa9086d35be7c04198fe2a7d5630bc84f1e97a2085d6cf3b214' },
  { ref: 'MFT-0419', aeronef: 'Aviation légère',    route: 'BA 302 → BA 102',          charge: '6 passagers · 210 kg',
    hash: 'c7a15e39d4b8026fa1c95307e86bd24f039ea7c5182d6fb04e73a9c1580d2e46' },
];