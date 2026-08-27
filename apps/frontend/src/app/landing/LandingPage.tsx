// apps/frontend/src/app/landing/LandingPage.tsx
//
// ═══════════════════════════════════════════════════════════════════════════
// SIGEA — Vitrine publique
// ═══════════════════════════════════════════════════════════════════════════
//
// Direction artistique : « Le bureau d'ordre ».
// Fond blanc cassé parchemin, repris tel quel du thème applicatif (theme.ts).
// Le manifeste et les strips montent au blanc pur et se détachent du fond par
// l'ombre portée et le filet, non par le contraste de valeur : du papier posé
// sur un sous-main, pas une vignette collée sur un écran.
//
// ── Découpage ─────────────────────────────────────────────────────────────
//   LandingPage.tsx   composition, en-tête, héros, appel final, pied de page
//   Manifeste.tsx     ① signature : le manifeste tamponné, en boucle
//   Fonctions.tsx     les quatre fonctions et leurs démonstrations animées
//   Circuit.tsx       ② signature : le rack de strips
//   Bases.tsx         la carte réelle et le maillage de liaisons
//   Flotte.tsx        les appareils et leur fenêtre d'exploration 360°
//   ui.tsx            briques partagées (révélation, sections, modale)
//   landing.data.ts   TOUT le contenu éditorial et les chemins de médias
//   cameroon.geo.ts   géométrie du Cameroun, par région
//   landing.css       jetons, animations, adaptation, mouvement réduit
//
// ── Contraintes tenues ────────────────────────────────────────────────────
//   • AUCUNE dépendance nouvelle. `lucide-react` était déjà au package.json.
//   • AUCUN appel réseau : la page s'affiche passerelle éteinte.
//   • Aucune donnée opérationnelle : ni vol ni mouvement réel n'y figure.
//   • `prefers-reduced-motion` et le pilotage clavier sont livrés avec les
//     animations, pas en rattrapage.

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ChevronDown, Fingerprint, ShieldCheck, Lock } from 'lucide-react';

import './landing.css';
import { VISUELS, BASES, CHIFFRES } from './landing.data';
import {
  useDefilementDepasse, useCompteur, useRevelation, useMedia,
} from './Uselandingmotion';
import { Reveler, Section, TitreSection, VisuelCadre, Insigne } from './ui';

import ManifesteTamponne from './Manifeste';
import SectionFonctions from './Fonctions';
import SectionCircuit from './Circuit';
import SectionBases from './Bases';
import SectionFlotte from './Flotte';

const ANCRES = [
  { id: 'systeme', libelle: 'Le système' },
  { id: 'circuit', libelle: 'Le circuit' },
  { id: 'bases',   libelle: 'Les bases' },
  { id: 'flotte',  libelle: 'La flotte' },
];

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
            }}>FORCES AÉRIENNES CAMEROUNAISES</span>
          </span>
        </a>

        <nav className="lp-nav lp-hide-sm" aria-label="Sections de la page">
          {ANCRES.map((a) => <a key={a.id} href={`#${a.id}`}>{a.libelle}</a>)}
        </nav>

        <Link to="/login" className="lp-btn lp-btn--primary"
              style={{ padding: '10px 20px', fontSize: 15 }}>
          Se connecter
        </Link>
      </div>
    </header>
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
      }}>{libelle}</div>
    </div>
  );
}

/** Arcs de trajectoire en fond de héros — décoratifs, très discrets. */
function TrajectoiresFond(): React.ReactElement {
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true"
         style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .5 }}>
      {[
        'M -60 520 C 260 400, 520 470, 1260 220',
        'M -60 640 C 340 560, 700 610, 1260 380',
        'M -60 400 C 200 300, 640 340, 1260 110',
      ].map((d, i) => (
        <path key={d} d={d} fill="none" stroke="var(--green)" strokeWidth="1"
              opacity={.22 - i * .05} className="lp-trace"
              style={{ animationDelay: `${i * -3.5}s` }} />
      ))}
    </svg>
  );
}

function Heros(): React.ReactElement {
  const [allume, setAllume] = useState(false);
  const [fondEchec, setFondEchec] = useState(false);
  const compact = useMedia('(max-width: 900px)');

  // Lever de rideau au montage : une frame de délai garantit que la transition
  // part bien de l'état fermé.
  useEffect(() => {
    const id = requestAnimationFrame(() => setAllume(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const afficherFond = Boolean(VISUELS.hero.src) && !fondEchec;

  return (
    <section className={allume ? 'is-lit' : ''} style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="lp-ambient" aria-hidden="true">
        {afficherFond && (
          <img src={VISUELS.hero.src as string} alt="" onError={() => setFondEchec(true)}
               style={{
                 position: 'absolute', inset: 0, width: '100%', height: '100%',
                 objectFit: 'cover', opacity: .16, mixBlendMode: 'multiply',
                 filter: 'grayscale(.45) contrast(1.05)',
                 maskImage: 'linear-gradient(180deg, #000 0%, transparent 88%)',
                 WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 88%)',
               }} />
        )}
        <div className="lp-grid" />
        <div className="lp-lamp" />
        <div className="lp-sweep" />
        <TrajectoiresFond />
      </div>

      <div className="lp-wrap" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'grid',
          // Le manifeste occupe désormais la part la plus large : il est la
          // démonstration, le texte n'est que la légende.
          gridTemplateColumns: compact ? '1fr' : '.88fr 1.12fr',
          gap: compact ? 52 : 58,
          alignItems: 'center',
          paddingBlock: compact ? '48px 72px' : '72px 100px',
        }}>
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
              <span className="lp-curtain" style={{ '--lp-delay': '390ms' } as React.CSSProperties}>
                <span style={{ color: 'var(--green)' }}>plus en route.</span>
              </span>
            </h1>

            <Reveler delai={520}>
              <p className="lp-lead" style={{ marginTop: 26, maxWidth: 480 }}>
                SIGEA dématérialise la chaîne du manifeste d&apos;escale, de sa rédaction
                par le chef d&apos;escale jusqu&apos;au visa du commandant de bord. Chaque
                signature est horodatée, chaque version du contenu est figée, et chaque
                tirage porte une empreinte vérifiable.
              </p>
            </Reveler>

            <Reveler delai={600}>
              <p className="lp-body" style={{ marginTop: 14, maxWidth: 480, color: 'var(--fg-dim)' }}>
                Il remplace un circuit papier où la trace d&apos;une correction
                disparaissait avec la feuille corrigée.
              </p>
            </Reveler>

            <Reveler delai={680}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 32 }}>
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
                display: 'flex', gap: 40, flexWrap: 'wrap', marginTop: 48,
                paddingTop: 28, borderTop: '1px solid var(--line)',
              }}>
                {CHIFFRES.map((c) => <Chiffre key={c.libelle} {...c} />)}
              </div>
            </Reveler>
          </div>

          <Reveler delai={compact ? 0 : 420} variante="scale">
            <ManifesteTamponne />
          </Reveler>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BANDEAU DÉFILANT — le rail des bases
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
   PREUVE
   ═══════════════════════════════════════════════════════════════════════════ */

function SectionPreuve(): React.ReactElement {
  const compact = useMedia('(max-width: 900px)');

  return (
    <Section fond="var(--ink-900)">
      <div style={{
        display: 'grid', gridTemplateColumns: compact ? '1fr' : '.92fr 1.08fr',
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
                  border: '1px solid var(--line)', borderRadius: 2, background: 'var(--ink-850)',
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
        position: 'relative', zIndex: 1, paddingBlock: 'clamp(56px, 8vw, 92px)',
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
        paddingBlock: 30, display: 'flex', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', alignItems: 'center',
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
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function LandingPage(): React.ReactElement {
  return (
    <div className="lp-root" id="top">
      <EnTete />
      <main>
        <Heros />
        <BandeauBases />
        <SectionFonctions />
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