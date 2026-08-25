// apps/frontend/src/app/landing/LandingPage.tsx
//
// Page d'accueil publique de SIGVEA.
//
// ── Contraintes tenues ──
//   • AUCUNE dépendance nouvelle : styles en ligne, comme le reste de l'IHM ;
//   • AUCUN appel réseau : la page doit s'afficher même passerelle éteinte ;
//   • aucune donnée opérationnelle : c'est une vitrine institutionnelle,
//     consultable sans compte. Elle ne cite ni vol, ni base opérationnelle
//     réelle au-delà de ce qui figure déjà dans le référentiel public.
//
// ── Photographies d'aéronefs ──
// Les visuels sont chargés depuis `public/aeronefs/<fichier>.jpg`. Aucun
// fichier n'est fourni : déposez-y VOS photographies (voir le README du
// dossier). Tant qu'une photo est absente, une silhouette vectorielle sobre
// s'affiche à la place — la page reste présentable en toutes circonstances.

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { T } from '@/lib/theme';

// ─── Référentiel d'affichage ───────────────────────────────────────────────
// Repris de CameroonMap.tsx pour rester cohérent avec l'IHM interne. Ces
// coordonnées sont celles des villes, à vocation illustrative.

interface BaseAffichee {
  code: string; nom: string; ville: string;
  lat: number; lng: number; region: string;
}

const BASES: BaseAffichee[] = [
  { code: 'BA101', nom: 'Base Aérienne 101', ville: 'Yaoundé',    lat: 3.8480,  lng: 11.5021, region: 'Centre' },
  { code: 'BA102', nom: 'Base Aérienne 102', ville: 'Bertoua',    lat: 4.5772,  lng: 13.6846, region: 'Est' },
  { code: 'BA201', nom: 'Base Aérienne 201', ville: 'Douala',     lat: 4.0061,  lng: 9.7069,  region: 'Littoral' },
  { code: 'BA301', nom: 'Base Aérienne 301', ville: 'Garoua',     lat: 9.3347,  lng: 13.3781, region: 'Nord' },
  { code: 'BA302', nom: 'Base Aérienne 302', ville: 'Ngaoundéré', lat: 7.3570,  lng: 13.5720, region: 'Adamaoua' },
  { code: 'BA401', nom: 'Base Aérienne 401', ville: 'Maroua',     lat: 10.5957, lng: 14.3273, region: 'Extrême-Nord' },
  { code: 'BA501', nom: 'Base Aérienne 501', ville: 'Bamenda',    lat: 5.9597,  lng: 10.1494, region: 'Nord-Ouest' },
];

const MAP = { latMin: 1.65, latMax: 13.08, lngMin: 8.45, lngMax: 16.20, width: 420, height: 480 };

function geoToPixel(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng - MAP.lngMin) / (MAP.lngMax - MAP.lngMin)) * MAP.width,
    y: ((MAP.latMax - lat) / (MAP.latMax - MAP.latMin)) * MAP.height,
  };
}

const CAMEROUN_PATH = `
  M 95,470 L 60,440 L 30,400 L 10,350 L 15,300 L 5,260 L 20,220
  L 40,190 L 35,150 L 50,120 L 80,90 L 110,70 L 140,50 L 170,30
  L 200,20 L 230,15 L 260,25 L 290,40 L 310,60 L 330,80 L 350,110
  L 370,140 L 390,170 L 405,200 L 415,230 L 410,260 L 400,290
  L 390,320 L 380,350 L 370,370 L 350,390 L 320,410 L 290,430
  L 260,450 L 230,465 L 200,470 L 170,468 L 140,465 L 120,470 Z
`;

// ─── Flotte présentée ──────────────────────────────────────────────────────
// `fichier` pointe vers public/aeronefs/. Adaptez librement cette liste :
// elle est purement éditoriale et n'interroge pas le référentiel.

interface Appareil { nom: string; role: string; fichier: string; note: string }

const FLOTTE: Appareil[] = [
  { nom: 'Transport tactique',  role: 'Projection de forces',    fichier: 'transport.jpg',  note: 'Acheminement de troupes et de fret sur terrains sommaires.' },
  { nom: 'Voilure tournante',   role: 'Liaison et EVASAN',       fichier: 'helicoptere.jpg', note: 'Évacuation sanitaire et liaison entre emprises isolées.' },
  { nom: 'Appui aérien',        role: 'Missions opérationnelles', fichier: 'appui.jpg',      note: 'Missions d\u2019appui au profit des forces engagées.' },
  { nom: 'Aviation légère',     role: 'Instruction et liaison',   fichier: 'liaison.jpg',    note: 'Formation des équipages et liaisons de commandement.' },
];

// ─── Étapes du circuit, à titre pédagogique ────────────────────────────────

const CIRCUIT = [
  { rang: 1, code: "Chef d'escale",       texte: 'Établit le manifeste et le soumet. Sa soumission vaut visa.' },
  { rang: 2, code: 'COMESO',              texte: "Contrôle la conformité de l'escale et vise le document." },
  { rang: 3, code: 'COMGMO',              texte: 'Vérifie la cohérence avec les moyens engagés et vise.' },
  { rang: 4, code: 'COMBASE',             texte: "Donne l'ACCORD au titre du commandement de la base." },
  { rang: 5, code: 'Commandant de bord',  texte: 'Vise en dernier ressort et clôt le circuit avant vol.' },
];

// ═══════════════════════════════════════════════════════════════════════════

export default function LandingPage(): React.ReactElement {
  const [scrolled, setScrolled] = useState(false);
  const [baseActive, setBaseActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: T.body, color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Source+Code+Pro:wght@400;600&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; color: inherit; }
        html { scroll-behavior: smooth; }
        @keyframes lpFade { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        @keyframes lpPulse { 0%,100% { opacity: .35; r: 13 } 50% { opacity: 0; r: 22 } }
        @keyframes lpGlide { from { stroke-dashoffset: 260 } to { stroke-dashoffset: 0 } }
        .lp-sec { animation: lpFade .5s ease both; }
        .lp-card { transition: transform .18s ease, box-shadow .18s ease; }
        .lp-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,.10); }
        .lp-nav a:hover { color: ${T.green}; }
        .lp-cta:hover { filter: brightness(1.08); }
        @media (max-width: 860px) {
          .lp-hero  { grid-template-columns: 1fr !important; }
          .lp-map   { grid-template-columns: 1fr !important; }
          .lp-hide  { display: none !important; }
        }
      `}</style>

      {/* ─────────────── EN-TÊTE ─────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: scrolled ? 'rgba(255,255,255,0.94)' : 'transparent',
        backdropFilter: scrolled ? 'saturate(180%) blur(10px)' : 'none',
        borderBottom: `1px solid ${scrolled ? T.border : 'transparent'}`,
        transition: 'all .22s ease',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px', height: 68,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: T.green,
              display: 'grid', placeItems: 'center', color: '#fff', fontSize: 17, fontWeight: 700 }}>✈</div>
            <div>
              <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 700,
                letterSpacing: '.1em', lineHeight: 1 }}>SIGVEA</div>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: '.14em',
                textTransform: 'uppercase', marginTop: 3 }}>Forces Aériennes Camerounaises</div>
            </div>
          </div>

          <nav className="lp-nav lp-hide" style={{ display: 'flex', gap: 26, fontSize: 13,
            color: T.textSub, fontWeight: 500 }}>
            <a href="#systeme">Le système</a>
            <a href="#circuit">Le circuit</a>
            <a href="#bases">Les bases</a>
            <a href="#flotte">La flotte</a>
          </nav>

          {/* Bouton demandé : « Se connecter », en haut à droite. */}
          <Link to="/login" className="lp-cta" style={{
            padding: '10px 22px', background: T.green, color: '#fff', borderRadius: 8,
            fontSize: 13.5, fontWeight: 700, letterSpacing: '.03em',
            boxShadow: '0 2px 10px rgba(45,106,79,.28)',
          }}>
            Se connecter
          </Link>
        </div>
      </header>

      {/* ─────────────── HÉROS ─────────────── */}
      <section className="lp-sec" style={{ maxWidth: 1180, margin: '0 auto', padding: '54px 24px 64px' }}>
        <div className="lp-hero" style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr',
          gap: 52, alignItems: 'center' }}>

          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 13px', background: T.greenBg, border: `1px solid ${T.greenBorder}`,
              borderRadius: 100, fontSize: 11, fontWeight: 600, color: T.green,
              letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green }} />
              Système d&apos;information de commandement
            </div>

            <h1 style={{ fontFamily: T.display, fontSize: 46, lineHeight: 1.08,
              fontWeight: 700, letterSpacing: '-.01em', marginBottom: 18 }}>
              Système Intégré de Gestion<br />
              des <span style={{ color: T.green }}>Vols et Escales Aériennes</span>
            </h1>

            <p style={{ fontSize: 15.5, lineHeight: 1.72, color: T.textSub, maxWidth: 560,
              marginBottom: 16 }}>
              SIGVEA dématérialise la chaîne du manifeste d&apos;escale, de sa rédaction
              par le chef d&apos;escale jusqu&apos;au visa du commandant de bord. Chaque
              signature est horodatée, chaque version du contenu est figée, et chaque
              document imprimé porte une empreinte vérifiable par lecture de son code.
            </p>

            <p style={{ fontSize: 14, lineHeight: 1.7, color: T.textDim, maxWidth: 560,
              marginBottom: 30 }}>
              Il remplace un circuit papier où la trace d&apos;une correction se perdait
              avec la feuille corrigée.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/login" className="lp-cta" style={{
                padding: '13px 28px', background: T.green, color: '#fff', borderRadius: 8,
                fontSize: 14, fontWeight: 700, boxShadow: '0 3px 14px rgba(45,106,79,.3)' }}>
                Accéder à l&apos;application →
              </Link>
              <a href="#systeme" style={{
                padding: '13px 26px', background: T.bgCard, color: T.textSub,
                border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
                Comprendre le fonctionnement
              </a>
            </div>

            <div style={{ display: 'flex', gap: 30, marginTop: 40, flexWrap: 'wrap' }}>
              {[
                { v: String(BASES.length), l: 'bases aériennes' },
                { v: '5',                  l: 'niveaux de visa' },
                { v: 'SHA-256',            l: 'empreinte de contenu' },
              ].map((s) => (
                <div key={s.l}>
                  <div style={{ fontFamily: T.display, fontSize: 26, fontWeight: 700, color: T.text }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: T.textDim, letterSpacing: '.06em',
                    textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <HeroVisuel />
        </div>
      </section>

      {/* ─────────────── LE SYSTÈME ─────────────── */}
      <section id="systeme" className="lp-sec" style={{ background: T.bgCard,
        borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '62px 24px' }}>
          <TitreSection
            sur="Ce que fait SIGVEA"
            titre="Un manifeste, une chaîne, une preuve"
            sous="Quatre fonctions structurent le système. Elles répondent chacune à une faiblesse précise du circuit papier."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(248px,1fr))',
            gap: 18, marginTop: 34 }}>
            {[
              { i: '📋', t: 'Manifeste dématérialisé', d: "Passagers, matériels, marchandises dangereuses et équipage saisis une seule fois, contrôlés à la saisie contre les capacités réelles de l'aéronef." },
              { i: '✍', t: 'Circuit de visa ordonné', d: "Cinq niveaux, franchis dans l'ordre et jamais deux fois. Un tampon est composé et figé à l'instant de la signature ; une mutation ultérieure ne le modifie pas." },
              { i: '🔒', t: 'Contenu historisé', d: "À chaque étape, le contenu exact visé est figé sous forme d'empreinte. Un manifeste rejeté puis corrigé conserve la trace de ce sur quoi les signataires s'étaient prononcés." },
              { i: '🛰', t: 'Mode dégradé', d: "La saisie reste possible hors ligne. Les brouillons partent en file d'attente et remontent dès le retour de la liaison, sans double saisie." },
            ].map((c) => (
              <div key={c.t} className="lp-card" style={{ background: T.bg,
                border: `1px solid ${T.border}`, borderRadius: 12, padding: '22px 20px' }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>{c.i}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{c.t}</div>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: T.textSub }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── LE CIRCUIT ─────────────── */}
      <section id="circuit" className="lp-sec" style={{ maxWidth: 1180, margin: '0 auto', padding: '62px 24px' }}>
        <TitreSection
          sur="Le circuit de validation"
          titre="Cinq visas, dans un ordre qui ne se contourne pas"
          sous="Chaque niveau ne peut agir que lorsque c'est son tour. Un vol classé sensible franchit en outre un verrou CEMAA avant l'accord du commandant de base."
        />

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${CIRCUIT.length}, 1fr)`,
          gap: 0, marginTop: 38, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 26, left: '10%', right: '10%', height: 2,
            background: `linear-gradient(90deg, ${T.greenBorder}, ${T.green})`, zIndex: 0 }} />
          {CIRCUIT.map((e) => (
            <div key={e.rang} style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 8px' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.bgCard,
                border: `2.5px solid ${T.green}`, color: T.green, display: 'grid',
                placeItems: 'center', margin: '0 auto 14px', fontFamily: T.display,
                fontSize: 21, fontWeight: 700 }}>{e.rang}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{e.code}</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.6, color: T.textDim }}>{e.texte}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 34, padding: '16px 20px', background: T.amberBg,
          border: `1px solid ${T.amberBorder}`, borderRadius: 10, fontSize: 13,
          lineHeight: 1.65, color: T.amber, maxWidth: 900 }}>
          <strong>Planification.</strong> Les vols sont créés par le commandant des
          escadrons aériens (COMEA) et le commandant du groupement de maintenance
          opérationnelle (COMGMO). Le commandant de base conserve son accord dans le
          circuit, mais ne planifie pas — les deux prérogatives sont distinctes.
        </div>
      </section>

      {/* ─────────────── LES BASES ─────────────── */}
      <section id="bases" className="lp-sec" style={{ background: T.bgCard,
        borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '62px 24px' }}>
          <TitreSection
            sur="Implantation"
            titre="Les bases aériennes desservies"
            sous="SIGVEA cloisonne les données par base : un utilisateur ne voit que les vols au départ, à l'arrivée ou en escale sur la sienne."
          />

          <div className="lp-map" style={{ display: 'grid', gridTemplateColumns: '460px 1fr',
            gap: 44, marginTop: 34, alignItems: 'start' }}>

            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14,
              padding: 20, display: 'grid', placeItems: 'center' }}>
              <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} width="100%"
                style={{ maxWidth: 400 }} xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="lpTerre" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={T.greenBg} />
                    <stop offset="100%" stopColor={T.bgAlt} />
                  </linearGradient>
                </defs>

                <path d={CAMEROUN_PATH} fill="url(#lpTerre)" stroke={T.greenBorder} strokeWidth="1.8" />

                {/* Liaisons illustratives entre bases voisines */}
                {BASES.slice(0, -1).map((b, i) => {
                  const a = geoToPixel(b.lat, b.lng);
                  const c = geoToPixel(BASES[i + 1].lat, BASES[i + 1].lng);
                  return (
                    <line key={b.code} x1={a.x} y1={a.y} x2={c.x} y2={c.y}
                      stroke={T.green} strokeWidth="0.9" strokeDasharray="4 6"
                      opacity="0.34" style={{ animation: 'lpGlide 9s linear infinite' }} />
                  );
                })}

                {BASES.map((b) => {
                  const p = geoToPixel(b.lat, b.lng);
                  const on = baseActive === b.code;
                  return (
                    <g key={b.code}
                      onMouseEnter={() => setBaseActive(b.code)}
                      onMouseLeave={() => setBaseActive(null)}
                      style={{ cursor: 'pointer' }}>
                      <circle cx={p.x} cy={p.y} r={13} fill={T.green}
                        style={{ animation: 'lpPulse 3s ease-in-out infinite' }} />
                      <circle cx={p.x} cy={p.y} r={on ? 8 : 6} fill={T.green}
                        stroke="#fff" strokeWidth="2" />
                      <text x={p.x + 12} y={p.y + 4} fontSize="10.5"
                        fontFamily="'Source Code Pro', monospace"
                        fontWeight={on ? 700 : 500}
                        fill={on ? T.green : T.textSub}>{b.code}</text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div style={{ display: 'grid', gap: 9 }}>
              {BASES.map((b) => {
                const on = baseActive === b.code;
                return (
                  <div key={b.code}
                    onMouseEnter={() => setBaseActive(b.code)}
                    onMouseLeave={() => setBaseActive(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 16px', borderRadius: 10,
                      background: on ? T.greenBg : T.bg,
                      border: `1px solid ${on ? T.greenBorder : T.border}`,
                      transition: 'all .15s ease', cursor: 'default',
                    }}>
                    <div style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 700,
                      color: on ? T.green : T.textSub, minWidth: 54 }}>{b.code}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.ville}</div>
                      <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{b.nom}</div>
                    </div>
                    <div style={{ fontSize: 11, color: T.textDim, letterSpacing: '.04em',
                      textTransform: 'uppercase' }}>{b.region}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <p style={{ marginTop: 22, fontSize: 11.5, color: T.textMute, lineHeight: 1.6 }}>
            Tracé et positions à vocation illustrative. Ils ne constituent pas un
            document cartographique et n&apos;engagent aucune représentation officielle
            des implantations.
          </p>
        </div>
      </section>

      {/* ─────────────── LA FLOTTE ─────────────── */}
      <section id="flotte" className="lp-sec" style={{ maxWidth: 1180, margin: '0 auto', padding: '62px 24px' }}>
        <TitreSection
          sur="Moyens aériens"
          titre="Les appareils suivis dans le système"
          sous="Chaque vol est rattaché à un aéronef du référentiel, dont les capacités en places et en fret bornent la saisie du manifeste."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
          gap: 20, marginTop: 34 }}>
          {FLOTTE.map((a) => <CarteAeronef key={a.nom} appareil={a} />)}
        </div>
      </section>

      {/* ─────────────── APPEL FINAL ─────────────── */}
      <section className="lp-sec" style={{ background: T.blue, color: '#fff' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '54px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 28, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: T.display, fontSize: 27, fontWeight: 700, marginBottom: 8 }}>
              Accès réservé au personnel autorisé
            </div>
            <div style={{ fontSize: 14, opacity: .82, lineHeight: 1.65, maxWidth: 640 }}>
              L&apos;authentification à double facteur est obligatoire. Toutes les actions
              sont journalisées. Pour l&apos;ouverture d&apos;un compte, adressez-vous à
              l&apos;administrateur de votre base.
            </div>
          </div>
          <Link to="/login" className="lp-cta" style={{
            padding: '15px 34px', background: '#fff', color: T.blue, borderRadius: 8,
            fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
            Se connecter →
          </Link>
        </div>
      </section>

      {/* ─────────────── PIED DE PAGE ─────────────── */}
      <footer style={{ background: T.bgCard, borderTop: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 24px',
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          fontSize: 11.5, color: T.textDim }}>
          <span>SIGVEA · Forces Aériennes Camerounaises · FAC/DSIC</span>
          <span>Journalisation immuable SHA-256 · Confidentiel Défense</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Sous-composants ───────────────────────────────────────────────────────

function TitreSection({ sur, titre, sous }: { sur: string; titre: string; sous: string }): React.ReactElement {
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.green, letterSpacing: '.14em',
        textTransform: 'uppercase', marginBottom: 10 }}>{sur}</div>
      <h2 style={{ fontFamily: T.display, fontSize: 31, fontWeight: 700, lineHeight: 1.2,
        marginBottom: 12 }}>{titre}</h2>
      <p style={{ fontSize: 14.5, lineHeight: 1.7, color: T.textSub }}>{sous}</p>
    </div>
  );
}

/**
 * Vignette d'aéronef avec repli vectoriel.
 *
 * `onError` bascule sur une silhouette SVG si le fichier est absent : la page
 * ne doit jamais présenter un cadre cassé, y compris avant que les photos
 * n'aient été déposées.
 */
function CarteAeronef({ appareil }: { appareil: Appareil }): React.ReactElement {
  const [erreur, setErreur] = useState(false);

  return (
    <div className="lp-card" style={{ background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 13, overflow: 'hidden' }}>
      <div style={{ height: 168, background: T.bgAlt, position: 'relative',
        display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {!erreur ? (
          <img
            src={`/aeronefs/${appareil.fichier}`}
            alt={appareil.nom}
            onError={() => setErreur(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <SilhouetteAeronef />
        )}
        <div style={{ position: 'absolute', top: 11, left: 11, padding: '4px 10px',
          background: 'rgba(255,255,255,.92)', borderRadius: 100, fontSize: 10,
          fontWeight: 700, color: T.green, letterSpacing: '.06em',
          textTransform: 'uppercase' }}>{appareil.role}</div>
      </div>
      <div style={{ padding: '16px 18px 20px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 7 }}>{appareil.nom}</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.62, color: T.textSub }}>{appareil.note}</div>
      </div>
    </div>
  );
}

function SilhouetteAeronef(): React.ReactElement {
  return (
    <svg viewBox="0 0 240 120" width="72%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M20 62 L96 56 L116 30 L128 30 L122 55 L172 51 L188 34 L198 34 L192 52
               L220 50 L224 60 L220 70 L192 68 L198 86 L188 86 L172 69 L122 65
               L128 90 L116 90 L96 64 L20 58 Z"
        fill={T.borderHi} opacity=".5" />
      <text x="120" y="112" textAnchor="middle" fontSize="9"
        fontFamily="'Source Code Pro', monospace" fill={T.textMute}
        letterSpacing="1.5">PHOTOGRAPHIE À DÉPOSER</text>
    </svg>
  );
}

function HeroVisuel(): React.ReactElement {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: 22, boxShadow: '0 14px 44px rgba(0,0,0,.09)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: T.redLight }} />
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: T.amberLight }} />
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: T.greenLight }} />
          <span style={{ marginLeft: 8, fontSize: 10.5, fontFamily: T.mono, color: T.textDim }}>
            manifeste — circuit de validation
          </span>
        </div>

        <div style={{ display: 'grid', gap: 9 }}>
          {[
            { e: "Chef d'escale",      s: 'VU',      ok: true },
            { e: 'COMESO',             s: 'VU',      ok: true },
            { e: 'COMGMO',             s: 'VU',      ok: true },
            { e: 'COMBASE',            s: 'ACCORD',  ok: false },
            { e: 'Commandant de bord', s: '—',       ok: false },
          ].map((l, i) => (
            <div key={l.e} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
              background: l.ok ? T.greenBg : T.bg,
              border: `1px solid ${l.ok ? T.greenBorder : T.border}`, borderRadius: 9,
            }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%',
                background: l.ok ? T.green : T.bgAlt, color: l.ok ? '#fff' : T.textMute,
                display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>
                {l.ok ? '✓' : i + 1}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600,
                color: l.ok ? T.green : T.textSub }}>{l.e}</div>
              <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700,
                color: l.ok ? T.green : T.textMute }}>{l.s}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, padding: '12px 14px', background: T.bgAlt,
          borderRadius: 9, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 6, background: T.bgCard,
            border: `1px solid ${T.border}`, display: 'grid', placeItems: 'center',
            fontSize: 17 }}>▦</div>
          <div style={{ fontSize: 11, lineHeight: 1.55, color: T.textDim }}>
            Chaque tirage porte un code de contrôle : sa lecture atteste que le
            document présenté correspond bien à un état signé.
          </div>
        </div>
      </div>
    </div>
  );
}