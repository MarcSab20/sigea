// apps/frontend/src/app/landing/Circuit.tsx
//
// ② SIGNATURE — LE RACK DE STRIPS
//
// En tour de contrôle, chaque vol est suivi par un strip cartonné qui descend
// physiquement de casier en casier, d'un contrôleur au suivant. C'est déjà,
// littéralement, le circuit de visa de SIGEA.
//
// ── Ce qui a été enrichi par rapport à la première version ────────────────
//   • Le strip ACCUMULE ses visas : chaque descente laisse un tampon de plus
//     sur le carton. À la fin, on lit tout le parcours sur la pièce elle-même.
//   • Il BASCULE en descendant — une pièce de carton manipulée ne translate
//     pas rigoureusement à plat — puis se repose. La bascule dure exactement
//     le temps du déplacement, elle n'est jamais visible à l'arrêt.
//   • Une TRAÎNÉE D'ENCRE se trace le long du rack au fur et à mesure, et ne
//     s'efface pas : le chemin parcouru reste lisible.
//   • Le casier actif est BALAYÉ par un liseré lumineux, comme un poste qui
//     interroge le document devant lui.
//   • Le casier franchi reçoit son propre TAMPON, à droite.
//
// Toutes ces animations sont pilotées par `transform` et `opacity` seuls.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PlaneTakeoff } from 'lucide-react';
import { CIRCUIT, type Etape } from './landing.data';
import { TitreSection } from './ui';
import { useProgressionDefilement, useMouvementReduit, useMedia } from './Uselandingmotion';

const HAUTEUR_CASIER = 72;
const GOUTTIERE = 10;
const PAS = HAUTEUR_CASIER + GOUTTIERE;

/** Durée de la bascule du strip. Doit rester alignée sur `.lp-strip` en CSS. */
const DUREE_DEPLACEMENT = 620;

export default function SectionCircuit(): React.ReactElement {
  const reduit = useMouvementReduit();
  const compact = useMedia('(max-width: 900px)');
  const pilotage = !reduit && !compact;   // le rack collant n'a de sens qu'au grand écran

  const { ref, progression } = useProgressionDefilement<HTMLDivElement>(pilotage);

  const index = useMemo(() => {
    if (!pilotage) return CIRCUIT.length - 1;
    return Math.min(CIRCUIT.length - 1, Math.floor(progression * CIRCUIT.length));
  }, [progression, pilotage]);

  // Bascule transitoire : active uniquement pendant le déplacement.
  const [bouge, setBouge] = useState(false);
  const precedent = useRef(index);

  useEffect(() => {
    if (precedent.current === index) return;
    precedent.current = index;
    setBouge(true);
    const id = window.setTimeout(() => setBouge(false), DUREE_DEPLACEMENT);
    return () => window.clearTimeout(id);
  }, [index]);

  return (
    <section
      id="circuit"
      ref={ref}
      style={{
        position: 'relative',
        borderTop: '1px solid var(--line)',
        background: 'var(--ink-850)',
        // Une pleine hauteur d'écran par étape, plus la hauteur de la scène.
        minHeight: pilotage ? `calc(100vh + ${CIRCUIT.length * 56}vh)` : undefined,
      }}
    >
      <div style={pilotage ? {
        position: 'sticky', top: 0, height: '100vh',
        display: 'flex', alignItems: 'center', overflow: 'hidden',
      } : undefined}>
        <div className="lp-wrap" style={{ width: '100%', paddingBlock: pilotage ? 0 : 'clamp(64px, 9vw, 108px)' }}>

          {!pilotage && (
            <TitreSection
              sur="Circuit de validation"
              titre="Cinq visas, dans un ordre qui ne se contourne pas"
              sous="Chaque niveau ne peut agir que lorsque c'est son tour."
            />
          )}

          <div className="lp-rack">
            {/* ─────────────── Le rack ─────────────── */}
            <div>
              {pilotage && (
                <div style={{ marginBottom: 24 }}>
                  <span className="lp-eyebrow">Circuit de validation</span>
                  <div className="lp-progress" style={{ marginTop: 16 }}>
                    <div className="lp-progress__bar"
                         style={{ '--p': progression } as React.CSSProperties} />
                  </div>
                </div>
              )}

              <div className="lp-rack__slots" style={{ '--pas': `${PAS}px` } as React.CSSProperties}>
                {/* Traînée d'encre : elle ne s'efface pas derrière le strip */}
                <span
                  className="lp-rack__encre"
                  aria-hidden="true"
                  style={{ transform: `scaleY(${(index + 1) / CIRCUIT.length})` }}
                />

                {CIRCUIT.map((e, i) => (
                  <div
                    key={e.rang}
                    className="lp-slot"
                    data-state={i < index ? 'done' : i === index ? 'active' : 'todo'}
                  >
                    <span className="lp-slot__n">{e.rang}</span>
                    <span className="lp-slot__lbl">{e.role}</span>

                    {/* Tampon du casier, apposé au passage */}
                    <span className="lp-slot__visa" data-on={i < index ? '1' : '0'}>
                      {e.statut}
                    </span>
                    <span className="lp-slot__st" data-on={i >= index ? '1' : '0'}>
                      {i === index ? 'EN COURS' : 'EN ATTENTE'}
                    </span>

                    {/* Balayage du poste actif */}
                    {i === index && !reduit && <span className="lp-slot__balai" aria-hidden="true" />}
                  </div>
                ))}

                {/* Le strip descend de casier en casier, et accumule ses visas */}
                {pilotage && (
                  <div
                    className={`lp-strip${bouge ? ' is-moving' : ''}`}
                    style={{ transform: `translate3d(0, ${index * PAS}px, 0)` }}
                    aria-hidden="true"
                  >
                    <PlaneTakeoff size={17} strokeWidth={1.9} />
                    <span className="lp-strip__id">MFT-0417</span>
                    <span className="lp-strip__rte">101 → 401</span>

                    <span className="lp-strip__visas">
                      {CIRCUIT.map((e, i) => (
                        <span key={e.rang} className="lp-strip__visa"
                              data-on={i <= index ? '1' : '0'}
                              style={{ '--tilt': i % 2 ? '2.2deg' : '-2.6deg' } as React.CSSProperties}>
                          {e.statut}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>

              {pilotage && (
                <p className="lp-small" style={{ marginTop: 22, maxWidth: 470 }}>
                  Le strip descend d&apos;un casier au suivant et repart avec un visa de
                  plus. Ici, il ne remonte jamais tout seul : chaque passage est horodaté.
                </p>
              )}
            </div>

            {/* ─────────────── Les volets de texte ─────────────── */}
            <div className="lp-rack__panes">
              {CIRCUIT.map((e, i) => (
                <VoletEtape key={e.rang} etape={e}
                            actif={!pilotage || i === index} statique={!pilotage} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VoletEtape({ etape, actif, statique }:
{ etape: Etape; actif: boolean; statique: boolean }): React.ReactElement {
  return (
    <article className="lp-pane" data-on={actif ? '1' : '0'}
             style={statique ? { marginBottom: 34 } : undefined}>
      <span className="lp-data" style={{ color: 'var(--green)' }}>
        ÉTAPE {String(etape.rang).padStart(2, '0')} / {String(CIRCUIT.length).padStart(2, '0')}
      </span>
      <h3 className="lp-h2" style={{ marginTop: 14, fontSize: 'clamp(26px, 3.2vw, 38px)' }}>
        {etape.titre}
      </h3>
      <p className="lp-lead" style={{ marginTop: 18, maxWidth: 480 }}>{etape.texte}</p>
      <p className="lp-garde">{etape.garde}</p>
    </article>
  );
}