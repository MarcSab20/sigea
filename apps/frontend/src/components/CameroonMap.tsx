// apps/frontend/src/components/CameroonMap.tsx
// Carte interactive du Cameroun avec bases aériennes et tracking IoT

import React, { useState, useEffect, useRef } from 'react';
import { T } from '@/lib/theme';

interface Base {
  code: string;
  nom: string;
  ville: string;
  lat: number;
  lng: number;
  actif: boolean;
}

interface AeronefPosition {
  immat: string;
  type: string;
  lat: number;
  lng: number;
  alt: number;
  vitesse: number;
  cap: number;
  statut: 'EN_VOL' | 'AU_SOL' | 'INCONNU';
  mission?: string;
}

const BASES_POSITIONS: Base[] = [
  { code: 'BA101', nom: 'Base Aérienne 101', ville: 'Yaoundé',    lat: 3.8480,  lng: 11.5021, actif: true },
  { code: 'BA102', nom: 'Base Aérienne 102', ville: 'Douala',     lat: 4.0061,  lng: 9.7069,  actif: true },
  { code: 'BA201', nom: 'Base Aérienne 201', ville: 'Garoua',     lat: 9.3347,  lng: 13.3781, actif: true },
  { code: 'BA301', nom: 'Base Aérienne 301', ville: 'Maroua',     lat: 10.5957, lng: 14.3273, actif: true },
  { code: 'BA302', nom: 'Base Aérienne 302', ville: 'Ngaoundéré', lat: 7.3570,  lng: 13.5720, actif: true },
  { code: 'BA401', nom: 'Base Aérienne 401', ville: 'Bafoussam',  lat: 5.4781,  lng: 10.4178, actif: true },
  { code: 'BA501', nom: 'Base Aérienne 501', ville: 'Bertoua',    lat: 4.5853,  lng: 13.6844, actif: true },
];

// Limites géographiques du Cameroun
const MAP = {
  latMin: 1.65, latMax: 13.08,
  lngMin: 8.45, lngMax: 16.20,
  width: 420, height: 480,
};

function geoToPixel(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - MAP.lngMin) / (MAP.lngMax - MAP.lngMin)) * MAP.width;
  const y = ((MAP.latMax - lat) / (MAP.latMax - MAP.latMin)) * MAP.height;
  return { x, y };
}

// Contour simplifié du Cameroun (coordonnées approximatives)
const CAMEROUN_PATH = `
  M 95,470 L 60,440 L 30,400 L 10,350 L 15,300 L 5,260 L 20,220
  L 40,190 L 35,150 L 50,120 L 80,90 L 110,70 L 140,50 L 170,30
  L 200,20 L 230,15 L 260,25 L 290,40 L 310,60 L 330,80 L 350,110
  L 370,140 L 390,170 L 405,200 L 415,230 L 410,260 L 400,290
  L 390,320 L 380,350 L 370,370 L 350,390 L 320,410 L 290,430
  L 260,450 L 230,465 L 200,470 L 170,468 L 140,465 L 120,470 Z
`;

export default function CameroonMap(): React.ReactElement {
  const [selected, setSelected] = useState<Base | null>(null);
  const [aeronefs, setAeronefs] = useState<AeronefPosition[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Simulation IoT — positions aéronefs en vol
  useEffect(() => {
    // Données simulées (à remplacer par WebSocket IoT réel)
    const mockPositions: AeronefPosition[] = [
      {
        immat: 'TJ-AAF', type: 'C-130',
        lat: 6.2, lng: 11.8, alt: 7500, vitesse: 480, cap: 45,
        statut: 'EN_VOL', mission: 'MIS-2026-0441',
      },
    ];
    setAeronefs(mockPositions);

    // Animation position aéronef
    const animate = (ts: number): void => {
      if (ts - timeRef.current > 2000) {
        timeRef.current = ts;
        setAeronefs(prev => prev.map(a => ({
          ...a,
          lat: a.lat + (Math.random() - 0.5) * 0.1,
          lng: a.lng + (Math.random() - 0.5) * 0.1,
          alt: a.alt + (Math.random() - 0.5) * 50,
          vitesse: a.vitesse + (Math.random() - 0.5) * 10,
        })));
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const getCapRotation = (cap: number): string => `rotate(${cap}deg)`;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            Situation Opérationnelle
          </div>
          <div style={{ fontSize: 11, color: T.textDim }}>
            Carte des bases · Tracking aéronefs temps réel
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 10,
          color: T.textDim }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%',
              background: T.green, display: 'inline-block' }} />
            Base active
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: T.amberLight, fontSize: 12 }}>✈</span>
            En vol
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%',
              background: T.textDim, display: 'inline-block' }} />
            Au sol
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 16 }}>
        {/* SVG Carte */}
        <div style={{ background: T.bgAlt, borderRadius: 8, padding: 12,
          border: `1px solid ${T.border}`, position: 'relative', overflow: 'hidden' }}>
          <svg width="100%" viewBox={`0 0 ${MAP.width} ${MAP.height}`}
            style={{ display: 'block' }}>
            {/* Fond ocean/extérieur */}
            <rect width={MAP.width} height={MAP.height} fill="#e8f4f8" rx="4" />

            {/* Contour Cameroun */}
            <path d={CAMEROUN_PATH} fill="#f0ece4" stroke={T.border}
              strokeWidth="1.5" />

            {/* Grille légère */}
            {[...Array(8)].map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 60} x2={MAP.width} y2={i * 60}
                stroke={T.border} strokeWidth="0.3" strokeDasharray="3,6" />
            ))}
            {[...Array(7)].map((_, i) => (
              <line key={`v${i}`} x1={i * 60} y1="0" x2={i * 60} y2={MAP.height}
                stroke={T.border} strokeWidth="0.3" strokeDasharray="3,6" />
            ))}

            {/* Lignes de connexion entre bases */}
            {BASES_POSITIONS.map((b1, i) =>
              BASES_POSITIONS.slice(i + 1, i + 2).map(b2 => {
                const p1 = geoToPixel(b1.lat, b1.lng);
                const p2 = geoToPixel(b2.lat, b2.lng);
                return (
                  <line key={`${b1.code}-${b2.code}`}
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke={T.green} strokeWidth="0.5"
                    strokeDasharray="4,4" opacity="0.3" />
                );
              })
            )}

            {/* Bases aériennes */}
            {BASES_POSITIONS.map(base => {
              const { x, y } = geoToPixel(base.lat, base.lng);
              const isSelected = selected?.code === base.code;
              return (
                <g key={base.code} style={{ cursor: 'pointer' }}
                  onClick={() => setSelected(isSelected ? null : base)}>
                  {/* Pulse animation */}
                  {isSelected && (
                    <circle cx={x} cy={y} r="20" fill="none"
                      stroke={T.green} strokeWidth="1" opacity="0.4">
                      <animate attributeName="r" from="12" to="24"
                        dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.6" to="0"
                        dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {/* Hexagone base */}
                  <polygon
                    points={`${x},${y-10} ${x+9},${y-5} ${x+9},${y+5} ${x},${y+10} ${x-9},${y+5} ${x-9},${y-5}`}
                    fill={isSelected ? T.green : T.bgCard}
                    stroke={T.green} strokeWidth="1.5"
                  />
                  <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle"
                    fontSize="5" fontWeight="700" fill={isSelected ? '#fff' : T.green}>
                    ✈
                  </text>
                  {/* Label */}
                  <text x={x} y={y + 16} textAnchor="middle" fontSize="8"
                    fontWeight="600" fill={T.textSub}>
                    {base.code}
                  </text>
                  <text x={x} y={y + 25} textAnchor="middle" fontSize="7"
                    fill={T.textDim}>
                    {base.ville}
                  </text>
                </g>
              );
            })}

            {/* Aéronefs en vol */}
            {aeronefs.map(a => {
              if (a.statut !== 'EN_VOL') return null;
              const { x, y } = geoToPixel(a.lat, a.lng);
              return (
                <g key={a.immat} style={{ cursor: 'pointer' }}>
                  {/* Traînée */}
                  <circle cx={x} cy={y} r="18" fill="none"
                    stroke={T.amberLight} strokeWidth="1" opacity="0.2">
                    <animate attributeName="r" from="8" to="22"
                      dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.4" to="0"
                      dur="2s" repeatCount="indefinite" />
                  </circle>
                  {/* Icône aéronef */}
                  <circle cx={x} cy={y} r="8"
                    fill={T.amberLight} opacity="0.9" />
                  <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle"
                    fontSize="9" fill="#fff">✈</text>
                  {/* Label */}
                  <rect x={x - 18} y={y - 22} width="36" height="12"
                    fill={T.amberLight} rx="3" opacity="0.9" />
                  <text x={x} y={y - 14} textAnchor="middle" fontSize="7"
                    fontWeight="600" fill="#fff">
                    {a.immat}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Panneau info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Info base sélectionnée */}
          {selected ? (
            <div style={{ padding: '12px 14px', background: T.greenBg,
              border: `1px solid ${T.greenBorder}`, borderRadius: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.green,
                marginBottom: 6 }}>{selected.code}</div>
              <div style={{ fontSize: 12, color: T.text, marginBottom: 4 }}>
                {selected.nom}
              </div>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8 }}>
                📍 {selected.ville}
              </div>
              <div style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono }}>
                {selected.lat.toFixed(4)}°N<br />
                {selected.lng.toFixed(4)}°E
              </div>
              <div style={{ marginTop: 8, padding: '5px 8px', background: T.greenBg,
                borderRadius: 4, fontSize: 10, color: T.green, fontWeight: 600 }}>
                ● OPÉRATIONNELLE
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', background: T.bgAlt,
              border: `1px solid ${T.border}`, borderRadius: 6,
              fontSize: 11, color: T.textDim, textAlign: 'center' }}>
              Cliquez sur une base pour les détails
            </div>
          )}

          {/* Aéronefs en vol */}
          <div style={{ padding: '10px 12px', background: T.bgCard,
            border: `1px solid ${T.border}`, borderRadius: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Aéronefs
            </div>
            {aeronefs.length === 0 ? (
              <div style={{ fontSize: 11, color: T.textMute }}>Aucun en vol</div>
            ) : aeronefs.map(a => (
              <div key={a.immat} style={{ marginBottom: 8, padding: '8px',
                background: a.statut === 'EN_VOL' ? T.amberBg : T.bgAlt,
                borderRadius: 5, border: `1px solid ${a.statut === 'EN_VOL' ? T.amberBorder : T.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>
                    {a.immat}
                  </span>
                  <span style={{ fontSize: 9, color: a.statut === 'EN_VOL' ? T.amberLight : T.textDim,
                    background: a.statut === 'EN_VOL' ? T.amberBg : T.bgAlt,
                    border: `1px solid ${a.statut === 'EN_VOL' ? T.amberBorder : T.border}`,
                    borderRadius: 3, padding: '1px 5px' }}>
                    {a.statut === 'EN_VOL' ? 'EN VOL' : 'AU SOL'}
                  </span>
                </div>
                {a.statut === 'EN_VOL' && (
                  <div style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono }}>
                    <div>Alt: {a.alt.toFixed(0)} m</div>
                    <div>Vit: {a.vitesse.toFixed(0)} km/h</div>
                    <div>Cap: {a.cap}°</div>
                    {a.mission && <div style={{ color: T.amberLight }}>
                      {a.mission}
                    </div>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Résumé bases */}
          <div style={{ padding: '10px 12px', background: T.bgCard,
            border: `1px solid ${T.border}`, borderRadius: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Bases ({BASES_POSITIONS.length})
            </div>
            {BASES_POSITIONS.map(b => (
              <div key={b.code} style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '3px 0',
                borderBottom: `1px solid ${T.border}`,
                cursor: 'pointer' }}
                onClick={() => setSelected(selected?.code === b.code ? null : b)}>
                <span style={{ fontSize: 10, color: T.textSub }}>{b.code}</span>
                <span style={{ fontSize: 9, color: T.green }}>● {b.ville}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}