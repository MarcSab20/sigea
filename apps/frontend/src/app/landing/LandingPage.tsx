// apps/frontend/src/app/landing/LandingPage.tsx
//
// ═══════════════════════════════════════════════════════════════════════════
// SIGEA — Vitrine publique
// ═══════════════════════════════════════════════════════════════════════════
//
// Direction artistique : « Le bureau d'ordre ».
// Fond blanc cassé parchemin, repris tel quel du thème applicatif (theme.ts).
// Le manifeste et les strips montent au blanc pur et se détachent du fond par
// l'ombre portée et le filet, non par le contraste de valeur : c'est du papier
// posé sur un sous-main, pas une vignette collée sur un écran.
//
// Deux éléments de signature, tous deux empruntés au métier plutôt qu'inventés :
//
//   ① LE TAMPON.  Dans le héros, un manifeste reçoit ses cinq visas l'un après
//      l'autre, puis son empreinte se compose. C'est littéralement ce que fait
//      le produit, montré au lieu d'être décrit.
//
//   ② LE RACK DE STRIPS.  En tour de contrôle, chaque vol est suivi par un
//      strip cartonné qui descend physiquement de casier en casier, d'un
//      contrôleur au suivant. C'est déjà le circuit de visa de SIGEA. La
//      section « Circuit » reproduit ce rack : le strip descend au rythme du
//      défilement, et le texte suit.
//
// ── Contraintes tenues ────────────────────────────────────────────────────
//   • AUCUNE dépendance nouvelle. `lucide-react` était déjà au package.json ;
//     tout le reste est du CSS natif, IntersectionObserver et rAF.
//   • AUCUN appel réseau : la page s'affiche passerelle éteinte.
//   • Aucune donnée opérationnelle. Vitrine institutionnelle, consultable sans
//     compte ; ni vol ni mouvement réel n'y figure.
//   • `prefers-reduced-motion` et le pilotage clavier sont livrés avec les
//     animations, pas en rattrapage.
//
// ── Vos images ────────────────────────────────────────────────────────────
//   Tous les emplacements sont regroupés dans `landing.data.ts`, en tête de
//   fichier (constante VISUELS + champ `visuel` de chaque appareil). C'est le
//   seul endroit à modifier. Tant qu'un fichier est absent, un repli vectoriel
//   sobre s'affiche : la page ne montre jamais un cadre cassé.

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Stamp, Fingerprint, WifiOff, ArrowRight, ArrowUpRight,
  Lock, RotateCcw, QrCode, PlaneTakeoff, ShieldCheck, ChevronDown,
} from 'lucide-react';

import './landing.css';
import {
  VISUELS, FLOTTE, BASES, CIRCUIT, CAPACITES, CHIFFRES,
  CONTOUR_CM, CADRE, projeter,
  type Visuel, type Appareil, type Etape,
} from './landing.data';
import {
  useRevelation, useProgressionDefilement, useDefilementDepasse,
  useCompteur, useSequence, useFrappe, useMouvementReduit, useMedia,
} from './Uselandingmotion';

/* ═══════════════════════════════════════════════════════════════════════════
   Constantes d'affichage
   ═══════════════════════════════════════════════════════════════════════════ */

/** Empreinte d'exemple, purement illustrative — aucune valeur réelle du
 *  système ne figure sur une page publique. */
const EMPREINTE_DEMO =
  '9f2c41ab7e08d3556c1ea94f0b7728d3a6ef15c284b09d7e3f6a1c8025be4713';

const PERIODE_RADAR = 8; // secondes — doit rester égal à la durée de .lp-beam

const ANCRES = [
  { id: 'systeme', libelle: 'Le système' },
  { id: 'circuit', libelle: 'Le circuit' },
  { id: 'bases',   libelle: 'Les bases' },
  { id: 'flotte',  libelle: 'La flotte' },
];

const ICONES: Record<string, React.ElementType> = {
  manifeste: FileText,
  circuit:   Stamp,
  empreinte: Fingerprint,
  degrade:   WifiOff,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Briques réutilisables
   ═══════════════════════════════════════════════════════════════════════════ */

/** Enveloppe de révélation. `delai` échelonne les enfants d'une même grappe :
 *  60 ms se lit comme une cascade, 0 ms comme un bloc qui saute. */
function Reveler({
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

function Section({
  id, children, fond, style,
}: {
  id?: string;
  children: React.ReactNode;
  fond?: string;
  style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <section
      id={id}
      style={{
        position: 'relative',
        background: fond,
        borderTop: '1px solid var(--line)',
        ...style,
      }}
    >
      <div className="lp-wrap" style={{ paddingBlock: 'clamp(64px, 9vw, 108px)' }}>
        {children}
      </div>
    </section>
  );
}

function TitreSection({
  sur, titre, sous, max = 640,
}: { sur: string; titre: React.ReactNode; sous?: string; max?: number }): React.ReactElement {
  return (
    <header style={{ maxWidth: max }}>
      <Reveler><span className="lp-eyebrow">{sur}</span></Reveler>
      <Reveler delai={70}>
        <h2 className="lp-h2" style={{ marginTop: 18 }}>{titre}</h2>
      </Reveler>
      {sous && (
        <Reveler delai={140}>
          <p className="lp-lead" style={{ marginTop: 16 }}>{sous}</p>
        </Reveler>
      )}
    </header>
  );
}

/** Image avec repli vectoriel. Le repli couvre les deux cas : chemin laissé à
 *  `null` (emplacement volontairement vide) et fichier absent du serveur. */
function VisuelCadre({
  visuel, ratio = '4 / 3', className,
}: { visuel: Visuel; ratio?: string; className?: string }): React.ReactElement {
  const [echec, setEchec] = useState(false);
  const afficher = Boolean(visuel.src) && !echec;

  return (
    <div className={`lp-plate__img ${className ?? ''}`} style={{ aspectRatio: ratio }}>
      {afficher ? (
        <img
          src={visuel.src as string}
          alt={visuel.alt}
          loading="lazy"
          decoding="async"
          onError={() => setEchec(true)}
        />
      ) : (
        <SilhouetteAeronef />
      )}
    </div>
  );
}

function SilhouetteAeronef(): React.ReactElement {
  return (
    <svg viewBox="0 0 240 132" width="66%" aria-hidden="true" role="presentation">
      <path
        d="M20 62 L96 56 L116 30 L128 30 L122 55 L172 51 L188 34 L198 34 L192 52
           L220 50 L224 60 L220 70 L192 68 L198 86 L188 86 L172 69 L122 65
           L128 90 L116 90 L96 64 L20 58 Z"
        fill="var(--line-hi)"
        opacity=".55"
      />
      <text
        x="120" y="118" textAnchor="middle" fontSize="8.5"
        fontFamily="var(--f-data)" fill="var(--fg-mute)" letterSpacing="1.6"
      >
        EMPLACEMENT PHOTO
      </text>
    </svg>
  );
}

/** Monogramme vectoriel, remplacé par VISUELS.insigne si un fichier est fourni. */
function Insigne({ taille = 38 }: { taille?: number }): React.ReactElement {
  const [echec, setEchec] = useState(false);

  if (VISUELS.insigne.src && !echec) {
    return (
      <img
        src={VISUELS.insigne.src}
        alt={VISUELS.insigne.alt}
        width={taille} height={taille}
        style={{ objectFit: 'contain', display: 'block' }}
        onError={() => setEchec(true)}
      />
    );
  }

  return (
    <svg width={taille} height={taille} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="3"
            fill="none" stroke="var(--green-line)" strokeWidth="1.4" />
      <path d="M8 26 L20 9 L32 26 L26 26 L20 17 L14 26 Z" fill="var(--green)" />
      <rect x="8" y="29" width="24" height="2.4" fill="var(--green)" opacity=".55" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ① SIGNATURE — LE MANIFESTE TAMPONNÉ
   ═══════════════════════════════════════════════════════════════════════════ */

function ManifesteTamponne(): React.ReactElement {
  const { ref, vu } = useRevelation<HTMLDivElement>({ seuil: 0.3 });
  const reduit = useMouvementReduit();

  // 5 visas + 1 case pour le code de contrôle = 6 cellules, grille 3 × 2.
  const { index, rejouer, termine } = useSequence(6, { actif: vu, intervalle: 560, retard: 800 });
  const empreinte = useFrappe(EMPREINTE_DEMO, termine, 12);

  // Inclinaisons fixes et non aléatoires : elles doivent rester identiques
  // d'un rendu à l'autre, sinon le document « bouge » au moindre re-render.
  const inclinaisons = ['-3deg', '2.4deg', '-1.8deg', '3.1deg', '-2.6deg'];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="lp-doc">
        {!reduit && vu && <span className="lp-scan" aria-hidden="true" />}

        <div className="lp-doc__head">
          <span className="lp-doc__title">Manifeste d&apos;escale</span>
          <span className="lp-doc__ref">SPÉCIMEN · NON OPÉRATIONNEL</span>
        </div>

        <div style={{ marginTop: 4 }}>
          {[
            ['Aéronef',   'Transport tactique'],
            ['Itinéraire', 'BA 101 → BA 301 → BA 401'],
            ['Embarqués', '38 passagers · 4 200 kg'],
          ].map(([k, v]) => (
            <div className="lp-doc__row" key={k}>
              <span className="lp-doc__k">{k}</span>
              <span className="lp-doc__v">{v}</span>
            </div>
          ))}
        </div>

        <div className="lp-stamps" role="list" aria-label="Visas apposés">
          {CIRCUIT.map((e, i) => (
            <div
              key={e.rang}
              role="listitem"
              className={`lp-tampon${i === 4 ? ' lp-tampon--rouge' : ''}`}
              data-on={index >= i ? '1' : '0'}
              style={{
                '--lp-delay': '0ms',
                '--tilt': inclinaisons[i],
              } as React.CSSProperties}
            >
              <span className="lp-tampon__t">{e.statut}</span>
              <span className="lp-tampon__s">{e.role}</span>
            </div>
          ))}

          {/* 6ᵉ cellule : le code de contrôle porté par le tirage papier */}
          <div
            className="lp-tampon"
            data-on={index >= 5 ? '1' : '0'}
            style={{ '--tilt': '1.6deg', color: 'var(--green-deep)' } as React.CSSProperties}
          >
            <QrCode size={22} strokeWidth={1.6} />
            <span className="lp-tampon__s">Code de contrôle</span>
          </div>
        </div>

        <div className="lp-hash" aria-live="polite">
          <span style={{ opacity: .58, letterSpacing: '.1em' }}>EMPREINTE SHA-256 · </span>
          {empreinte}
          {termine && empreinte.length < EMPREINTE_DEMO.length && (
            <span className="lp-caret" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Commande de relecture — discrète, hors du flux de lecture */}
      {!reduit && (
        <button
          type="button"
          onClick={rejouer}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            marginTop: 16, padding: '6px 2px',
            fontFamily: 'var(--f-data)', fontSize: 11, letterSpacing: '.1em',
            color: 'var(--fg-dim)', textTransform: 'uppercase',
          }}
        >
          <RotateCcw size={13} strokeWidth={1.8} />
          Rejouer la séquence
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HÉROS
   ═══════════════════════════════════════════════════════════════════════════ */

function Chiffre({ valeur, suffixe, libelle }:
{ valeur: number; suffixe: string; libelle: string }): React.ReactElement {
  const { ref, vu } = useRevelation<HTMLDivElement>({ seuil: 0.6 });
  const n = useCompteur(valeur, vu);

  return (
    <div ref={ref}>
      <div style={{
        fontFamily: 'var(--f-display)', fontSize: 44, fontWeight: 600,
        lineHeight: 1, color: 'var(--fg)',
      }}>
        {n}<span style={{ fontSize: 20, color: 'var(--green)' }}>{suffixe}</span>
      </div>
      <div className="lp-small" style={{
        marginTop: 8, fontFamily: 'var(--f-data)', fontSize: 10.5,
        letterSpacing: '.11em', textTransform: 'uppercase',
      }}>
        {libelle}
      </div>
    </div>
  );
}

function Heros(): React.ReactElement {
  const [allume, setAllume] = useState(false);
  const [fondEchec, setFondEchec] = useState(false);
  const compact = useMedia('(max-width: 900px)');

  // Lever de rideau au montage : une frame de délai suffit à garantir que la
  // transition part bien de l'état fermé.
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setAllume(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const afficherFond = Boolean(VISUELS.hero.src) && !fondEchec;

  return (
    <section className={allume ? 'is-lit' : ''} style={{ position: 'relative', overflow: 'hidden' }}>
      {/* ── Ambiance ── */}
      <div className="lp-ambient" aria-hidden="true">
        {afficherFond && (
          <img
            src={VISUELS.hero.src as string}
            alt=""
            onError={() => setFondEchec(true)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: .16,
              mixBlendMode: 'multiply',
              filter: 'grayscale(.45) contrast(1.05)',
              maskImage: 'linear-gradient(180deg, #000 0%, transparent 88%)',
              WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 88%)',
            }}
          />
        )}
        <div className="lp-grid" />
        <div className="lp-lamp" />
        <div className="lp-sweep" />
        <TrajectoiresFond />
      </div>

      <div className="lp-wrap" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : '1.06fr .94fr',
          gap: compact ? 52 : 62,
          alignItems: 'center',
          paddingBlock: compact ? '48px 72px' : '76px 104px',
        }}>
          {/* ── Colonne texte ── */}
          <div>
            <div className="lp-curtain" style={{ '--lp-delay': '0ms' } as React.CSSProperties}>
              <span className="lp-eyebrow" style={{ display: 'inline-flex' }}>
                Système d&apos;information de commandement
              </span>
            </div>

            <h1 className="lp-h1" style={{ marginTop: 24 }}>
              {['Le manifeste', "d'escale", 'ne se perd'].map((ligne, i) => (
                <span className="lp-curtain" key={ligne}
                      style={{ '--lp-delay': `${120 + i * 90}ms` } as React.CSSProperties}>
                  <span>{ligne}</span>
                </span>
              ))}
              <span className="lp-curtain"
                    style={{ '--lp-delay': '390ms' } as React.CSSProperties}>
                <span style={{ color: 'var(--green)' }}>plus en route.</span>
              </span>
            </h1>

            <Reveler delai={520}>
              <p className="lp-lead" style={{ marginTop: 26, maxWidth: 530 }}>
                SIGEA dématérialise la chaîne du manifeste d&apos;escale, de sa rédaction
                par le chef d&apos;escale jusqu&apos;au visa du commandant de bord. Chaque
                signature est horodatée, chaque version du contenu est figée, et chaque
                tirage porte une empreinte vérifiable.
              </p>
            </Reveler>

            <Reveler delai={600}>
              <p className="lp-body" style={{ marginTop: 14, maxWidth: 530, color: 'var(--fg-dim)' }}>
                Il remplace un circuit papier où la trace d&apos;une correction
                disparaissait avec la feuille corrigée.
              </p>
            </Reveler>

            <Reveler delai={680}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 34 }}>
                <Link to="/login" className="lp-btn lp-btn--primary">
                  Accéder à l&apos;application <ArrowRight size={17} strokeWidth={2.2} />
                </Link>
                <a href="#circuit" className="lp-btn lp-btn--ghost">
                  Voir le circuit <ChevronDown size={17} strokeWidth={2.2} />
                </a>
              </div>
            </Reveler>

            <Reveler delai={760}>
              <div style={{
                display: 'flex', gap: 44, flexWrap: 'wrap', marginTop: 52,
                paddingTop: 30, borderTop: '1px solid var(--line)',
              }}>
                {CHIFFRES.map((c) => <Chiffre key={c.libelle} {...c} />)}
              </div>
            </Reveler>
          </div>

          {/* ── Colonne signature ── */}
          <Reveler delai={compact ? 0 : 420} variante="scale">
            <ManifesteTamponne />
          </Reveler>
        </div>
      </div>
    </section>
  );
}

/** Arcs de trajectoire en fond de héros — purement décoratifs, très discrets. */
function TrajectoiresFond(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .5 }}
    >
      {[
        'M -60 520 C 260 400, 520 470, 1260 220',
        'M -60 640 C 340 560, 700 610, 1260 380',
        'M -60 400 C 200 300, 640 340, 1260 110',
      ].map((d, i) => (
        <path
          key={d} d={d} fill="none"
          stroke="var(--green)" strokeWidth="1" opacity={.22 - i * .05}
          className="lp-trace"
          style={{ animationDelay: `${i * -3.5}s` }}
        />
      ))}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BANDEAU DÉFILANT
   ═══════════════════════════════════════════════════════════════════════════ */

function BandeauBases(): React.ReactElement {
  // Piste dupliquée : la boucle translate de -50 %, la reprise est invisible.
  const piste = [...BASES, ...BASES];

  return (
    <div className="lp-rail" aria-hidden="true">
      <div className="lp-rail__track">
        {piste.map((b, i) => (
          <span className="lp-rail__item" key={`${b.code}-${i}`}>
            <b>{b.code}</b> {b.ville}
            <span className="lp-rail__sep">/</span>
            {b.region}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAPACITÉS
   ═══════════════════════════════════════════════════════════════════════════ */

function SectionCapacites(): React.ReactElement {
  return (
    <Section id="systeme" fond="var(--ink-900)">
      <TitreSection
        sur="Ce que fait SIGEA"
        titre={<>Un manifeste,<br />une chaîne, une preuve</>}
        sous="Quatre fonctions structurent le système. Chacune répond à une faiblesse précise du circuit papier — aucune n'est là pour faire nombre."
      />

      <div className="lp-cards" style={{ marginTop: 52 }}>
        {CAPACITES.map((c, i) => {
          const Ico = ICONES[c.cle] ?? FileText;
          return (
            <Reveler key={c.cle} delai={i * 70} className="lp-card">
              <span className="lp-card__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="lp-card__ico"><Ico size={20} strokeWidth={1.7} /></span>
              <h3 className="lp-h3" style={{ marginBottom: 12 }}>{c.titre}</h3>
              <p className="lp-body">{c.texte}</p>
            </Reveler>
          );
        })}
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ② SIGNATURE — LE RACK DE STRIPS
   ═══════════════════════════════════════════════════════════════════════════ */

const HAUTEUR_CASIER = 66;
const GOUTTIERE = 10;

function SectionCircuit(): React.ReactElement {
  const reduit = useMouvementReduit();
  const compact = useMedia('(max-width: 900px)');
  const pilotage = !reduit && !compact;   // le rack collant n'a de sens qu'au grand écran

  const { ref, progression } = useProgressionDefilement<HTMLDivElement>(pilotage);

  const index = useMemo(() => {
    if (!pilotage) return CIRCUIT.length - 1;
    return Math.min(CIRCUIT.length - 1, Math.floor(progression * CIRCUIT.length));
  }, [progression, pilotage]);

  return (
    <section
      id="circuit"
      ref={ref}
      style={{
        position: 'relative',
        borderTop: '1px solid var(--line)',
        background: 'var(--ink-850)',
        // Course de défilement : une pleine hauteur d'écran par étape, plus la
        // hauteur de la scène elle-même.
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
            {/* ── Le rack ── */}
            <div>
              {pilotage && (
                <div style={{ marginBottom: 26 }}>
                  <span className="lp-eyebrow">Circuit de validation</span>
                  <div className="lp-progress" style={{ marginTop: 16 }}>
                    <div
                      className="lp-progress__bar"
                      style={{ '--p': progression } as React.CSSProperties}
                    />
                  </div>
                </div>
              )}

              <div className="lp-rack__slots">
                {CIRCUIT.map((e, i) => (
                  <div
                    key={e.rang}
                    className="lp-slot"
                    data-state={i < index ? 'done' : i === index ? 'active' : 'todo'}
                  >
                    <span className="lp-slot__n">{e.rang}</span>
                    <span className="lp-slot__lbl">{e.role}</span>
                    <span className="lp-slot__st">{i <= index ? e.statut : 'EN ATTENTE'}</span>
                  </div>
                ))}

                {/* Le strip descend de casier en casier. Pas fixe : hauteur de
                    casier + gouttière — aucun calcul de layout au défilement. */}
                {pilotage && (
                  <div
                    className="lp-strip"
                    style={{
                      transform: `translate3d(0, ${index * (HAUTEUR_CASIER + GOUTTIERE)}px, 0)`,
                    }}
                    aria-hidden="true"
                  >
                    <PlaneTakeoff size={18} strokeWidth={1.9} />
                    <span className="lp-strip__id">MFT-0417</span>
                    <span className="lp-strip__rte">101 → 401</span>
                    <span className="lp-strip__tag">
                      <Stamp size={11} strokeWidth={2.2} />
                      {CIRCUIT[index].statut}
                    </span>
                  </div>
                )}
              </div>

              {pilotage && (
                <p className="lp-small" style={{ marginTop: 22, maxWidth: 460 }}>
                  Le strip descend d&apos;un casier au suivant, comme en tour de contrôle.
                  Ici, il ne remonte jamais tout seul : chaque passage est horodaté.
                </p>
              )}
            </div>

            {/* ── Les volets de texte ── */}
            <div className="lp-rack__panes">
              {CIRCUIT.map((e, i) => (
                <VoletEtape key={e.rang} etape={e} actif={!pilotage || i === index} statique={!pilotage} />
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
    <article
      className="lp-pane"
      data-on={actif ? '1' : '0'}
      style={statique ? { marginBottom: 34 } : undefined}
    >
      <span className="lp-data" style={{ color: 'var(--green)' }}>
        ÉTAPE {String(etape.rang).padStart(2, '0')} / {String(CIRCUIT.length).padStart(2, '0')}
      </span>
      <h3 className="lp-h2" style={{ marginTop: 14, fontSize: 'clamp(26px, 3.2vw, 38px)' }}>
        {etape.titre}
      </h3>
      <p className="lp-lead" style={{ marginTop: 18, maxWidth: 480 }}>{etape.texte}</p>
      <p style={{
        marginTop: 20, paddingLeft: 16, maxWidth: 480,
        borderLeft: '2px solid var(--green-line)',
        fontFamily: 'var(--f-data)', fontSize: 11.5, lineHeight: 1.7,
        color: 'var(--fg-dim)',
      }}>
        {etape.garde}
      </p>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BASES — CARTE BALAYÉE
   ═══════════════════════════════════════════════════════════════════════════ */

function SectionBases(): React.ReactElement {
  const [survolee, setSurvolee] = useState<string | null>(null);
  const { ref, vu } = useRevelation<HTMLDivElement>({ seuil: 0.2 });

  const contour = useMemo(
    () => CONTOUR_CM.map(([la, ln]) => projeter(la, ln))
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ') + ' Z',
    [],
  );

  const centre = { x: CADRE.w / 2, y: CADRE.h / 2 };

  return (
    <Section id="bases" fond="var(--ink-900)">
      <TitreSection
        sur="Implantation"
        titre="Les bases aériennes desservies"
        sous="SIGEA cloisonne les données par base : un utilisateur ne voit que les vols au départ, à l'arrivée ou en escale sur la sienne. Le cloisonnement est appliqué côté serveur, en base, et non par masquage d'écran."
      />

      <div ref={ref} className={`lp-map ${vu ? 'is-in' : ''}`} style={{ marginTop: 52 }}>
        {/* ── Carte ── */}
        <Reveler variante="left" className="lp-map__box">
          {/* Faisceau : div circulaire en superposition, indépendante du SVG */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', top: '50%', left: '50%',
              width: '150%', aspectRatio: '1',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background:
                'conic-gradient(from 0deg, rgba(45,106,79,.14) 0deg, rgba(45,106,79,.03) 30deg, transparent 70deg, transparent 360deg)',
              maskImage: 'radial-gradient(circle, #000 0%, #000 52%, transparent 72%)',
              WebkitMaskImage: 'radial-gradient(circle, #000 0%, #000 52%, transparent 72%)',
              pointerEvents: 'none',
            }}
            className="lp-beam"
          />

          <svg
            viewBox={`0 0 ${CADRE.w} ${CADRE.h}`}
            width="100%"
            style={{ position: 'relative', display: 'block' }}
            role="img"
            aria-label="Carte schématique du Cameroun et de ses bases aériennes"
          >
            <defs>
              <linearGradient id="lpTerre" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="rgba(45,106,79,.12)" />
                <stop offset="100%" stopColor="rgba(45,106,79,.03)" />
              </linearGradient>
            </defs>

            {/* Cercles de portée */}
            {[0.32, 0.58, 0.84].map((f) => (
              <circle key={f} cx={centre.x} cy={centre.y} r={CADRE.h * f * 0.5}
                      fill="none" stroke="var(--line)" strokeWidth=".8" opacity=".55" />
            ))}

            {/* Contour — tracé progressif à l'entrée dans le champ */}
            <path
              d={contour}
              fill="url(#lpTerre)"
              stroke="var(--green-line)"
              strokeWidth="1.6"
              strokeLinejoin="round"
              className="lp-draw"
              style={{ '--len': 2400 } as React.CSSProperties}
            />

            {/* Liaisons entre bases successives */}
            {BASES.slice(0, -1).map((b, i) => {
              const a = projeter(b.lat, b.lng);
              const c = projeter(BASES[i + 1].lat, BASES[i + 1].lng);
              return (
                <line key={b.code} x1={a.x} y1={a.y} x2={c.x} y2={c.y}
                      stroke="var(--green)" strokeWidth=".8" strokeDasharray="3 6"
                      opacity=".3" className="lp-trace"
                      style={{ animationDelay: `${i * -1.6}s` }} />
              );
            })}

            {/* Bases : le ping est calé sur le passage du faisceau */}
            {BASES.map((b) => {
              const p = projeter(b.lat, b.lng);
              const on = survolee === b.code;

              // Angle horaire depuis le haut, comme le conic-gradient CSS.
              const angle = (Math.atan2(p.x - centre.x, centre.y - p.y) * 180) / Math.PI;
              const phase = ((angle + 360) % 360) / 360 * PERIODE_RADAR - PERIODE_RADAR;

              return (
                <g key={b.code}
                   onMouseEnter={() => setSurvolee(b.code)}
                   onMouseLeave={() => setSurvolee(null)}
                   style={{ cursor: 'pointer' }}>
                  <circle
                    cx={p.x} cy={p.y} r={5}
                    fill="var(--green)"
                    className="lp-ping"
                    style={{ '--lp-phase': `${phase.toFixed(2)}s` } as React.CSSProperties}
                  />
                  <circle
                    cx={p.x} cy={p.y} r={4}
                    fill="var(--green)" stroke="var(--ink-900)" strokeWidth="1.4"
                    className="lp-dot"
                    style={{ transform: on ? 'scale(1.45)' : 'scale(1)' }}
                  />
                  <text x={p.x + 10} y={p.y + 3.6} fontSize="9.5"
                        fontFamily="var(--f-data)" letterSpacing=".5"
                        fill={on ? 'var(--green)' : 'var(--fg-dim)'}
                        style={{ transition: 'fill .22s ease' }}>
                    {b.code}
                  </text>
                </g>
              );
            })}
          </svg>
        </Reveler>

        {/* ── Liste ── */}
        <div style={{ display: 'grid', gap: 8 }}>
          {BASES.map((b, i) => (
            <Reveler
              key={b.code}
              delai={i * 55}
              variante="right"
              className={`lp-base ${survolee === b.code ? 'is-on' : ''}`}
              onMouseEnter={() => setSurvolee(b.code)}
              onMouseLeave={() => setSurvolee(null)}
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
            Tracé et positions schématiques, à vocation illustrative. Ils ne constituent
            pas un document cartographique et n&apos;engagent aucune représentation
            officielle des frontières ni des implantations.
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLOTTE
   ═══════════════════════════════════════════════════════════════════════════ */

function SectionFlotte(): React.ReactElement {
  return (
    <Section id="flotte" fond="var(--ink-850)">
      <TitreSection
        sur="Moyens aériens"
        titre="Les appareils suivis dans le système"
        sous="Chaque vol est rattaché à un aéronef du référentiel, dont les capacités en places et en fret bornent la saisie du manifeste."
      />

      <div className="lp-fleet" style={{ marginTop: 52 }}>
        {FLOTTE.map((a: Appareil, i) => (
          <Reveler key={a.nom} delai={i * 80} className="lp-plate">
            <div style={{ position: 'relative' }}>
              <VisuelCadre visuel={a.visuel} />
              <span className="lp-plate__veil" aria-hidden="true" />
              <span className="lp-plate__role">{a.role}</span>
            </div>
            <div className="lp-plate__body">
              <h3 className="lp-h3" style={{ fontSize: 18, marginBottom: 10 }}>{a.nom}</h3>
              <p className="lp-body" style={{ fontSize: 13.5 }}>{a.note}</p>
            </div>
          </Reveler>
        ))}
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PREUVE
   ═══════════════════════════════════════════════════════════════════════════ */

function SectionPreuve(): React.ReactElement {
  const compact = useMedia('(max-width: 900px)');

  return (
    <Section fond="var(--ink-900)">
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : '.92fr 1.08fr',
        gap: compact ? 38 : 60, alignItems: 'center',
      }}>
        <Reveler variante="left" className="lp-plate" style={{ borderRadius: 3 }}>
          <VisuelCadre visuel={VISUELS.preuve} ratio="5 / 4" />
        </Reveler>

        <div>
          <Reveler><span className="lp-eyebrow">Vérifiabilité</span></Reveler>
          <Reveler delai={70}>
            <h2 className="lp-h2" style={{ marginTop: 18 }}>
              Une feuille imprimée<br />peut désormais être opposée
            </h2>
          </Reveler>
          <Reveler delai={140}>
            <p className="lp-lead" style={{ marginTop: 18, maxWidth: 520 }}>
              Le tirage papier reste indispensable en escale. SIGEA ne cherche pas à le
              supprimer : il lui adjoint un code de contrôle. Sa lecture compare
              l&apos;empreinte imprimée à celle enregistrée et répond par oui ou par non.
            </p>
          </Reveler>

          <div style={{ display: 'grid', gap: 12, marginTop: 30 }}>
            {[
              { I: Fingerprint, t: 'Empreinte par version',
                d: "Le contenu exact visé à chaque étape est figé. Une correction crée une version, elle n'écrase pas la précédente." },
              { I: ShieldCheck, t: 'Journal non réinscriptible',
                d: "Chaque action — visa, rejet, consultation d'archive — est journalisée avec son auteur et son horodatage." },
              { I: Lock, t: 'Double facteur obligatoire',
                d: "Aucun accès sans second facteur. Les rôles d'autorité centrale sont cloisonnés jusque dans les clés." },
            ].map((r, i) => (
              <Reveler key={r.t} delai={200 + i * 70}>
                <div style={{
                  display: 'flex', gap: 15, padding: '15px 17px',
                  border: '1px solid var(--line)', borderRadius: 2,
                  background: 'var(--ink-850)',
                }}>
                  <span style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }}>
                    <r.I size={19} strokeWidth={1.7} />
                  </span>
                  <span>
                    <span style={{
                      display: 'block', fontFamily: 'var(--f-display)', fontSize: 16,
                      fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase',
                    }}>{r.t}</span>
                    <span className="lp-body" style={{ display: 'block', marginTop: 6, fontSize: 13.5 }}>
                      {r.d}
                    </span>
                  </span>
                </div>
              </Reveler>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPEL FINAL + PIED DE PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

function AppelFinal(): React.ReactElement {
  return (
    <section className="lp-final">
      <div className="lp-ambient" aria-hidden="true"><div className="lp-grid" /></div>

      <div className="lp-wrap" style={{
        position: 'relative', zIndex: 1,
        paddingBlock: 'clamp(56px, 8vw, 92px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 32, flexWrap: 'wrap',
      }}>
        <Reveler>
          <h2 className="lp-h2" style={{ fontSize: 'clamp(28px, 3.6vw, 42px)' }}>
            Accès réservé au<br />personnel autorisé
          </h2>
          <p className="lp-body" style={{ marginTop: 16, maxWidth: 520 }}>
            L&apos;authentification à double facteur est obligatoire et toutes les actions
            sont journalisées. Pour l&apos;ouverture d&apos;un compte, adressez-vous à
            l&apos;administrateur de votre base.
          </p>
        </Reveler>

        <Reveler delai={120}>
          <Link to="/login" className="lp-btn lp-btn--paper" style={{ padding: '16px 30px' }}>
            Se connecter <ArrowUpRight size={18} strokeWidth={2.2} />
          </Link>
        </Reveler>
      </div>
    </section>
  );
}

function PiedDePage(): React.ReactElement {
  return (
    <footer className="lp-foot">
      <div className="lp-wrap" style={{
        paddingBlock: 30,
        display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <Insigne taille={28} />
          <span className="lp-data" style={{ color: 'var(--fg-dim)', fontSize: 11 }}>
            SIGEA · FORCES AÉRIENNES CAMEROUNAISES · FAC/DSIC
          </span>
        </span>
        <span className="lp-data" style={{ color: 'var(--fg-mute)', fontSize: 11 }}>
          JOURNALISATION SHA-256 · CONFIDENTIEL DÉFENSE
        </span>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EN-TÊTE
   ═══════════════════════════════════════════════════════════════════════════ */

function EnTete(): React.ReactElement {
  const colle = useDefilementDepasse(28);

  return (
    <header className={`lp-header ${colle ? 'is-stuck' : ''}`}>
      <div className="lp-wrap lp-header__in">
        <a href="#top" style={{ display: 'inline-flex', alignItems: 'center', gap: 13 }}>
          <Insigne taille={36} />
          <span>
            <span style={{
              display: 'block', fontFamily: 'var(--f-display)', fontSize: 22,
              fontWeight: 700, letterSpacing: '.14em', lineHeight: 1,
            }}>SIGEA</span>
            <span className="lp-data" style={{
              display: 'block', marginTop: 4, fontSize: 8.5,
              letterSpacing: '.16em', color: 'var(--fg-dim)',
            }}>
              FORCES AÉRIENNES CAMEROUNAISES
            </span>
          </span>
        </a>

        <nav className="lp-nav lp-hide-sm" aria-label="Sections de la page">
          {ANCRES.map((a) => (
            <a key={a.id} href={`#${a.id}`}>{a.libelle}</a>
          ))}
        </nav>

        <Link to="/login" className="lp-btn lp-btn--primary" style={{ padding: '10px 20px', fontSize: 15 }}>
          Se connecter
        </Link>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function LandingPage(): React.ReactElement {
  return (
    <div className="lp-root" id="top">
      <EnTete />
      <main>
        <Heros />
        <BandeauBases />
        <SectionCapacites />
        <SectionCircuit />
        <SectionBases />
        <SectionFlotte />
        <SectionPreuve />
        <AppelFinal />
      </main>
      <PiedDePage />
    </div>
  );
}