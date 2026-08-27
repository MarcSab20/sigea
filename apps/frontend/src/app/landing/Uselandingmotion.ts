// apps/frontend/src/app/landing/useLandingMotion.ts
//
// Crochets d'animation de la vitrine. Aucune dépendance : IntersectionObserver
// et requestAnimationFrame suffisent, et coûtent nettement moins cher qu'une
// librairie de motion importée pour quatre effets.
//
// Règle tenue partout ici : on ne lit jamais la géométrie du document dans le
// gestionnaire de `scroll` lui-même — la mesure est repoussée dans une frame
// d'animation, sans quoi le navigateur recalcule le layout à chaque cran de
// molette.

import { useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────────────────────────────────
   Préférence système « mouvement réduit »
   Réévaluée si l'utilisateur change son réglage sans recharger la page.
   ───────────────────────────────────────────────────────────────────────── */

export function useMouvementReduit(): boolean {
  const [reduit, setReduit] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const appliquer = (): void => setReduit(mq.matches);
    appliquer();
    mq.addEventListener('change', appliquer);
    return () => mq.removeEventListener('change', appliquer);
  }, []);

  return reduit;
}

/* ─────────────────────────────────────────────────────────────────────────
   Requête média générique (bascule vers les variantes compactes)
   ───────────────────────────────────────────────────────────────────────── */

export function useMedia(requete: string): boolean {
  const [actif, setActif] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(requete);
    const appliquer = (): void => setActif(mq.matches);
    appliquer();
    mq.addEventListener('change', appliquer);
    return () => mq.removeEventListener('change', appliquer);
  }, [requete]);

  return actif;
}

/* ─────────────────────────────────────────────────────────────────────────
   Révélation à l'entrée dans le champ
   `unique` (défaut) : on cesse d'observer après la première entrée — c'est
   le comportement attendu d'une page vitrine, et cela libère l'observateur.
   ───────────────────────────────────────────────────────────────────────── */

export function useRevelation<T extends HTMLElement = HTMLDivElement>(
  options?: { seuil?: number; marge?: string; unique?: boolean },
): { ref: React.RefObject<T>; vu: boolean } {
  const { seuil = 0.16, marge = '0px 0px -12% 0px', unique = true } = options ?? {};
  const ref = useRef<T>(null);
  const [vu, setVu] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Repli si l'API manque (très anciens navigateurs) : on affiche tout.
    if (typeof IntersectionObserver === 'undefined') { setVu(true); return; }

    const obs = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVu(true);
          if (unique) obs.disconnect();
        } else if (!unique) {
          setVu(false);
        }
      },
      { threshold: seuil, rootMargin: marge },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [seuil, marge, unique]);

  return { ref, vu };
}

/* ─────────────────────────────────────────────────────────────────────────
   Progression du défilement à travers un conteneur haut
   Renvoie 0 quand le haut du conteneur atteint le haut de la fenêtre, 1 quand
   son bas y arrive. Sert au rack de strips en position collante.
   ───────────────────────────────────────────────────────────────────────── */

export function useProgressionDefilement<T extends HTMLElement = HTMLDivElement>(
  actif = true,
): { ref: React.RefObject<T>; progression: number } {
  const ref = useRef<T>(null);
  const [progression, setProgression] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (!actif) { setProgression(0); return; }

    const mesurer = (): void => {
      frame.current = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const course = r.height - window.innerHeight;
      const p = course > 0 ? -r.top / course : 0;
      setProgression(Math.min(1, Math.max(0, p)));
    };

    const planifier = (): void => {
      if (frame.current) return;              // une mesure par frame, pas plus
      frame.current = requestAnimationFrame(mesurer);
    };

    window.addEventListener('scroll', planifier, { passive: true });
    window.addEventListener('resize', planifier);
    planifier();

    return () => {
      window.removeEventListener('scroll', planifier);
      window.removeEventListener('resize', planifier);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [actif]);

  return { ref, progression };
}

/* ─────────────────────────────────────────────────────────────────────────
   Franchissement d'un seuil de défilement (en-tête collant)
   ───────────────────────────────────────────────────────────────────────── */

export function useDefilementDepasse(seuil = 24): boolean {
  const [depasse, setDepasse] = useState(false);

  useEffect(() => {
    let frame = 0;
    const mesurer = (): void => { frame = 0; setDepasse(window.scrollY > seuil); };
    const planifier = (): void => { if (!frame) frame = requestAnimationFrame(mesurer); };

    window.addEventListener('scroll', planifier, { passive: true });
    planifier();
    return () => {
      window.removeEventListener('scroll', planifier);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [seuil]);

  return depasse;
}

/* ─────────────────────────────────────────────────────────────────────────
   Compteur progressif
   Courbe d'amortissement en sortie (easeOutExpo) : le chiffre part vite et
   se pose — l'inverse donnerait l'impression d'un chargement qui traîne.
   ───────────────────────────────────────────────────────────────────────── */

export function useCompteur(cible: number, actif: boolean, duree = 1100): number {
  const [valeur, setValeur] = useState(0);
  const reduit = useMouvementReduit();

  useEffect(() => {
    if (!actif) return;
    if (reduit) { setValeur(cible); return; }

    let frame = 0;
    let debut = 0;

    const pas = (t: number): void => {
      if (!debut) debut = t;
      const p = Math.min(1, (t - debut) / duree);
      const amorti = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setValeur(Math.round(cible * amorti));
      if (p < 1) frame = requestAnimationFrame(pas);
    };

    frame = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(frame);
  }, [cible, actif, duree, reduit]);

  return valeur;
}

/* ─────────────────────────────────────────────────────────────────────────
   Frappe progressive d'une chaîne (l'empreinte du document)
   ───────────────────────────────────────────────────────────────────────── */

export function useFrappe(texte: string, actif: boolean, cadence = 14): string {
  const [rendu, setRendu] = useState('');
  const reduit = useMouvementReduit();

  useEffect(() => {
    if (!actif) { setRendu(''); return; }
    if (reduit) { setRendu(texte); return; }

    let i = 0;
    const id = window.setInterval(() => {
      i += 2;
      setRendu(texte.slice(0, i));
      if (i >= texte.length) window.clearInterval(id);
    }, cadence);

    return () => window.clearInterval(id);
  }, [texte, actif, cadence, reduit]);

  return rendu;
}

/* ─────────────────────────────────────────────────────────────────────────
   Cycle du manifeste — machine à phases, en boucle
   ─────────────────────────────────────────────────────────────────────────
   pose    : les tampons s'apposent, un par un
   lecture : le document est complet, on laisse le temps de lire
   sortie  : la feuille part au classement (glisse + bascule)
   entree  : la feuille suivante remonte du sous-main
   → retour à `pose`, avec un nouveau spécimen.

   Un seul minuteur vivant à la fois : pas de cascade de setTimeout qui se
   chevauchent si l'onglet passe en arrière-plan.
   ───────────────────────────────────────────────────────────────────────── */

export type PhaseManifeste = 'pose' | 'lecture' | 'sortie' | 'entree';

export interface Cycle {
  phase: PhaseManifeste;
  /** Index du dernier tampon apposé (−1 = aucun). */
  pose: number;
  /** Numéro de tour — sert de clé de remontage au document. */
  tour: number;
  /** Vrai dès que tous les tampons sont posés. */
  complet: boolean;
}

export function useCycleManifeste(
  nbTampons: number,
  options?: {
    actif?: boolean;
    /** Intervalle entre deux tampons. */
    cadence?: number;
    /** Attente avant le premier tampon. */
    amorce?: number;
    /** Temps de lecture, document complet. */
    lecture?: number;
    /** Durées de la transition de feuille — doivent rester alignées sur le CSS. */
    sortie?: number;
    entree?: number;
  },
): Cycle {
  const {
    actif = true, cadence = 950, amorce = 900,
    lecture = 4200, sortie = 800, entree = 700,
  } = options ?? {};

  const reduit = useMouvementReduit();
  const [etat, setEtat] = useState<Cycle>({ phase: 'pose', pose: -1, tour: 0, complet: false });

  useEffect(() => {
    // Mouvement réduit : état final, pas de boucle. La page reste informative
    // sans jamais rien mettre en mouvement.
    if (reduit) {
      setEtat({ phase: 'lecture', pose: nbTampons - 1, tour: 0, complet: true });
      return;
    }
    if (!actif) return;

    let vivant = true;
    let minuteur = 0;

    const attendre = (ms: number, suite: () => void): void => {
      minuteur = window.setTimeout(() => { if (vivant) suite(); }, ms);
    };

    const demarrerTour = (tour: number): void => {
      setEtat({ phase: 'pose', pose: -1, tour, complet: false });

      const poser = (i: number): void => {
        attendre(i === 0 ? amorce : cadence, () => {
          setEtat((e) => ({ ...e, pose: i, complet: i >= nbTampons - 1 }));
          if (i < nbTampons - 1) poser(i + 1);
          else lire(tour);
        });
      };

      const lire = (t: number): void => {
        setEtat((e) => ({ ...e, phase: 'lecture' }));
        attendre(lecture, () => {
          setEtat((e) => ({ ...e, phase: 'sortie' }));
          attendre(sortie, () => {
            setEtat({ phase: 'entree', pose: -1, tour: t + 1, complet: false });
            attendre(entree, () => demarrerTour(t + 1));
          });
        });
      };

      poser(0);
    };

    demarrerTour(0);

    return () => { vivant = false; window.clearTimeout(minuteur); };
  }, [nbTampons, actif, cadence, amorce, lecture, sortie, entree, reduit]);

  return etat;
}

/* ─────────────────────────────────────────────────────────────────────────
   Fenêtre modale : verrou de défilement, fermeture par Échap, restitution du
   focus à l'élément qui l'a ouverte.
   ───────────────────────────────────────────────────────────────────────── */

export function useModale(ouverte: boolean, fermer: () => void): React.RefObject<HTMLDivElement> {
  const panneau = useRef<HTMLDivElement>(null);
  const declencheur = useRef<Element | null>(null);

  useEffect(() => {
    if (!ouverte) return;

    declencheur.current = document.activeElement;

    // Le verrou compense la largeur de la barre de défilement : sans cela, la
    // page saute latéralement à l'ouverture.
    const marge = window.innerWidth - document.documentElement.clientWidth;
    const overflow = document.body.style.overflow;
    const padding = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (marge > 0) document.body.style.paddingRight = `${marge}px`;

    const auClavier = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.stopPropagation(); fermer(); return; }
      if (e.key !== 'Tab') return;

      const cible = panneau.current;
      if (!cible) return;
      const focusables = cible.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    };

    document.addEventListener('keydown', auClavier);
    // Une frame d'attente : le panneau doit être monté pour recevoir le focus.
    const f = requestAnimationFrame(() => panneau.current?.focus());

    return () => {
      document.removeEventListener('keydown', auClavier);
      cancelAnimationFrame(f);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = padding;
      (declencheur.current as HTMLElement | null)?.focus?.();
    };
  }, [ouverte, fermer]);

  return panneau;
}