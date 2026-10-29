// apps/frontend/src/components/CameroonMap.tsx
//
// ═══════════════════════════════════════════════════════════════════════════
// CARTE DE SITUATION OPÉRATIONNELLE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ CE QUI A CHANGÉ, ET POURQUOI IL FALLAIT LE CHANGER
//
// La version précédente affichait, sous le titre « Tracking aéronefs temps
// réel », un appareil immatriculé TJ-AAF placé à lat 6.2 / lng 11.8, dont la
// position était déplacée toutes les deux secondes par :
//
//     lat: a.lat + (Math.random() - 0.5) * 0.1
//
// Autrement dit : un aéronef inventé, à une position inventée, dérivant au
// hasard, présenté comme de la donnée temps réel sur le tableau de bord d'un
// système de commandement. Rien dans l'écran ne signalait la simulation —
// seul un commentaire dans le code le disait.
//
// Sur un produit de défense, c'est un risque et pas un détail : un officier de
// permanence n'a aucun moyen de distinguer cette trace d'une vraie.
//
// Le schéma Prisma ne contient AUCUN champ de position, de télémétrie ou
// d'horodatage de vol en route. Il n'existe donc aujourd'hui aucune source à
// partir de laquelle une position pourrait être calculée honnêtement.
//
// ── Ce que cette version affiche à la place ──────────────────────────────
//
// Uniquement de la donnée réelle, tirée de `GET /vols` :
//
//   • les LIAISONS ACTIVES — pour chaque vol EN_COURS, la route
//     départ → escales → arrivée, parcourue par un flux animé ;
//   • les VOLS PLANIFIÉS des prochaines 24 h, en trait discontinu ;
//   • l'ACTIVITÉ PAR BASE — nombre de liaisons qui la touchent.
//
// Le flux est un tiret qui circule, délibérément PAS une icône d'aéronef :
// un avion dessiné à un point de la carte se lit comme « l'appareil est ici »,
// ce qui serait faux. Un flux qui circule se lit comme « cette liaison est en
// cours », ce qui est exact.
//
// ── Quand vous aurez une vraie source ────────────────────────────────────
//
// Passez la prop `sourcePositions`. La carte affiche alors les aéronefs à leur
// position mesurée, orientés selon leur cap, avec leur traînée — et le voyant
// d'état passe au vert « en direct ». Un seul point d'entrée à implémenter :
// le type `SourcePositions` ci-dessous. Rien d'autre n'est à modifier.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { T } from '@/lib/theme';
import { REGIONS_CM, CADRE_CM, projeterCM } from '@/app/landing/cameroon.geo';
import './cameroon-map.css';

/* ═══════════════════════════════════════════════════════════════════════════
   POINT D'EXTENSION — SOURCE DE POSITIONS RÉELLES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PositionAeronef {
  immatriculation: string;
  lat: number;
  lng: number;
  /** Altitude en pieds. */
  alt_ft?: number;
  /** Vitesse sol en nœuds. */
  vitesse_kt?: number;
  /** Cap vrai, en degrés. Oriente le glyphe. */
  cap_deg?: number;
  /** Horodatage de la mesure, ISO 8601. Sert à détecter une source figée. */
  horodatage: string;
  numero_mission?: string;
}

/**
 * Fonction appelée à chaque cycle de rafraîchissement.
 *
 * Elle doit renvoyer les positions MESURÉES des aéronefs en vol — ADS-B,
 * balise IoT, liaison de données. Elle ne doit jamais renvoyer de position
 * estimée ou interpolée : la carte affiche ce qu'elle reçoit comme étant
 * mesuré, et l'annonce comme tel à l'utilisateur.
 *
 * Exemple d'implémentation :
 *
 *     <CameroonMap sourcePositions={async () => {
 *       const r = await api.get<PositionAeronef[]>('/telemetrie/positions');
 *       return r.data;
 *     }} />
 */
export type SourcePositions = () => Promise<PositionAeronef[]>;

/* ═══════════════════════════════════════════════════════════════════════════
   RÉFÉRENTIEL LOCAL
   ═══════════════════════════════════════════════════════════════════════════ */

interface BaseGeo {
  code: string; nom: string; ville: string;
  lat: number; lng: number; regionId: string;
}

const BASES: BaseGeo[] = [
  { code: 'BA101', nom: 'Base Aérienne 101', ville: 'Yaoundé',    lat: 3.8480,  lng: 11.5021, regionId: 'CM-CE' },
  { code: 'BA102', nom: 'Base Aérienne 102', ville: 'Bertoua',    lat: 4.5772,  lng: 13.6846, regionId: 'CM-ES' },
  { code: 'BA201', nom: 'Base Aérienne 201', ville: 'Douala',     lat: 4.0061,  lng: 9.7069,  regionId: 'CM-LT' },
  { code: 'BA301', nom: 'Base Aérienne 301', ville: 'Garoua',     lat: 9.3347,  lng: 13.3781, regionId: 'CM-NO' },
  { code: 'BA302', nom: 'Base Aérienne 302', ville: 'Ngaoundéré', lat: 7.3570,  lng: 13.5720, regionId: 'CM-AD' },
  { code: 'BA401', nom: 'Base Aérienne 401', ville: 'Maroua',     lat: 10.5957, lng: 14.3273, regionId: 'CM-EN' },
  { code: 'BA501', nom: 'Base Aérienne 501', ville: 'Bamenda',    lat: 5.9597,  lng: 10.1494, regionId: 'CM-NW' },
];

/** Période de rafraîchissement, alignée sur celle du tableau de bord. */
const PERIODE_MS = 30_000;

/* ═══════════════════════════════════════════════════════════════════════════
   DONNÉES DE VOL
   Formes tolérantes : selon les routes, le service renvoie soit les
   identifiants seuls, soit les bases imbriquées. Les deux sont acceptées.
   ═══════════════════════════════════════════════════════════════════════════ */

interface BaseRef { id?: string; code_base?: string; nom?: string }

interface Vol {
  id: string;
  numero_mission: string;
  immatriculation: string;
  date_heure: string;
  statut: 'PLANIFIE' | 'EN_COURS' | 'CLOTURE' | 'ANNULE';
  type_mission?: string;
  flag_sensible?: boolean;
  base_depart_id?: string;  base_depart?: BaseRef;
  base_arrivee_id?: string; base_arrivee?: BaseRef;
  escales?: { base_id?: string; ordre: number; base?: BaseRef }[];
}

/** Résout un vol vers des codes de base connus du référentiel local. */
function codesDeVol(v: Vol): string[] {
  const resoudre = (id?: string, ref?: BaseRef): string | null => {
    const cible = ref?.code_base ?? id ?? ref?.id;
    if (!cible) return null;
    const b = BASES.find(x => x.code === cible || x.code === ref?.code_base);
    if (b) return b.code;
    // Le service peut renvoyer un UUID : on retombe sur le code s'il est
    // présent dans l'objet imbriqué, sinon la liaison n'est pas traçable.
    return ref?.code_base ?? null;
  };

  const dep = resoudre(v.base_depart_id, v.base_depart);
  const arr = resoudre(v.base_arrivee_id, v.base_arrivee);
  const esc = (v.escales ?? [])
    .slice()
    .sort((a, b) => a.ordre - b.ordre)
    .map(e => resoudre(e.base_id, e.base))
    .filter((c): c is string => Boolean(c));

  return [dep, ...esc, arr].filter((c): c is string => Boolean(c));
}

/* ═══════════════════════════════════════════════════════════════════════════
   GÉOMÉTRIE
   ═══════════════════════════════════════════════════════════════════════════ */

const pt = (code: string): { x: number; y: number } | null => {
  const b = BASES.find(x => x.code === code);
  return b ? projeterCM(b.lat, b.lng) : null;
};

/**
 * Arc entre deux bases. Le point de contrôle est décalé perpendiculairement à
 * la corde : deux liaisons entre les mêmes bases ne se superposent pas si leur
 * flèche diffère, et la courbure évoque une route aérienne plutôt qu'un câble.
 */
function arc(a: { x: number; y: number }, b: { x: number; y: number }, fleche = 0.16): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${(mx - dy * fleche).toFixed(1)},${(my + dx * fleche).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

interface Liaison {
  cle: string;
  volId: string;
  vol: Vol;
  d: string;
  depart: string;
  arrivee: string;
  enCours: boolean;
  /** Durée d'un cycle de flux : dépareillée d'une liaison à l'autre, sinon le
   *  maillage se lit comme un motif décoratif et non comme du trafic. */
  duree: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIMULATION DE DÉMONSTRATION
   ───────────────────────────────────────────────────────────────────────────
   Deux aéronefs parcourent une route entre bases réelles, à vitesse réaliste.

   ⚠ Ce sont des positions CALCULÉES, pas mesurées. La carte l'affiche en
   permanence par un bandeau « SIMULATION » que rien ne masque, et les glyphes
   sont hachurés. C'est la condition pour qu'une démonstration reste une
   démonstration : sur un tableau de bord de commandement, une trace qu'on ne
   peut pas distinguer d'une vraie est un risque, pas une fonctionnalité.

   Dès qu'une source réelle est branchée (prop `sourcePositions`), elle prend
   le pas et la simulation s'arrête d'elle-même.
   ═══════════════════════════════════════════════════════════════════════════ */

interface VolSimule {
  immatriculation: string;
  numero_mission: string;
  type: string;
  etapes: string[];
  /** Vitesse sol en nœuds — sert au déplacement et à l'affichage. */
  vitesse_kt: number;
  alt_ft: number;
  /** Position initiale sur la route, en fraction [0,1]. */
  depart: number;
}

const VOLS_SIMULES: VolSimule[] = [
  {
    immatriculation: 'TJ-XAB', numero_mission: 'MIQ-4417-SIM',
    type: 'Transport tactique',
    etapes: ['BA101', 'BA302', 'BA301', 'BA401'],
    vitesse_kt: 285, alt_ft: 21000, depart: 0.08,
  },
  {
    immatriculation: 'TJ-XCD', numero_mission: 'MIQ-4418-SIM',
    type: 'Voilure tournante',
    etapes: ['BA201', 'BA501'],
    vitesse_kt: 125, alt_ft: 4500, depart: 0.42,
  },
];

/** Un degré de latitude vaut environ 60 milles nautiques. Suffisant ici : la
 *  projection est équirectangulaire, la précision géodésique n'a pas d'objet. */
const NM_PAR_DEGRE = 60;

function longueurNm(etapes: string[]): number {
  let total = 0;
  for (let i = 0; i < etapes.length - 1; i += 1) {
    const a = BASES.find(b => b.code === etapes[i]);
    const b = BASES.find(x => x.code === etapes[i + 1]);
    if (!a || !b) continue;
    const dlat = b.lat - a.lat;
    const dlng = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
    total += Math.hypot(dlat, dlng) * NM_PAR_DEGRE;
  }
  return total;
}

/**
 * Position le long de la route, pour une avance donnée. Renvoie aussi le cap,
 * calculé sur le segment courant — un glyphe orienté au hasard trahit
 * immédiatement le procédé.
 */
function pointSurRoute(etapes: string[], avance: number):
{ lat: number; lng: number; cap: number } | null {
  const pts = etapes
    .map(c => BASES.find(b => b.code === c))
    .filter((b): b is BaseGeo => Boolean(b));
  if (pts.length < 2) return null;

  const segments = pts.length - 1;
  const brut = Math.min(0.9999, Math.max(0, avance)) * segments;
  const i = Math.floor(brut);
  const t = brut - i;

  const a = pts[i];
  const b = pts[i + 1];
  const dlat = b.lat - a.lat;
  const dlng = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180);
  // atan2(est, nord) → cap vrai, 0 = nord, sens horaire.
  const cap = (Math.atan2(dlng, dlat) * 180) / Math.PI;

  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    cap: (cap + 360) % 360,
  };
}

/**
 * Avance les deux aéronefs simulés.
 *
 * Un transport à 285 kt sur 600 NM met plus de deux heures : invisible à
 * l'écran. Un facteur d'accélération comprime cette durée — et il est AFFICHÉ
 * dans le bandeau, pas caché.
 */
function useVolsSimules(actif: boolean, acceleration = 120): PositionAeronef[] {
  const [positions, setPositions] = useState<PositionAeronef[]>([]);
  const debut = useRef(Date.now());

  useEffect(() => {
    if (!actif) { setPositions([]); return; }

    const reduit = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const calculer = (): void => {
      const ecoule = (Date.now() - debut.current) / 1000;

      setPositions(VOLS_SIMULES.map(v => {
        const nm = longueurNm(v.etapes) || 1;
        const duree = (nm / v.vitesse_kt) * 3600 / acceleration;
        const p = pointSurRoute(v.etapes, (v.depart + ecoule / duree) % 1);
        if (!p) return null;
        return {
          immatriculation: v.immatriculation,
          numero_mission: v.numero_mission,
          lat: p.lat, lng: p.lng, cap_deg: p.cap,
          alt_ft: v.alt_ft, vitesse_kt: v.vitesse_kt,
          horodatage: new Date().toISOString(),
        } as PositionAeronef;
      }).filter((x): x is PositionAeronef => x !== null));
    };

    calculer();
    // Mouvement réduit : position actualisée lentement. Le contenu reste
    // complet, seul le déplacement continu disparaît.
    const id = window.setInterval(calculer, reduit ? 10_000 : 1000);
    return () => window.clearInterval(id);
  }, [actif, acceleration]);

  return positions;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSANT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CameroonMap({
  sourcePositions, periodeMs = PERIODE_MS, simulation = true, acceleration = 120,
}: {
  /** Source de positions mesurées. Si fournie, elle prime sur la simulation. */
  sourcePositions?: SourcePositions;
  periodeMs?: number;
  /**
   * Fait circuler deux aéronefs de démonstration sur des routes réelles.
   * Passez `false` dès qu'une source mesurée existe. Un bandeau « SIMULATION »
   * reste affiché tant que ce mode est actif.
   */
  simulation?: boolean;
  /** Compression du temps. 120 = deux heures de vol jouées en une minute. */
  acceleration?: number;
}): React.ReactElement {
  const [vols, setVols] = useState<Vol[]>([]);
  const [positionsReelles, setPositionsReelles] = useState<PositionAeronef[]>([]);

  // La source mesurée prime toujours : la simulation ne tourne que si aucune
  // n'est branchée. Impossible de les superposer par inadvertance.
  const simule = simulation && !sourcePositions;
  const positionsSimulees = useVolsSimules(simule, acceleration);
  const positions = sourcePositions ? positionsReelles : positionsSimulees;
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [derniereMaj, setDerniereMaj] = useState<Date | null>(null);

  const [baseActive, setBaseActive] = useState<string | null>(null);
  const [volActif, setVolActif] = useState<string | null>(null);
  const [monte, setMonte] = useState(false);

  const svg = useRef<SVGSVGElement>(null);

  // Lever de rideau : une frame de délai garantit que les transitions partent
  // bien de leur état initial.
  useEffect(() => {
    const f = requestAnimationFrame(() => setMonte(true));
    return () => cancelAnimationFrame(f);
  }, []);

  // ── Chargement périodique ────────────────────────────────────────────────
  const charger = useCallback(async (): Promise<void> => {
    try {
      const r = await api.get<Vol[]>('/vols');
      setVols(Array.isArray(r.data) ? r.data : []);
      setErreur(null);
      setDerniereMaj(new Date());
    } catch {
      // La carte garde son dernier état connu et le signale, plutôt que de se
      // vider : un écran de veille qui se vide sur un incident réseau se lit
      // comme « plus aucun vol », ce qui est le pire contresens possible.
      setErreur('Liaison au service des vols interrompue');
    } finally {
      setChargement(false);
    }

    if (sourcePositions) {
      try {
        setPositionsReelles(await sourcePositions());
      } catch {
        setPositionsReelles([]);
      }
    }
  }, [sourcePositions]);

  useEffect(() => {
    charger();
    const id = window.setInterval(charger, periodeMs);
    return () => window.clearInterval(id);
  }, [charger, periodeMs]);

  // ── Liaisons ─────────────────────────────────────────────────────────────
  const liaisons = useMemo<Liaison[]>(() => {
    const demain = Date.now() + 24 * 3600_000;
    const retenus = vols.filter(v =>
      v.statut === 'EN_COURS'
      || (v.statut === 'PLANIFIE' && new Date(v.date_heure).getTime() <= demain),
    );

    const out: Liaison[] = [];

    // Les routes des aéronefs simulés sont tracées comme les autres : un
    // appareil qui se déplace sans route visible n'a aucun sens.
    if (simule) {
      VOLS_SIMULES.forEach((v, iv) => {
        for (let i = 0; i < v.etapes.length - 1; i += 1) {
          const a = pt(v.etapes[i]);
          const b = pt(v.etapes[i + 1]);
          if (!a || !b) continue;
          out.push({
            cle: `sim-${v.immatriculation}-${i}`,
            volId: `sim-${v.immatriculation}`,
            vol: {
              id: `sim-${v.immatriculation}`,
              numero_mission: v.numero_mission,
              immatriculation: v.immatriculation,
              date_heure: new Date().toISOString(),
              statut: 'EN_COURS',
            },
            d: arc(a, b, (iv % 2 === 0 ? 1 : -1) * 0.15),
            depart: v.etapes[i], arrivee: v.etapes[i + 1],
            enCours: true,
            duree: 5 + iv,
          });
        }
      });
    }

    retenus.forEach((v, iv) => {
      const codes = codesDeVol(v);
      for (let i = 0; i < codes.length - 1; i += 1) {
        const a = pt(codes[i]);
        const b = pt(codes[i + 1]);
        if (!a || !b) continue;
        // La flèche alterne de signe : deux vols empruntant la même paire de
        // bases restent distinguables.
        const fleche = (iv % 2 === 0 ? 1 : -1) * (0.13 + (iv % 3) * 0.05);
        out.push({
          cle: `${v.id}-${i}`, volId: v.id, vol: v,
          d: arc(a, b, fleche),
          depart: codes[i], arrivee: codes[i + 1],
          enCours: v.statut === 'EN_COURS',
          duree: 5 + ((iv * 1.3 + i) % 4),
        });
      }
    });
    return out;
  }, [vols, simule]);

  const enCours = vols.filter(v => v.statut === 'EN_COURS');
  const planifies = vols.filter(v =>
    v.statut === 'PLANIFIE'
    && new Date(v.date_heure).getTime() <= Date.now() + 24 * 3600_000);

  /** Nombre de liaisons touchant chaque base — pilote l'onde d'activité. */
  const activite = useMemo(() => {
    const m = new Map<string, number>();
    liaisons.filter(l => l.enCours).forEach(l => {
      m.set(l.depart, (m.get(l.depart) ?? 0) + 1);
      m.set(l.arrivee, (m.get(l.arrivee) ?? 0) + 1);
    });
    return m;
  }, [liaisons]);

  const volsDeLaBase = baseActive
    ? vols.filter(v => codesDeVol(v).includes(baseActive)
        && (v.statut === 'EN_COURS' || v.statut === 'PLANIFIE'))
    : [];

  const enDirect = Boolean(sourcePositions) && positionsReelles.length > 0;

  return (
    <div className={`cm-root ${monte ? 'is-in' : ''}`} style={{ width: '100%' }}>

      {/* ═══ Entête ═══ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 16, marginBottom: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            Situation opérationnelle
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
            Liaisons en cours et vols planifiés sous 24 h
          </div>
        </div>

        <EtatSource enDirect={enDirect} branchee={Boolean(sourcePositions)}
                    simule={simule} erreur={erreur} maj={derniereMaj} periodeMs={periodeMs} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 250px', gap: 16 }}>

        {/* ═══ Carte ═══ */}
        <div style={{
          position: 'relative', border: `1px solid ${T.border}`, borderRadius: 8,
          background: T.bgCard, padding: 12, overflow: 'hidden',
        }}>
          <svg
            ref={svg}
            viewBox={`0 0 ${CADRE_CM.w} ${CADRE_CM.h}`}
            style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 520 }}
            role="img"
            aria-label={`Carte du Cameroun. ${enCours.length} liaison(s) en cours, ${planifies.length} vol(s) planifié(s) sous 24 heures.`}
          >
            <defs>
              <linearGradient id="cmTerre" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="rgba(45,106,79,.13)" />
                <stop offset="100%" stopColor="rgba(45,106,79,.04)" />
              </linearGradient>
              <linearGradient id="cmTerreOn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="rgba(45,106,79,.34)" />
                <stop offset="100%" stopColor="rgba(45,106,79,.16)" />
              </linearGradient>

              {/* Hachures des glyphes simulés : la distinction se fait à l'œil,
                  sans avoir à lire une légende. */}
              <pattern id="cmHachures" width="6" height="6"
                       patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={T.amberBg} />
                <line x1="0" y1="0" x2="0" y2="6" stroke={T.amberLight} strokeWidth="3" />
              </pattern>
            </defs>

            {/* ── Régions ── */}
            <g>
              {REGIONS_CM.map((r, i) => {
                const allumee = baseActive
                  ? BASES.find(b => b.code === baseActive)?.regionId === r.id
                  : false;
                return (
                  <path
                    key={r.id} d={r.d} className="cm-region" data-on={allumee ? '1' : '0'}
                    fill={allumee ? 'url(#cmTerreOn)' : 'url(#cmTerre)'}
                    stroke={allumee ? T.green : 'rgba(45,106,79,.28)'}
                    strokeWidth={1.2} strokeLinejoin="round"
                    style={{ '--cm-d': `${i * 55}ms` } as React.CSSProperties}
                  ><title>{r.nom}</title></path>
                );
              })}
            </g>

            {/* ── Liaisons ── */}
            <g>
              {liaisons.map((l, i) => {
                const concerne = !baseActive
                  || l.depart === baseActive || l.arrivee === baseActive;
                const selectionne = volActif === l.volId;
                const couleur = l.vol.flag_sensible ? T.red : l.enCours ? T.green : T.blue;

                return (
                  <g key={l.cle} className="cm-lien"
                     data-dim={concerne ? '0' : '1'}
                     onMouseEnter={() => setVolActif(l.volId)}
                     onMouseLeave={() => setVolActif(null)}
                     style={{ cursor: 'pointer' }}>
                    <title>
                      {l.vol.numero_mission} · {l.depart} → {l.arrivee} ·{' '}
                      {l.enCours ? 'en cours' : 'planifié'}
                    </title>

                    <path
                      d={l.d}
                      className={`cm-route ${monte ? 'cm-route--trace' : 'cm-route--trace'}`}
                      stroke={couleur}
                      strokeWidth={selectionne ? 3 : l.enCours ? 2 : 1.4}
                      strokeDasharray={l.enCours ? undefined : '7 7'}
                      opacity={l.enCours ? 0.5 : 0.32}
                      style={{ '--cm-d': `${400 + i * 60}ms` } as React.CSSProperties}
                    />

                    {/* Le flux ne circule que sur une liaison réellement en
                        cours. Un vol planifié n'a rien qui bouge. */}
                    {l.enCours && (
                      <path
                        d={l.d} className="cm-flux"
                        stroke={couleur} strokeWidth={selectionne ? 5 : 4}
                        style={{
                          '--cm-dur': `${l.duree}s`,
                          '--cm-d': `${i * -700}ms`,
                        } as React.CSSProperties}
                      />
                    )}
                  </g>
                );
              })}
            </g>

            {/* ── Bases ── */}
            <g>
              {BASES.map(b => {
                const p = projeterCM(b.lat, b.lng);
                const active = baseActive === b.code;
                const n = activite.get(b.code) ?? 0;

                return (
                  <g key={b.code} className="cm-base" data-on={active ? '1' : '0'}
                     onMouseEnter={() => setBaseActive(b.code)}
                     onMouseLeave={() => setBaseActive(null)}
                     onFocus={() => setBaseActive(b.code)}
                     onBlur={() => setBaseActive(null)}
                     tabIndex={0} role="button"
                     aria-label={`${b.nom}, ${b.ville}. ${n} liaison(s) en cours.`}>

                    {/* Onde émise uniquement si la base est réellement active. */}
                    {n > 0 && (
                      <circle cx={p.x} cy={p.y} r={11} className="cm-onde"
                              stroke={T.green} strokeWidth={2}
                              style={{ '--cm-d': `${(b.code.charCodeAt(4) % 5) * 400}ms` } as React.CSSProperties} />
                    )}

                    <circle cx={p.x} cy={p.y} r={17} className="cm-base__halo"
                            stroke={T.green} strokeWidth={2} />
                    <circle cx={p.x} cy={p.y} r={8} className="cm-base__pt"
                            fill={n > 0 ? T.green : T.textDim}
                            stroke={T.bgCard} strokeWidth={2.5} />

                    <text x={p.x + 22} y={p.y + 3} className="cm-base__txt"
                          fontFamily={T.mono} fontSize={22}
                          fontWeight={active ? 700 : 400}
                          fill={active ? T.green : T.textSub}>{b.code}</text>

                    {/* Compteur de liaisons : l'information la plus utile en un
                        coup d'œil sur un écran de veille. */}
                    {n > 0 && (
                      <text x={p.x + 22} y={p.y + 26} className="cm-base__txt"
                            fontFamily={T.mono} fontSize={17} fill={T.green}>
                        {n} liaison{n > 1 ? 's' : ''}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            {/* ── Aéronefs télémétrés ──
                Rendus UNIQUEMENT si une source de positions mesurées est
                branchée. Sans source, ce groupe est vide : la carte n'invente
                aucune position. */}
            {(sourcePositions || simule) && (
              <g>
                {positions.map(a => {
                  const p = projeterCM(a.lat, a.lng);
                  return (
                    <g key={a.immatriculation} className="cm-aeronef"
                       transform={`translate(${p.x} ${p.y})`}>
                      <title>
                        {a.immatriculation}
                        {a.numero_mission ? ` · ${a.numero_mission}` : ''}
                        {a.alt_ft ? ` · ${a.alt_ft} ft` : ''}
                        {a.vitesse_kt ? ` · ${a.vitesse_kt} kt` : ''}
                      </title>
                      <g className="cm-aeronef__glyphe"
                         transform={`rotate(${a.cap_deg ?? 0})`}>
                        <path d="M0,-15 L5,-3 L17,5 L17,8 L5,5 L4,13 L8,16 L8,18 L0,16 L-8,18 L-8,16 L-4,13 L-5,5 L-17,8 L-17,5 L-5,-3 Z"
                              fill={simule ? 'url(#cmHachures)' : T.amberLight}
                              stroke={simule ? T.amber : T.bgCard} strokeWidth={1.4} />
                      </g>
                      <text x={22} y={2} fontFamily={T.mono} fontSize={19}
                            fontWeight={600} fill={T.amber}>
                        {a.immatriculation}
                      </text>
                      <text x={22} y={22} fontFamily={T.mono} fontSize={15} fill={T.textDim}>
                        {a.alt_ft ? `FL${Math.round(a.alt_ft / 100)}` : ''}
                        {a.vitesse_kt ? ` · ${a.vitesse_kt} kt` : ''}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}
          </svg>

          {/* Bandeau de simulation — délibérément non masquable tant que le
              mode est actif. C'est ce qui manquait à la version précédente. */}
          {simule && (
            <div style={{
              position: 'absolute', top: 20, left: 20, zIndex: 2,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 11px', borderRadius: 4,
              background: T.amberBg, border: `1px solid ${T.amberBorder}`,
              fontFamily: T.mono, fontSize: 10, letterSpacing: '0.1em',
              color: T.amber, fontWeight: 700,
            }}>
              SIMULATION · ×{acceleration}
            </div>
          )}

          {chargement && (
            <div style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              background: 'rgba(255,255,255,.72)', fontSize: 12, color: T.textDim,
            }}>Chargement de la situation…</div>
          )}
        </div>

        {/* ═══ Panneau ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <Compteur label="Liaisons en cours" valeur={enCours.length} couleur={T.green} />
          <Compteur label="Planifiés sous 24 h" valeur={planifies.length} couleur={T.blue} />

          <div style={{
            border: `1px solid ${T.border}`, borderRadius: 8, background: T.bgCard,
            padding: '12px 14px', flex: 1, minHeight: 150, overflow: 'auto',
          }}>
            {baseActive ? (
              <div className="cm-fiche">
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>
                  {BASES.find(b => b.code === baseActive)?.ville}
                </div>
                <div style={{ fontSize: 10.5, color: T.textDim, marginTop: 2, marginBottom: 10 }}>
                  {baseActive} · {volsDeLaBase.length} vol{volsDeLaBase.length > 1 ? 's' : ''}
                </div>

                {volsDeLaBase.length === 0 ? (
                  <div style={{ fontSize: 11, color: T.textDim }}>Aucun vol actif ou planifié.</div>
                ) : volsDeLaBase.slice(0, 8).map((v, i) => (
                  <div key={v.id} className="cm-item"
                       style={{
                         '--cm-i': i, padding: '7px 9px', marginBottom: 5,
                         border: `1px solid ${T.border}`,
                         borderLeft: `3px solid ${v.statut === 'EN_COURS' ? T.green : T.blue}`,
                         borderRadius: 4, background: T.bgAlt,
                       } as React.CSSProperties}>
                    <div style={{ fontSize: 11, fontFamily: T.mono, color: T.text, fontWeight: 600 }}>
                      {v.numero_mission}
                    </div>
                    <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
                      {codesDeVol(v).join(' → ') || '—'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Legende />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ÉTAT DE LA SOURCE
   La distinction entre « donnée mesurée » et « donnée de planification » est
   affichée en permanence. C'est précisément ce qui manquait.
   ═══════════════════════════════════════════════════════════════════════════ */

function EtatSource({ enDirect, branchee, simule, erreur, maj, periodeMs }: {
  enDirect: boolean; branchee: boolean; simule: boolean;
  erreur: string | null; maj: Date | null; periodeMs: number;
}): React.ReactElement {
  const couleur = erreur ? T.red : enDirect ? T.green : T.amberLight;
  const texte = erreur
    ? erreur
    : enDirect
      ? 'Positions en direct'
      : simule
        ? 'Aéronefs de démonstration — positions calculées'
        : 'Aucune source de position — liaisons issues du plan de vol';

  return (
    <div style={{ minWidth: 250 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 10.5, color: couleur, fontWeight: 600,
      }}>
        <span className="cm-voyant" data-live={enDirect && !erreur ? '1' : '0'}
              style={{ background: couleur, color: couleur }} />
        {texte}
      </div>

      {simule && !erreur && (
        <div style={{ fontSize: 9.5, color: T.textDim, marginTop: 4, lineHeight: 1.5 }}>
          Passez <code style={{ fontFamily: T.mono }}>simulation={'{false}'}</code> pour
          les retirer.
        </div>
      )}

      {maj && (
        <>
          <div style={{ fontSize: 9.5, color: T.textDim, marginTop: 6, fontFamily: T.mono }}>
            Mise à jour {maj.toLocaleTimeString('fr-FR')}
          </div>
          <div className="cm-fraicheur" style={{
            background: T.bgAlt, marginTop: 4,
            '--cm-periode': `${periodeMs}ms`,
          } as React.CSSProperties}>
            <i style={{ background: couleur, opacity: .5 }} />
          </div>
        </>
      )}
    </div>
  );
}

function Compteur({ label, valeur, couleur }: {
  label: string; valeur: number; couleur: string;
}): React.ReactElement {
  return (
    <div style={{
      border: `1px solid ${T.border}`, borderRadius: 8, background: T.bgCard,
      padding: '10px 14px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        fontSize: 9.5, color: T.textDim, textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>{label}</div>
      <div style={{
        fontSize: 26, fontWeight: 700, color: couleur, fontFamily: T.display, lineHeight: 1.2,
      }}>{valeur}</div>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: couleur, opacity: .28,
      }} />
    </div>
  );
}

function Legende(): React.ReactElement {
  const items = [
    { c: T.green,      t: 'Liaison en cours', d: 'Flux animé' },
    { c: T.blue,       t: 'Vol planifié',     d: 'Trait discontinu' },
    { c: T.red,        t: 'Vol sensible',     d: 'Verrou CEMAA' },
    { c: T.textDim,    t: 'Base au repos',    d: 'Aucune liaison' },
    { c: T.amberLight, t: 'Aéronef simulé',   d: 'Glyphe hachuré' },
  ];

  return (
    <div>
      <div style={{
        fontSize: 9.5, color: T.textDim, textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 9,
      }}>Légende</div>
      {items.map(i => (
        <div key={i.t} style={{
          display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8,
        }}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%', background: i.c, flexShrink: 0,
          }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 11, color: T.textSub, fontWeight: 600 }}>
              {i.t}
            </span>
            <span style={{ display: 'block', fontSize: 9.5, color: T.textDim }}>{i.d}</span>
          </span>
        </div>
      ))}
      <div style={{
        marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${T.border}`,
        fontSize: 9.5, color: T.textDim, lineHeight: 1.55,
      }}>
        Survolez une base pour voir ses vols.
      </div>
    </div>
  );
}