// apps/pdf-service/src/pdf/manifeste-template.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI CHANGE
// ═══════════════════════════════════════════════════════════════════════════
// La grille de CINQ blocs de signature disparaît. Le manifeste ne porte plus
// qu'un visa, celui du commandant de bord, en pied de document — c'est
// l'exigence explicite de la directive.
//
// La structure du corps, elle, est CONSERVÉE : en-tête, cartouche de mission,
// tableau des passagers, tableau du fret, cartouche d'authenticité. Elle a été
// éprouvée et n'avait pas à changer.
//
// Le tampon circulaire est maintenu, mais unique et plus grand : sur un
// document qui n'en porte qu'un, le réduire à la taille d'une vignette de
// grille le rendrait illisible une fois photocopié.
//
// Les passagers retirés par le commandant de bord ne sont PAS imprimés : le
// manifeste est le document d'embarquement, pas le journal de la décision. Ce
// filtrage est fait par ManifesteDataService, en amont, pour qu'aucun gabarit
// ne puisse l'oublier.

import { MentionVisa, LIBELLE_MENTION } from '@sigea/shared-types';

// ─── Contrat d'entrée ──────────────────────────────────────────────────────
// Volontairement défensif : le gabarit ne suppose jamais qu'une relation est
// présente. Un manifeste émis mais non visé n'a pas de tampon ; tout est
// optionnel côté rendu.

export interface VisaData {
  mention:          MentionVisa;
  signataire_nom:   string;
  signataire_prenom: string;
  signataire_grade: string;
  signataire_titre: string;
  immatriculation?: string | null;
  date_heure:       Date | string | null;
  par_interim?:     boolean;
  titulaire_nom?:   string | null;
  titulaire_grade?: string | null;
}

export interface ManifesteRenderData {
  id:            string;
  numero:        string;
  statut:        string;
  version:       number;
  flag_sensible: boolean;
  /** Bandeau d'imposition d'autorité, si au moins une ligne en porte une. */
  imposition?:   { autorite: string; nb: number } | null;

  base?: { code_base?: string; nom?: string; numero?: string } | null;
  point?: { ordre: number } | null;
  vol?: {
    numero_mission?:  string;
    immatriculation?: string;
    date_heure?:      Date | string;
    type_mission?:    string;
    /** Itinéraire complet, pour la ligne « Route ». */
    itineraire?:      { ordre: number; code_base?: string }[];
  } | null;

  passagers?: {
    priorite?:    string;
    rang?:        number;
    nom?:         string;
    prenom?:      string;
    grade?:       string;
    categorie?:   string;
    unite?:       string;
    destination?: string;
    nb_bagages?:  number;
    masse_bagages_kg?: number | string;
    imposee?:     boolean;
  }[];
  materiels?: {
    designation?: string;
    proprietaire?: string;
    poids_kg?:    number | string;
    destination?: string;
    classe_iata?: string | null;
  }[];
  equipages?: { nom?: string; prenom?: string; grade?: string; fonction?: string }[];

  totaux?: { passagers: number; masse_bagages_kg: number; masse_fret_kg: number };

  /** Visa du commandant de bord. `null` tant qu'il n'est pas apposé. */
  visa?: VisaData | null;

  /**
   * Cartouche d'authenticité. Absent tant qu'aucun instantané n'a été figé :
   * le document est alors imprimé sans QR, ce qui est correct — il n'y a rien
   * à authentifier.
   */
  authenticite?: {
    hash:        string;
    hash_court:  string;
    etape:       string;
    date:        Date | string;
    qr_data_uri: string;
    url:         string;
    numero_controle?: string | null;
  } | null;
}

// ─── Utilitaires ───────────────────────────────────────────────────────────

/** Échappement HTML — TOUTE donnée dynamique passe par ici (anti-injection). */
export function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fmtDateCourte(d: Date | string | null | undefined): string {
  return fmtDate(d).split(' ')[0] ?? '';
}

const INK = '#123a8f';
export const MENTION_INTERIM = 'P/I';

// ─── Le tampon circulaire, unique ──────────────────────────────────────────
// Rendu en SVG : un cercle net à l'impression, indépendant des polices
// disponibles dans le conteneur Chromium.

export function tamponSvg(v: VisaData | null | undefined, taille = 190): string {
  if (!v) {
    return `
      <svg viewBox="0 0 200 200" class="tampon" style="max-width:${taille}px"
           xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="86" fill="none" stroke="#b3bccd"
                stroke-width="2" stroke-dasharray="6 5"/>
        <text x="100" y="105" text-anchor="middle" font-family="Arial, sans-serif"
              font-size="12" fill="#9aa6b8" letter-spacing="1.5">EN ATTENTE</text>
      </svg>`;
  }

  const mention = esc(LIBELLE_MENTION[v.mention] ?? v.mention);
  const l1 = esc(`${v.signataire_grade} ${v.signataire_nom}`.trim());
  const l2 = esc(v.immatriculation ?? '');
  const dateStr = esc(fmtDateCourte(v.date_heure));

  // ── Mention d'intérim ──
  // Le « P/I » se place à gauche de la mention principale, comme sur un
  // parapheur papier : c'est un qualificatif de la signature, pas une signature
  // distincte. Le nom du titulaire empêché figure sous le trait inférieur — un
  // contrôleur doit pouvoir lire, sur le seul tampon, POUR QUI il a été signé.
  const pi = v.par_interim
    ? `<text x="34" y="72" text-anchor="middle" font-family="Arial, sans-serif"
             font-size="15" font-weight="800" fill="${INK}">${esc(MENTION_INTERIM)}</text>`
    : '';
  const ligneTitulaire = v.par_interim && v.titulaire_nom
    ? `<text x="100" y="172" text-anchor="middle" font-family="Arial, sans-serif"
             font-size="8.5" fill="${INK}">p/ ${esc(`${v.titulaire_grade ?? ''} ${v.titulaire_nom}`.trim())}</text>`
    : '';

  return `
    <svg viewBox="0 0 200 200" class="tampon" style="max-width:${taille}px"
         xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="88" fill="none" stroke="${INK}" stroke-width="3.5"/>
      <circle cx="100" cy="100" r="79" fill="none" stroke="${INK}" stroke-width="1.4"/>
      ${pi}
      <text x="100" y="72" text-anchor="middle" font-family="Arial, sans-serif"
            font-size="15" font-weight="800" fill="${INK}" letter-spacing="0.8">${mention}</text>
      <line x1="34" y1="82" x2="166" y2="82" stroke="${INK}" stroke-width="1"/>
      <text x="100" y="104" text-anchor="middle" font-family="Arial, sans-serif"
            font-size="10.5" font-weight="600" fill="${INK}">${esc(v.signataire_titre)}</text>
      <text x="100" y="121" text-anchor="middle" font-family="Arial, sans-serif"
            font-size="13" font-weight="700" fill="${INK}">${l1}</text>
      ${l2 ? `<text x="100" y="136" text-anchor="middle" font-family="Arial, sans-serif"
            font-size="11" font-weight="600" fill="${INK}">${l2}</text>` : ''}
      <line x1="48" y1="146" x2="152" y2="146" stroke="${INK}" stroke-width="0.9"/>
      <text x="100" y="161" text-anchor="middle" font-family="Arial, sans-serif"
            font-size="9.5" fill="${INK}">${dateStr}</text>
      ${ligneTitulaire}
    </svg>`;
}

// ─── Bandeaux ──────────────────────────────────────────────────────────────

function bandeauImposition(data: ManifesteRenderData): string {
  if (!data.imposition) return '';
  return `
    <div class="flag">
      <span class="pastille">${esc(data.imposition.autorite)}</span>
      ${data.imposition.nb} EMBARQUEMENT(S) IMPOSÉ(S) PAR L'AUTORITÉ CENTRALE
    </div>`;
}

function filigrane(watermark: string): string {
  return watermark ? `<div class="watermark">${esc(watermark)}</div>` : '';
}

// ─── Tableaux ──────────────────────────────────────────────────────────────

function tablePassagers(rows: ManifesteRenderData['passagers']): string {
  if (!rows?.length) return '<p class="vide">Aucun passager porté au manifeste.</p>';
  const trs = rows.map((p, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="c pr">${esc(p.priorite)}</td>
      <td>${esc(p.grade)} ${esc(p.nom)} ${esc(p.prenom)}${
        p.imposee ? ' <span class="imp">IMPOSÉ</span>' : ''}</td>
      <td>${esc(p.categorie)}</td>
      <td>${esc(p.unite)}</td>
      <td>${esc(p.destination)}</td>
      <td class="c">${esc(p.nb_bagages)}</td>
      <td class="c">${esc(p.masse_bagages_kg)}</td>
    </tr>`).join('');
  return `
    <table class="tbl">
      <thead><tr>
        <th class="c">N°</th><th class="c">Prio</th><th>Identité</th>
        <th>Catégorie</th><th>Unité</th><th>Destination</th>
        <th class="c">Bag.</th><th class="c">Kg</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

function tableFret(rows: ManifesteRenderData['materiels']): string {
  if (!rows?.length) return '<p class="vide">Aucun fret déclaré.</p>';
  const trs = rows.map((m, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(m.designation)}${
        m.classe_iata ? ` <span class="dgr">IATA ${esc(m.classe_iata)}</span>` : ''}</td>
      <td>${esc(m.proprietaire)}</td>
      <td>${esc(m.destination)}</td>
      <td class="c">${esc(m.poids_kg)}</td>
    </tr>`).join('');
  return `
    <table class="tbl">
      <thead><tr>
        <th class="c">N°</th><th>Désignation</th><th>Propriétaire</th>
        <th>Destination</th><th class="c">Poids (kg)</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

function tableEquipage(rows: ManifesteRenderData['equipages']): string {
  if (!rows?.length) return '<p class="vide">Équipage non déclaré.</p>';
  const trs = rows.map((e) => `
    <tr><td>${esc(e.grade)} ${esc(e.nom)} ${esc(e.prenom)}</td><td>${esc(e.fonction)}</td></tr>`
  ).join('');
  return `<table class="tbl tbl-eq">
    <thead><tr><th>Identité</th><th>Fonction</th></tr></thead>
    <tbody>${trs}</tbody></table>`;
}

// ─── Cartouche d'authenticité ──────────────────────────────────────────────

/**
 * Le QR porte l'URL de vérification ; l'empreinte courte est imprimée en clair
 * à côté pour rester exploitable si le code est déchiré, mouillé ou photocopié
 * de travers — situation banale sur un tarmac.
 */
export function cartoucheAuthenticite(a: ManifesteRenderData['authenticite']): string {
  if (!a) {
    return `<div class="auth auth-absent">
      <div class="auth-txt">
        <div class="auth-t">Document non authentifiable</div>
        <div class="auth-d">Aucune empreinte n'a été figée pour cet état du document.
        Ce tirage est un document de travail et n'a pas valeur de pièce vérifiable.</div>
      </div>
    </div>`;
  }
  return `<div class="auth">
    <img class="auth-qr" src="${esc(a.qr_data_uri)}" alt="QR de vérification"/>
    <div class="auth-txt">
      <div class="auth-t">Vérification d'authenticité</div>
      <div class="auth-d">Scanner le code, ou saisir l'empreinte sur&nbsp;:<br/>
        <span class="auth-url">${esc(a.url.split('?')[0])}</span></div>
      <div class="auth-h">Empreinte SHA-256 : <b>${esc(a.hash_court)}</b></div>
      ${a.numero_controle ? `
      <div class="auth-n">
        <span class="auth-n-l">N° de contrôle</span>
        <span class="auth-n-v">${esc(a.numero_controle)}</span>
      </div>
      <div class="auth-w">Ce numéro doit être identique à celui affiché après lecture
        du code. Toute divergence rend le tirage irrecevable.</div>` : ''}
      <div class="auth-d">Figée le ${esc(fmtDate(a.date))}</div>
    </div>
  </div>`;
}

/** Feuille de style commune au manifeste et à la liste hiérarchisée. */
export const STYLE_COMMUN = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5px; color: #1a1a1a; margin: 0; }

  .watermark {
    position: fixed; top: 42%; left: 50%; transform: translate(-50%,-50%) rotate(-38deg);
    font-size: 62px; font-weight: 800; color: rgba(200,0,0,0.12);
    letter-spacing: 4px; white-space: nowrap; z-index: 0; pointer-events: none;
  }
  .page { position: relative; z-index: 1; }

  header { text-align: center; border-bottom: 2px solid ${INK}; padding-bottom: 6px; margin-bottom: 8px; }
  header .rep { font-size: 9px; letter-spacing: 1px; color: #444; }
  header h1 { font-size: 16px; margin: 4px 0 2px; color: ${INK}; text-transform: uppercase; }
  header .sub { font-size: 10px; color: #555; }

  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3px 14px; margin: 8px 0; font-size: 10px; }
  .meta div { border-bottom: 1px dotted #ccc; padding: 2px 0; }
  .meta b { color: ${INK}; }

  .flag {
    background: #fdf2e0; border: 1.5px solid #c8860a; color: #8a5a00;
    font-weight: 700; font-size: 10px; padding: 4px 10px; margin: 6px 0;
    border-radius: 3px; display: flex; align-items: center; gap: 8px; letter-spacing: 0.5px;
  }
  .pastille { background: #c8860a; color: #fff; font-size: 8.5px; font-weight: 800;
    padding: 2px 6px; border-radius: 10px; letter-spacing: 1px; }

  h2.section { font-size: 11px; color: ${INK}; border-left: 3px solid ${INK};
    padding-left: 6px; margin: 12px 0 5px; text-transform: uppercase; }

  table.tbl { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.tbl th { background: ${INK}; color: #fff; padding: 4px 6px; text-align: left; font-weight: 600; }
  table.tbl td { padding: 3px 6px; border-bottom: 1px solid #e2e2e2; }
  table.tbl tr:nth-child(even) td { background: #f6f8fc; }
  table.tbl-eq { width: 60%; }
  .c { text-align: center; }
  .pr { font-weight: 700; color: ${INK}; }
  .dgr { color: #b00; font-weight: 700; font-size: 8.5px; }
  .imp { color: #8a5a00; font-weight: 700; font-size: 8px; }
  .vide { font-style: italic; color: #888; font-size: 9.5px; padding: 4px 0; }

  .totaux { margin-top: 6px; font-size: 9.5px; display: flex; gap: 18px; color: #333; }
  .totaux b { color: ${INK}; }

  .signature { margin-top: 18px; page-break-inside: avoid; display: flex;
    justify-content: flex-end; }
  .sig-bloc { text-align: center; width: 230px; }
  .sig-titre { font-size: 9px; font-weight: 700; color: ${INK};
    text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  .tampon { width: 100%; height: auto; }

  footer { margin-top: 14px; border-top: 1px solid #ccc; padding-top: 4px;
    font-size: 8px; color: #888; display: flex; justify-content: space-between; }

  .auth { margin-top: 12px; border: 1px solid ${INK}; border-radius: 4px;
    padding: 7px 9px; display: flex; gap: 10px; align-items: center;
    background: #f6f8fd; page-break-inside: avoid; }
  .auth-absent { border-color: #c9a227; background: #fdfaf0; }
  .auth-qr { width: 76px; height: 76px; flex-shrink: 0; }
  .auth-t { font-size: 9.5px; font-weight: 700; color: ${INK};
    text-transform: uppercase; letter-spacing: 0.06em; }
  .auth-absent .auth-t { color: #8a6d0b; }
  .auth-d { font-size: 8px; color: #555; line-height: 1.45; margin-top: 2px; }
  .auth-url { font-family: 'Consolas', monospace; color: ${INK}; }
  .auth-h { font-size: 9px; margin-top: 3px; font-family: 'Consolas', monospace;
    letter-spacing: 0.08em; color: #1a1a1a; }
  .auth-n { margin-top: 5px; display: flex; align-items: baseline; gap: 8px; }
  .auth-n-l { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #5b6472; }
  .auth-n-v { font-family: Consolas, 'Courier New', monospace; font-size: 13px;
    font-weight: 700; letter-spacing: 1.6px; color: ${INK}; }
  .auth-w { margin-top: 3px; font-size: 7px; line-height: 1.4; color: #7a0016; }
`;

// ─── Document complet ──────────────────────────────────────────────────────

export function renderManifesteHtml(data: ManifesteRenderData, watermark = ''): string {
  const route = (data.vol?.itineraire ?? [])
    .sort((a, b) => a.ordre - b.ordre)
    .map((p) => esc(p.code_base))
    .join(' → ');

  const t = data.totaux;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>${STYLE_COMMUN}</style>
</head>
<body>
  ${filigrane(watermark)}
  <div class="page">
    <header>
      <div class="rep">RÉPUBLIQUE DU CAMEROUN — FORCES ARMÉES CAMEROUNAISES</div>
      <h1>Manifeste d'embarquement</h1>
      <div class="sub">Système Intégré de Gestion des Escales Aériennes — SIGEA</div>
    </header>

    ${bandeauImposition(data)}

    <div class="meta">
      <div><b>N° manifeste :</b> ${esc(data.numero)}</div>
      <div><b>Mission :</b> ${esc(data.vol?.numero_mission)}</div>
      <div><b>Aéronef :</b> ${esc(data.vol?.immatriculation)}</div>
      <div><b>Route :</b> ${route}</div>
      <div><b>Départ :</b> ${esc(fmtDate(data.vol?.date_heure))}</div>
      <div><b>Type mission :</b> ${esc(data.vol?.type_mission)}</div>
      <div><b>Point d'embarquement :</b> ${esc(data.base?.code_base)} — ${esc(data.base?.nom)}</div>
      <div><b>Statut :</b> ${esc(data.statut)}</div>
      <div>${data.flag_sensible ? '<b style="color:#b00">VOL SENSIBLE</b>' : ''}</div>
    </div>

    <h2 class="section">Passagers embarqués</h2>
    ${tablePassagers(data.passagers)}

    <h2 class="section">Fret</h2>
    ${tableFret(data.materiels)}

    <h2 class="section">Équipage</h2>
    ${tableEquipage(data.equipages)}

    ${t ? `<div class="totaux">
      <span><b>Passagers :</b> ${esc(t.passagers)}</span>
      <span><b>Bagages :</b> ${esc(t.masse_bagages_kg)} kg</span>
      <span><b>Fret :</b> ${esc(t.masse_fret_kg)} kg</span>
      <span><b>Masse totale :</b> ${esc(
        Number((t.masse_bagages_kg + t.masse_fret_kg).toFixed(2)),
      )} kg</span>
    </div>` : ''}

    <div class="signature">
      <div class="sig-bloc">
        <div class="sig-titre">Visa du commandant de bord</div>
        ${tamponSvg(data.visa)}
      </div>
    </div>

    ${cartoucheAuthenticite(data.authenticite)}

    <footer>
      <span>SIGEA — ${esc(data.statut === 'DEFINITIF'
        ? 'Manifeste définitif'
        : 'Manifeste émis, en attente du visa du commandant de bord')}</span>
      <span>Version ${esc(data.version)} — généré le ${esc(fmtDate(new Date()))}</span>
    </footer>
  </div>
</body>
</html>`;
}