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
   Séquence ordonnée (pose des tampons du héros)
   Renvoie l'index de la dernière étape jouée. `rejouer()` remet à zéro.
   ───────────────────────────────────────────────────────────────────────── */

export function useSequence(
  nb: number,
  options?: { actif?: boolean; intervalle?: number; retard?: number },
): { index: number; rejouer: () => void; termine: boolean } {
  const { actif = true, intervalle = 620, retard = 700 } = options ?? {};
  const [index, setIndex] = useState(-1);
  const [cycle, setCycle] = useState(0);
  const reduit = useMouvementReduit();

  useEffect(() => {
    if (!actif) return;
    if (reduit) { setIndex(nb - 1); return; }

    setIndex(-1);
    const minuteurs: number[] = [];

    for (let i = 0; i < nb; i += 1) {
      minuteurs.push(
        window.setTimeout(() => setIndex(i), retard + i * intervalle),
      );
    }

    return () => minuteurs.forEach(window.clearTimeout);
  }, [nb, actif, intervalle, retard, reduit, cycle]);

  return {
    index,
    rejouer: () => setCycle((c) => c + 1),
    termine: index >= nb - 1,
  };
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