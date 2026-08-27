// apps/frontend/src/app/landing/Bases.tsx
//
// LES BASES AÉRIENNES — carte réelle
//
// Le fond de carte n'est plus un schéma dessiné à la main : c'est le tracé
// fourni (export MapSVG), découpé par région administrative. Les bases sont
// projetées avec le `geoViewBox` du fichier, ce qui garantit qu'elles tombent
// au bon endroit — contrôle effectué région par région, voir cameroon.geo.ts.
//
// ── Animations ────────────────────────────────────────────────────────────
//   • Les régions se dessinent au trait à l'entrée dans le champ, du sud vers
//     le nord, puis se remplissent.
//   • Le maillage de liaisons est tracé en arcs (Bézier quadratique, flèche
//     réglable par liaison dans landing.data.ts).
//   • Un appareil parcourt chaque arc, en va-et-vient, à vitesse propre —
//     `animateMotion` SVG, donc hors du fil principal JavaScript.
//   • Chaque base émet un ping calé sur le passage du faisceau radar : le
//     retard d'animation est calculé depuis son angle, la lumière suit
//     exactement le balayage.
//   • Survoler une base illumine sa région d'appartenance et met en avant les
//     seules liaisons qui la touchent ; les autres s'estompent.

import React, { useMemo, useState } from 'react';
import { BASES, LIAISONS } from './landing.data';
import { REGIONS_CM, CADRE_CM, projeterCM } from './cameroon.geo';
import { Reveler, Section, TitreSection } from './ui';
import { useRevelation, useMouvementReduit } from './Uselandingmotion';

/** Période du balayage. Doit rester égale à la durée de `.lp-beam` en CSS. */
const PERIODE_RADAR = 9;

interface Arc { id: string; d: string; a: number; b: number; duree: number; }

export default function SectionBases(): React.ReactElement {
  const [active, setActive] = useState<string | null>(null);
  const { ref, vu } = useRevelation<HTMLDivElement>({ seuil: 0.15 });
  const reduit = useMouvementReduit();

  const points = useMemo(() => BASES.map((b) => projeterCM(b.lat, b.lng)), []);

  // Arcs : Bézier quadratique dont le point de contrôle est décalé
  // perpendiculairement à la corde. La flèche vient de LIAISONS.
  const arcs = useMemo<Arc[]>(() => LIAISONS.map((l, i) => {
    const p = points[l.a];
    const q = points[l.b];
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const cx = mx - dy * l.courbe;
    const cy = my + dx * l.courbe;
    return {
      id: `arc${i}`,
      d: `M${p.x.toFixed(1)},${p.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`,
      a: l.a, b: l.b,
      // Durées volontairement dépareillées : un maillage où tout bat au même
      // rythme se lit comme un motif décoratif, pas comme du trafic.
      duree: 7 + ((i * 1.7) % 5),
    };
  }), [points]);

  const baseActive = BASES.findIndex((b) => b.code === active);

  return (
    <Section id="bases" fond="var(--ink-900)">
      <TitreSection
        sur="Implantation"
        titre="Les bases aériennes desservies"
        sous="SIGEA cloisonne les données par base : un utilisateur ne voit que les vols au départ, à l'arrivée ou en escale sur la sienne. Le cloisonnement est appliqué côté serveur, en base, et non par masquage d'écran."
      />

      <div ref={ref} className={`lp-map ${vu ? 'is-in' : ''}`} style={{ marginTop: 52 }}>

        {/* ─────────────── Carte ─────────────── */}
        <div className="lp-map__box">
          {!reduit && (
            <div className="lp-beam" aria-hidden="true"
                 style={{ animationDuration: `${PERIODE_RADAR}s` }} />
          )}

          <svg
            viewBox={`0 0 ${CADRE_CM.w} ${CADRE_CM.h}`}
            className="lp-carte"
            role="img"
            aria-label="Carte du Cameroun et de ses sept bases aériennes"
          >
            <defs>
              <linearGradient id="lpTerre" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="rgba(45,106,79,.16)" />
                <stop offset="100%" stopColor="rgba(45,106,79,.05)" />
              </linearGradient>
              <linearGradient id="lpTerreOn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="rgba(45,106,79,.38)" />
                <stop offset="100%" stopColor="rgba(45,106,79,.20)" />
              </linearGradient>
            </defs>

            {/* ── Régions ── */}
            <g className="lp-regions">
              {REGIONS_CM.map((r, i) => {
                const on = baseActive >= 0 && BASES[baseActive].regionId === r.id;
                return (
                  <path
                    key={r.id} d={r.d}
                    className="lp-region" data-on={on ? '1' : '0'}
                    fill={on ? 'url(#lpTerreOn)' : 'url(#lpTerre)'}
                    style={{ '--lp-delay': `${i * 70}ms` } as React.CSSProperties}
                  >
                    <title>{r.nom}</title>
                  </path>
                );
              })}
            </g>

            {/* ── Maillage de liaisons ── */}
            <g className="lp-flux">
              <defs>
                {arcs.map((a) => <path key={a.id} id={a.id} d={a.d} />)}
              </defs>

              {arcs.map((a, i) => {
                const concerne = baseActive < 0 || a.a === baseActive || a.b === baseActive;
                return (
                  <g key={a.id} className="lp-flux__g" data-on={concerne ? '1' : '0'}>
                    <path d={a.d} className="lp-flux__trait"
                          style={{ '--lp-delay': `${300 + i * 55}ms` } as React.CSSProperties} />
                    <path d={a.d} className="lp-flux__pointille" />

                    {!reduit && (
                      <circle r="5" className="lp-flux__mobile">
                        <animateMotion
                          dur={`${a.duree}s`}
                          repeatCount="indefinite"
                          keyPoints="0;1;0"
                          keyTimes="0;0.5;1"
                          calcMode="linear"
                          begin={`${-i * 0.8}s`}
                        >
                          <mpath href={`#${a.id}`} xlinkHref={`#${a.id}`} />
                        </animateMotion>
                      </circle>
                    )}
                  </g>
                );
              })}
            </g>

            {/* ── Bases ── */}
            <g className="lp-bases">
              {BASES.map((b, i) => {
                const p = points[i];
                const on = active === b.code;

                // Angle horaire depuis le haut, comme le conic-gradient CSS :
                // le ping s'allume au passage exact du faisceau.
                const angle = (Math.atan2(p.x - CADRE_CM.w / 2, CADRE_CM.h / 2 - p.y) * 180) / Math.PI;
                const phase = (((angle + 360) % 360) / 360) * PERIODE_RADAR - PERIODE_RADAR;

                return (
                  <g key={b.code} className="lp-marque" data-on={on ? '1' : '0'}
                     onMouseEnter={() => setActive(b.code)}
                     onMouseLeave={() => setActive(null)}
                     onFocus={() => setActive(b.code)}
                     onBlur={() => setActive(null)}
                     tabIndex={0} role="button"
                     aria-label={`${b.nom}, ${b.ville}`}>
                    {!reduit && (
                      <circle cx={p.x} cy={p.y} r={11} className="lp-ping"
                              style={{
                                '--lp-phase': `${phase.toFixed(2)}s`,
                                animationDuration: `${PERIODE_RADAR}s`,
                              } as React.CSSProperties} />
                    )}
                    <circle cx={p.x} cy={p.y} r={16} className="lp-marque__halo" />
                    <circle cx={p.x} cy={p.y} r={9} className="lp-marque__pt" />
                    <text x={p.x + 21} y={p.y + 8} className="lp-marque__txt">{b.code}</text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* ─────────────── Liste ─────────────── */}
        <div style={{ display: 'grid', gap: 8 }}>
          {BASES.map((b, i) => (
            <Reveler
              key={b.code} delai={i * 55} variante="right"
              className={`lp-base ${active === b.code ? 'is-on' : ''}`}
              onMouseEnter={() => setActive(b.code)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="lp-base__code">{b.code}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{b.ville}</span>
                <span className="lp-small" style={{ fontSize: 11.5 }}>{b.nom}</span>
              </span>
              <span className="lp-data" style={{ color: 'var(--fg-mute)', fontSize: 10.5 }}>
                {b.region.toUpperCase()}
              </span>
            </Reveler>
          ))}

          <p className="lp-small" style={{ marginTop: 14, fontSize: 11.5 }}>
            Fond de carte fourni par l&apos;exploitant. Le maillage de liaisons est
            illustratif : il montre que les bases sont reliées dans le système et ne
            représente aucune desserte réelle ni aucun plan de vol.
          </p>
        </div>
      </div>
    </Section>
  );
}