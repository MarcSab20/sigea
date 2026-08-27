// apps/frontend/src/app/landing/ui.tsx
//
// Briques partagées par les sections de la vitrine. Rien d'ici ne connaît le
// contenu : ce sont des enveloppes de présentation.

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useRevelation, useModale } from './Uselandingmotion';
import { VISUELS, type Visuel } from './landing.data';

/* ─────────────────────────────────────────────────────────────────────────
   Révélation à l'entrée dans le champ
   `delai` échelonne les enfants d'une même grappe : 60-80 ms se lit comme une
   cascade, 0 ms comme un bloc qui saute.
   ───────────────────────────────────────────────────────────────────────── */

export function Reveler({
  children, delai = 0, variante, className = '', style, ...reste
}: {
  children: React.ReactNode;
  delai?: number;
  variante?: 'left' | 'right' | 'scale';
} & React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  const { ref, vu } = useRevelation<HTMLDivElement>();
  const classes = [
    'lp-reveal',
    variante ? `lp-reveal--${variante}` : '',
    vu ? 'is-in' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={ref}
      className={classes}
      style={{ ...style, '--lp-delay': `${delai}ms` } as React.CSSProperties}
      {...reste}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Section et titre
   ───────────────────────────────────────────────────────────────────────── */

export function Section({
  id, children, fond, style,
}: {
  id?: string; children: React.ReactNode; fond?: string; style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <section
      id={id}
      style={{ position: 'relative', background: fond, borderTop: '1px solid var(--line)', ...style }}
    >
      <div className="lp-wrap" style={{ paddingBlock: 'clamp(64px, 9vw, 108px)' }}>
        {children}
      </div>
    </section>
  );
}

export function TitreSection({
  sur, titre, sous, max = 640,
}: { sur: string; titre: React.ReactNode; sous?: string; max?: number }): React.ReactElement {
  return (
    <header style={{ maxWidth: max }}>
      <Reveler><span className="lp-eyebrow">{sur}</span></Reveler>
      <Reveler delai={70}><h2 className="lp-h2" style={{ marginTop: 18 }}>{titre}</h2></Reveler>
      {sous && <Reveler delai={140}><p className="lp-lead" style={{ marginTop: 16 }}>{sous}</p></Reveler>}
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Visuels avec repli
   Le repli couvre les deux cas : chemin laissé à `null` (emplacement
   volontairement vide) et fichier absent du serveur.
   ───────────────────────────────────────────────────────────────────────── */

export function VisuelCadre({
  visuel, ratio = '4 / 3', className,
}: { visuel: Visuel; ratio?: string; className?: string }): React.ReactElement {
  const [echec, setEchec] = useState(false);
  const afficher = Boolean(visuel.src) && !echec;

  // <span> et non <div> : ce composant est employé DANS un <button> (grille de
  // la flotte). Le modèle de contenu d'un bouton n'admet que du phrasé — un
  // <div> y est invalide, même si les navigateurs le tolèrent.
  return (
    <span className={`lp-plate__img ${className ?? ''}`} style={{ aspectRatio: ratio }}>
      {afficher ? (
        <img
          src={visuel.src as string} alt={visuel.alt}
          loading="lazy" decoding="async" onError={() => setEchec(true)}
        />
      ) : <SilhouetteAeronef />}
    </span>
  );
}

export function SilhouetteAeronef(): React.ReactElement {
  return (
    <svg viewBox="0 0 240 132" width="66%" aria-hidden="true" role="presentation">
      <path
        d="M20 62 L96 56 L116 30 L128 30 L122 55 L172 51 L188 34 L198 34 L192 52
           L220 50 L224 60 L220 70 L192 68 L198 86 L188 86 L172 69 L122 65
           L128 90 L116 90 L96 64 L20 58 Z"
        fill="var(--line-hi)" opacity=".55"
      />
      <text x="120" y="118" textAnchor="middle" fontSize="8.5"
            fontFamily="var(--f-data)" fill="var(--fg-mute)" letterSpacing="1.6">
        EMPLACEMENT PHOTO
      </text>
    </svg>
  );
}

/** Monogramme vectoriel, remplacé par VISUELS.insigne si un fichier est fourni. */
export function Insigne({ taille = 38 }: { taille?: number }): React.ReactElement {
  const [echec, setEchec] = useState(false);

  if (VISUELS.insigne.src && !echec) {
    return (
      <img
        src={VISUELS.insigne.src} alt={VISUELS.insigne.alt}
        width={taille} height={taille}
        style={{ objectFit: 'contain', display: 'block' }}
        onError={() => setEchec(true)}
      />
    );
  }

  return (
    <svg width={taille} height={taille} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="3" fill="none"
            stroke="var(--green-line)" strokeWidth="1.4" />
      <path d="M8 26 L20 9 L32 26 L26 26 L20 17 L14 26 Z" fill="var(--green)" />
      <rect x="8" y="29" width="24" height="2.4" fill="var(--green)" opacity=".55" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Fenêtre modale
   Verrou de défilement, fermeture par Échap ou clic sur le voile, piège à
   focus et restitution du focus au déclencheur — le tout dans `useModale`.
   ───────────────────────────────────────────────────────────────────────── */

export function Modale({
  ouverte, fermer, titre, taille = 980, children,
}: {
  ouverte: boolean;
  fermer: () => void;
  titre: string;
  taille?: number;
  children: React.ReactNode;
}): React.ReactElement | null {
  const panneau = useModale(ouverte, fermer);

  if (!ouverte) return null;

  return (
    <div
      className="lp-modale"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) fermer(); }}
    >
      <div
        ref={panneau}
        className="lp-modale__panneau"
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        tabIndex={-1}
        style={{ maxWidth: taille }}
      >
        <button type="button" className="lp-modale__fermer" onClick={fermer} aria-label="Fermer">
          <X size={18} strokeWidth={2} />
        </button>
        {children}
      </div>
    </div>
  );
}