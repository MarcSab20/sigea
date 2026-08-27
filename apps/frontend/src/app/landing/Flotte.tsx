// apps/frontend/src/app/landing/Flotte.tsx
//
// LA FLOTTE — fenêtre d'exploration
//
// Au clic sur un appareil, une grande fenêtre s'ouvre : l'appareil tourne, on
// le fait tourner soi-même, et des points cliquables expliquent ce que chaque
// partie implique dans le manifeste.
//
// ═══════════════════════════════════════════════════════════════════════════
//  À LIRE — comment la rotation 360° fonctionne réellement
// ═══════════════════════════════════════════════════════════════════════════
//
// Une rotation 360° convaincante n'est pas un effet appliqué à une image :
// c'est une SÉQUENCE DE PHOTOGRAPHIES prises tout autour de l'appareil, que
// l'on fait défiler. Il n'existe aucun moyen honnête de fabriquer l'autre côté
// d'un avion à partir d'une seule photo — ce qui se trouve derrière l'aile
// n'est nulle part dans l'image de départ.
//
// La visionneuse ci-dessous fonctionne donc en deux modes, et bascule seule :
//
//   • `frames > 0`  → mode 360. Elle charge `dossier` + `000.jpg … NNN.jpg`,
//     fait tourner en continu, et vous laisse faire tourner à la souris, au
//     doigt ou aux flèches du clavier.
//
//   • `frames === 0` → mode image fixe. La fenêtre s'ouvre quand même, avec
//     l'image agrandie, un léger déplacement au pointeur et les points
//     d'exploration actifs. La rotation est simplement absente, et rien ne
//     simule une fausse rotation.
//
// Voir landing.data.ts, section ③, pour les consignes de prise de vue.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw, Maximize2, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { FLOTTE, type Appareil, type PointExploration } from './landing.data';
import { Reveler, Section, TitreSection, Modale, VisuelCadre, SilhouetteAeronef } from './ui';
import { useMouvementReduit } from './Uselandingmotion';

/* ═══════════════════════════════════════════════════════════════════════════
   VISIONNEUSE
   ═══════════════════════════════════════════════════════════════════════════ */

/** Pixels de glissement horizontal correspondant à un pas de rotation. */
const SENSIBILITE = 9;

function Visionneuse({ appareil }: { appareil: Appareil }): React.ReactElement {
  const { frames, dossier, vignette } = appareil;
  const reduit = useMouvementReduit();

  const [angle, setAngle] = useState(0);         // index de vue
  const [tourne, setTourne] = useState(!reduit); // rotation automatique
  const [charge, setCharge] = useState(0);       // vues préchargées
  const [manque, setManque] = useState(false);   // séquence introuvable
  const [survol, setSurvol] = useState({ x: 0, y: 0 });

  const zone = useRef<HTMLDivElement>(null);
  const glisse = useRef<{ x: number; base: number } | null>(null);

  const chemin = useCallback(
    (i: number) => `${dossier}${String(i).padStart(3, '0')}.jpg`,
    [dossier],
  );

  // ── Préchargement ────────────────────────────────────────────────────────
  // Les vues sont chargées à l'OUVERTURE de la fenêtre, pas au chargement de
  // la page : une séquence de 36 vues pèse plusieurs méga-octets et n'a rien à
  // faire dans le chemin critique.
  useEffect(() => {
    if (frames <= 0) return;
    let vivant = true;
    let faites = 0;

    for (let i = 0; i < frames; i += 1) {
      const img = new Image();
      img.onload = () => {
        if (!vivant) return;
        faites += 1;
        setCharge(faites);
      };
      img.onerror = () => { if (vivant && i === 0) setManque(true); };
      img.src = chemin(i);
    }

    return () => { vivant = false; };
  }, [frames, chemin]);

  // ── Rotation automatique ─────────────────────────────────────────────────
  useEffect(() => {
    if (frames <= 0 || manque || !tourne || reduit) return;
    const id = window.setInterval(() => setAngle((a) => (a + 1) % frames), 90);
    return () => window.clearInterval(id);
  }, [frames, manque, tourne, reduit]);

  const sequence = frames > 0 && !manque;

  // ── Rotation au glissement ───────────────────────────────────────────────
  const debutGlisse = (x: number): void => {
    if (!sequence) return;
    glisse.current = { x, base: angle };
    setTourne(false);
  };
  const pendantGlisse = (x: number): void => {
    if (!glisse.current || !sequence) return;
    const pas = Math.round((x - glisse.current.x) / SENSIBILITE);
    setAngle((((glisse.current.base - pas) % frames) + frames) % frames);
  };
  const finGlisse = (): void => { glisse.current = null; };

  // ── Déplacement au pointeur, en mode image fixe ──────────────────────────
  const auPointeur = (e: React.MouseEvent): void => {
    if (sequence) return;
    const r = e.currentTarget.getBoundingClientRect();
    setSurvol({
      x: ((e.clientX - r.left) / r.width - 0.5) * -18,
      y: ((e.clientY - r.top) / r.height - 0.5) * -12,
    });
  };

  const pret = !sequence || charge >= Math.min(frames, 4);

  return (
    <div className="lp-360">
      <div
        ref={zone}
        className={`lp-360__scene${sequence ? ' is-360' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); debutGlisse(e.clientX); }}
        onMouseMove={(e) => { pendantGlisse(e.clientX); auPointeur(e); }}
        onMouseUp={finGlisse}
        onMouseLeave={() => { finGlisse(); setSurvol({ x: 0, y: 0 }); }}
        onTouchStart={(e) => debutGlisse(e.touches[0].clientX)}
        onTouchMove={(e) => pendantGlisse(e.touches[0].clientX)}
        onTouchEnd={finGlisse}
        onKeyDown={(e) => {
          if (!sequence) return;
          if (e.key === 'ArrowLeft')  { setTourne(false); setAngle((a) => (a - 1 + frames) % frames); }
          if (e.key === 'ArrowRight') { setTourne(false); setAngle((a) => (a + 1) % frames); }
        }}
        tabIndex={sequence ? 0 : -1}
        role={sequence ? 'slider' : undefined}
        aria-label={sequence ? `Rotation de l'appareil, vue ${angle + 1} sur ${frames}` : undefined}
        aria-valuenow={sequence ? angle : undefined}
        aria-valuemin={sequence ? 0 : undefined}
        aria-valuemax={sequence ? frames - 1 : undefined}
      >
        {sequence ? (
          <>
            {/* Toutes les vues sont dans le DOM et empilées : basculer
                l'opacité évite le clignotement d'un `src` qui change. */}
            {Array.from({ length: frames }, (_, i) => (
              <img key={i} src={chemin(i)} alt="" aria-hidden={i !== angle}
                   className="lp-360__vue" data-on={i === angle ? '1' : '0'} />
            ))}
            {!pret && <span className="lp-360__attente">Chargement des vues… {charge}/{frames}</span>}
          </>
        ) : vignette.src ? (
          <img
            src={vignette.src} alt={vignette.alt} className="lp-360__fixe"
            style={{ transform: `scale(1.08) translate(${survol.x}px, ${survol.y}px)` }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <SilhouetteAeronef />
        )}

        {/* Points d'exploration */}
        <PointsExploration points={appareil.points} />
      </div>

      {/* ── Commandes ── */}
      <div className="lp-360__barre">
        {sequence ? (
          <>
            <button type="button" className="lp-360__btn"
                    onClick={() => { setTourne(false); setAngle((a) => (a - 1 + frames) % frames); }}
                    aria-label="Vue précédente">
              <ChevronLeft size={16} strokeWidth={2} />
            </button>

            <button type="button" className="lp-360__btn lp-360__btn--large"
                    onClick={() => setTourne((t) => !t)} aria-pressed={tourne}>
              <RotateCw size={14} strokeWidth={2} />
              {tourne ? 'Arrêter la rotation' : 'Faire tourner'}
            </button>

            <button type="button" className="lp-360__btn"
                    onClick={() => { setTourne(false); setAngle((a) => (a + 1) % frames); }}
                    aria-label="Vue suivante">
              <ChevronRight size={16} strokeWidth={2} />
            </button>

            <span className="lp-360__aide">
              Glissez pour tourner · flèches ← → au clavier
            </span>
          </>
        ) : (
          <span className="lp-360__aide lp-360__aide--seule">
            <Maximize2 size={13} strokeWidth={2} />
            Vue fixe. La rotation 360° s&apos;active dès qu&apos;une séquence de vues est
            déposée — voir les consignes dans <code>landing.data.ts</code>.
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   POINTS D'EXPLORATION
   ═══════════════════════════════════════════════════════════════════════════ */

function PointsExploration({ points }: { points: PointExploration[] }): React.ReactElement {
  const [ouvert, setOuvert] = useState<number | null>(null);

  return (
    <>
      {points.map((p, i) => (
        <div key={p.titre} className="lp-point" data-on={ouvert === i ? '1' : '0'}
             style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          <button
            type="button" className="lp-point__cible"
            onClick={(e) => { e.stopPropagation(); setOuvert(ouvert === i ? null : i); }}
            aria-expanded={ouvert === i}
            aria-label={p.titre}
          >
            <Info size={12} strokeWidth={2.4} />
          </button>

          <div className="lp-point__bulle" role="tooltip">
            <strong>{p.titre}</strong>
            <span>{p.texte}</span>
          </div>
        </div>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SectionFlotte(): React.ReactElement {
  const [ouvert, setOuvert] = useState<Appareil | null>(null);
  const caracts = ouvert?.caracteristiques.filter((c) => c.valeur.trim() !== '') ?? [];

  return (
    <Section id="flotte" fond="var(--ink-850)">
      <TitreSection
        sur="Moyens aériens"
        titre="Les appareils suivis dans le système"
        sous="Chaque vol est rattaché à un aéronef du référentiel, dont les capacités en places et en fret bornent la saisie du manifeste. Ouvrez un appareil pour l'explorer."
      />

      <div className="lp-fleet" style={{ marginTop: 52 }}>
        {FLOTTE.map((a, i) => (
          <Reveler key={a.slug} delai={i * 80}>
            <button type="button" className="lp-plate" onClick={() => setOuvert(a)}>
              <span style={{ position: 'relative', display: 'block' }}>
                <VisuelCadre visuel={a.vignette} />
                <span className="lp-plate__veil" aria-hidden="true" />
                <span className="lp-plate__role">{a.role}</span>
                <span className="lp-plate__loupe" aria-hidden="true">
                  <Maximize2 size={15} strokeWidth={2} />
                </span>
              </span>
              <span className="lp-plate__body">
                <span className="lp-h3" style={{ fontSize: 18, display: 'block', marginBottom: 10 }}>
                  {a.nom}
                </span>
                <span className="lp-body" style={{ fontSize: 13.5, display: 'block' }}>{a.note}</span>
              </span>
            </button>
          </Reveler>
        ))}
      </div>

      <Modale ouverte={Boolean(ouvert)} fermer={() => setOuvert(null)}
              titre={ouvert?.nom ?? ''} taille={1080}>
        {ouvert && (
          <div className="lp-fiche">
            <header className="lp-modale__tete">
              <span className="lp-eyebrow">{ouvert.role}</span>
              <h3 className="lp-h2" style={{ fontSize: 'clamp(26px, 3.2vw, 36px)', marginTop: 12 }}>
                {ouvert.nom}
              </h3>
            </header>

            <Visionneuse key={ouvert.slug} appareil={ouvert} />

            <div className="lp-fiche__bas">
              <p className="lp-body">{ouvert.note}</p>

              {caracts.length > 0 ? (
                <dl className="lp-fiche__specs">
                  {caracts.map((c) => (
                    <div key={c.cle}>
                      <dt>{c.cle}</dt>
                      <dd>{c.valeur}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                // Aucune valeur renseignée : on l'annonce plutôt que d'afficher
                // un tableau vide ou, pire, des chiffres inventés.
                <p className="lp-small lp-fiche__vide">
                  Caractéristiques non renseignées. Complétez le champ
                  <code> caracteristiques </code> de cet appareil dans
                  <code> landing.data.ts</code>.
                </p>
              )}

              <p className="lp-small" style={{ marginTop: 14 }}>
                Les points marqués sur l&apos;appareil expliquent ce que chaque partie
                implique dans le manifeste.
              </p>
            </div>
          </div>
        )}
      </Modale>
    </Section>
  );
}