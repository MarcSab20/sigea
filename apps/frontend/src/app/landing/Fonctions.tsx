// apps/frontend/src/app/landing/Fonctions.tsx
//
// LES QUATRE FONCTIONS
//
// Chaque carte s'ouvre au clic sur une démonstration animée de la fonction.
//
// ── Un point d'honnêteté ─────────────────────────────────────────────────
// Ces démonstrations ne sont pas des fichiers vidéo : ce sont des animations
// vectorielles construites pour chaque fonction. Le choix est délibéré — elles
// pèsent quelques kilo-octets au lieu de plusieurs méga-octets, restent nettes
// à toute résolution, et n'exigent pas que vous produisiez quatre captures
// filmées avant de pouvoir mettre en ligne.
//
// Si vous voulez de vraies captures d'écran filmées, renseignez le champ
// `video` de la fonction dans landing.data.ts : la vidéo prend alors
// automatiquement la place de l'animation, sans autre modification.

import React, { useEffect, useRef, useState } from 'react';
import { FileText, Stamp, Fingerprint, WifiOff, Play } from 'lucide-react';
import { FONCTIONS, type Fonction } from './landing.data';
import { Reveler, Section, TitreSection, Modale } from './ui';
import { useMouvementReduit } from './Uselandingmotion';

const ICONES: Record<Fonction['cle'], React.ElementType> = {
  manifeste: FileText,
  circuit:   Stamp,
  empreinte: Fingerprint,
  degrade:   WifiOff,
};

/* ─────────────────────────────────────────────────────────────────────────
   Petite boucle d'étapes, partagée par les quatre démonstrations.
   Un seul minuteur vivant : rien ne s'accumule si l'onglet passe en fond.
   ───────────────────────────────────────────────────────────────────────── */

function useBoucle(nb: number, cadence: number, actif: boolean): number {
  const [i, setI] = useState(0);
  const reduit = useMouvementReduit();

  useEffect(() => {
    if (!actif) { setI(0); return; }
    if (reduit) { setI(nb - 1); return; }   // état final, pas de boucle
    setI(0);
    const id = window.setInterval(() => setI((v) => (v + 1) % nb), cadence);
    return () => window.clearInterval(id);
  }, [nb, cadence, actif, reduit]);

  return i;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DÉMONSTRATION 1 — Saisie contrôlée
   La barre de charge se remplit en direct ; au dépassement, elle vire et la
   soumission est refusée. Le contrôle est à la saisie, pas après coup.
   ═══════════════════════════════════════════════════════════════════════════ */

const SAISIE = [
  { lignes: 1, charge: 34, etat: 'saisie' },
  { lignes: 2, charge: 61, etat: 'saisie' },
  { lignes: 3, charge: 88, etat: 'saisie' },
  { lignes: 4, charge: 112, etat: 'bloque' },
  { lignes: 4, charge: 112, etat: 'bloque' },
  { lignes: 3, charge: 88, etat: 'conforme' },
  { lignes: 3, charge: 88, etat: 'conforme' },
];

function DemoManifeste({ actif }: { actif: boolean }): React.ReactElement {
  const i = useBoucle(SAISIE.length, 1250, actif);
  const s = SAISIE[i];

  const lignes = [
    ['Passagers', '38'],
    ['Équipage', '5'],
    ['Matériels', '4 200 kg'],
    ['Fret additionnel', '+ 1 350 kg'],
  ];

  return (
    <div className="lp-demo">
      <div className="lp-demo__ecran">
        {lignes.map(([k, v], n) => (
          <div key={k} className="lp-demo__ligne" data-on={n < s.lignes ? '1' : '0'}>
            <span>{k}</span><b>{v}</b>
          </div>
        ))}

        <div className="lp-demo__jauge" data-etat={s.etat}>
          <span style={{ width: `${Math.min(100, s.charge)}%` }} />
          {s.charge > 100 && <em style={{ width: `${s.charge - 100}%` }} />}
        </div>

        <div className="lp-demo__pied">
          <span className="lp-demo__pct" data-etat={s.etat}>
            {s.charge} % de la charge utile
          </span>
          <span className="lp-demo__badge" data-etat={s.etat}>
            {s.etat === 'bloque' ? 'Soumission bloquée'
              : s.etat === 'conforme' ? 'Conforme — soumission possible'
              : 'Saisie en cours'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DÉMONSTRATION 2 — Circuit ordonné, avec rejet
   ═══════════════════════════════════════════════════════════════════════════ */

const PARCOURS = [
  { at: 0, rejet: false }, { at: 1, rejet: false }, { at: 2, rejet: false },
  { at: 2, rejet: true },  { at: 0, rejet: false }, { at: 1, rejet: false },
  { at: 2, rejet: false }, { at: 3, rejet: false }, { at: 4, rejet: false },
  { at: 4, rejet: false },
];

const NIVEAUX = ["Chef d'escale", 'COMESO', 'COMGMO', 'COMBASE', 'Cdt de bord'];

function DemoCircuit({ actif }: { actif: boolean }): React.ReactElement {
  const i = useBoucle(PARCOURS.length, 950, actif);
  const { at, rejet } = PARCOURS[i];

  return (
    <div className="lp-demo">
      <div className="lp-demo__ecran lp-demo__ecran--circuit">
        <div className="lp-demo__chaine">
          {NIVEAUX.map((n, k) => (
            <div key={n} className="lp-demo__noeud"
                 data-etat={rejet && k === at ? 'rejet' : k < at ? 'vu' : k === at ? 'actif' : 'attente'}>
              <span className="lp-demo__pastille">{rejet && k === at ? '✕' : k <= at ? '✓' : k + 1}</span>
              <span className="lp-demo__nom">{n}</span>
            </div>
          ))}
          <div className="lp-demo__fil"><span style={{ width: `${(at / (NIVEAUX.length - 1)) * 100}%` }} /></div>
        </div>

        <div className="lp-demo__msg" data-on={rejet ? '1' : '0'}>
          Rejet motivé — retour au rédacteur. Les visas déjà posés restent tracés.
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DÉMONSTRATION 3 — Une modification, une empreinte entièrement différente
   ═══════════════════════════════════════════════════════════════════════════ */

const VERSIONS = [
  { v: 'v1', valeur: '38 passagers', hash: '9f2c41ab7e08d3556c1ea94f0b7728d3a6ef15c284b09d7e3f6a1c8025be4713' },
  { v: 'v2', valeur: '39 passagers', hash: '3d80b6e5c1472fa9086d35be7c04198fe2a7d5630bc84f1e97a2085d6cf3b214' },
];

const HEX = '0123456789abcdef';

/** Brouillage bref avant stabilisation : rend visible que TOUT change, pas
 *  seulement quelques caractères. */
function useBrouillage(cible: string, duree = 620): string {
  const [rendu, setRendu] = useState(cible);
  const reduit = useMouvementReduit();
  const premier = useRef(true);

  useEffect(() => {
    if (reduit || premier.current) { premier.current = false; setRendu(cible); return; }
    const debut = performance.now();
    let f = 0;

    const pas = (t: number): void => {
      const p = Math.min(1, (t - debut) / duree);
      const fige = Math.floor(cible.length * p);
      let s = cible.slice(0, fige);
      for (let k = fige; k < cible.length; k += 1) s += HEX[(Math.random() * 16) | 0];
      setRendu(s);
      if (p < 1) f = requestAnimationFrame(pas);
    };

    f = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(f);
  }, [cible, duree, reduit]);

  return rendu;
}

function DemoEmpreinte({ actif }: { actif: boolean }): React.ReactElement {
  const i = useBoucle(VERSIONS.length, 2600, actif);
  const cour = VERSIONS[i];
  const hash = useBrouillage(cour.hash);

  return (
    <div className="lp-demo">
      <div className="lp-demo__ecran">
        <div className="lp-demo__ligne" data-on="1">
          <span>Contenu visé</span>
          <b key={cour.v} className="lp-demo__valeur">{cour.valeur}</b>
        </div>

        <div className="lp-demo__hash">{hash}</div>

        <div className="lp-demo__versions">
          {VERSIONS.map((v, k) => (
            <span key={v.v} className="lp-demo__version" data-on={k <= i ? '1' : '0'}
                  data-cour={k === i ? '1' : '0'}>
              {v.v} · {v.valeur}
            </span>
          ))}
        </div>

        <p className="lp-demo__note">
          Un seul caractère modifié, et l&apos;empreinte n&apos;a plus rien de commun avec
          la précédente. Les deux versions restent conservées.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DÉMONSTRATION 4 — Mode dégradé
   ═══════════════════════════════════════════════════════════════════════════ */

const DEGRADE = [
  { ligne: false, file: 0 }, { ligne: false, file: 1 }, { ligne: false, file: 2 },
  { ligne: false, file: 3 }, { ligne: true,  file: 3 }, { ligne: true,  file: 2 },
  { ligne: true,  file: 1 }, { ligne: true,  file: 0 }, { ligne: true,  file: 0 },
];

function DemoDegrade({ actif }: { actif: boolean }): React.ReactElement {
  const i = useBoucle(DEGRADE.length, 950, actif);
  const { ligne, file } = DEGRADE[i];
  const brouillons = ['MFT-0417', 'MFT-0418', 'MFT-0419'];

  return (
    <div className="lp-demo">
      <div className="lp-demo__ecran">
        <div className="lp-demo__etatlien" data-on={ligne ? '1' : '0'}>
          <span className="lp-demo__voyant" />
          {ligne ? 'Liaison rétablie — remontée de la file' : 'Hors ligne — saisie maintenue'}
        </div>

        <div className="lp-demo__file">
          {brouillons.map((b, k) => (
            <div key={b} className="lp-demo__brouillon"
                 data-etat={k < file ? (ligne && k >= file ? 'attente' : 'attente') : 'parti'}>
              <span>{b}</span>
              <b>{k < file ? 'en file' : 'remonté ✓'}</b>
            </div>
          ))}
        </div>

        <p className="lp-demo__note">
          La file est ordonnée et rejouée telle quelle. Aucune ressaisie, et aucun
          brouillon perdu en silence.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Aiguillage et section
   ═══════════════════════════════════════════════════════════════════════════ */

const DEMOS: Record<Fonction['cle'], React.ComponentType<{ actif: boolean }>> = {
  manifeste: DemoManifeste,
  circuit:   DemoCircuit,
  empreinte: DemoEmpreinte,
  degrade:   DemoDegrade,
};

export default function SectionFonctions(): React.ReactElement {
  const [ouverte, setOuverte] = useState<Fonction | null>(null);
  const Demo = ouverte ? DEMOS[ouverte.cle] : null;

  return (
    <Section id="systeme" fond="var(--ink-900)">
      <TitreSection
        sur="Ce que fait SIGEA"
        titre={<>Un manifeste,<br />une chaîne, une preuve</>}
        sous="Quatre fonctions structurent le système. Chacune répond à une faiblesse précise du circuit papier — ouvrez-en une pour la voir fonctionner."
      />

      <div className="lp-cards" style={{ marginTop: 52 }}>
        {FONCTIONS.map((f, i) => {
          const Ico = ICONES[f.cle];
          return (
            <Reveler key={f.cle} delai={i * 70}>
              <button type="button" className="lp-card" onClick={() => setOuverte(f)}>
                <span className="lp-card__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="lp-card__ico"><Ico size={20} strokeWidth={1.7} /></span>
                <span className="lp-h3">{f.titre}</span>
                <span className="lp-body">{f.texte}</span>
                <span className="lp-card__voir">
                  <Play size={12} strokeWidth={2.4} /> Voir la démonstration
                </span>
              </button>
            </Reveler>
          );
        })}
      </div>

      <Modale
        ouverte={Boolean(ouverte)}
        fermer={() => setOuverte(null)}
        titre={ouverte?.titre ?? ''}
        taille={860}
      >
        {ouverte && (
          <>
            <header className="lp-modale__tete">
              <span className="lp-eyebrow">Démonstration</span>
              <h3 className="lp-h2" style={{ fontSize: 'clamp(24px, 3vw, 32px)', marginTop: 12 }}>
                {ouverte.titre}
              </h3>
            </header>

            {ouverte.video ? (
              // Une vraie capture filmée a été fournie : elle prime.
              <video
                className="lp-demo__video"
                src={ouverte.video.src}
                poster={ouverte.video.poster}
                autoPlay loop muted playsInline
                aria-label={`Démonstration : ${ouverte.titre}`}
              />
            ) : (
              Demo && <Demo actif />
            )}

            <p className="lp-body" style={{ marginTop: 22 }}>{ouverte.detail}</p>
          </>
        )}
      </Modale>
    </Section>
  );
}