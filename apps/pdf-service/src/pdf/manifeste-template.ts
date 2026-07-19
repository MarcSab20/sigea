// apps/pdf-service/src/pdf/manifeste-template.ts
//
// Rendu HTML du manifeste d'escale, tampons de signature compris.
//
// Fonction PURE (données → HTML) : aucune dépendance NestJS, aucune I/O.
// C'est ce qui permet de la prototyper et de la tester hors du service.
// Puppeteer se contente ensuite de transformer ce HTML en PDF.
//
// Les 5 blocs de signature sont TOUJOURS dessinés, quel que soit l'avancement
// du circuit : un bloc non encore signé apparaît en pointillés (emplacement
// réservé), un bloc signé porte son tampon figé. C'est l'exigence « tous ces
// VU et la signature sont présents sur le document quel que soit le niveau du
// circuit ».

import {
  EtapeValidation,
  MentionSignature,
  StatutValidation,
  BLOCS_SIGNATURE,
  LIBELLE_ETAPE,
} from '@sigea/shared-types';

// ─── Contrat d'entrée ──────────────────────────────────────────────────────
// Volontairement minimal et défensif : le template ne suppose jamais qu'une
// relation est présente. Un manifeste en BROUILLON n'a pas de tampon ; un vol
// peut n'avoir aucune escale. Tout est optionnel côté rendu.

export interface TamponData {
  etape:            EtapeValidation;
  statut:           StatutValidation;
  mention:          MentionSignature | null;
  tampon_ligne1:    string | null;
  tampon_ligne2:    string | null;
  signataire_nom:   string | null;
  signataire_grade: string | null;
  date_heure:       Date | string | null;
}

export interface ManifesteRenderData {
  id:            string;
  numero?:       string | null;
  statut:        string;
  etape_courante?: string | null;
  flag_sensible: boolean;
  consignes_cemaa_appliquees: boolean;
  consignes_cemaa_date?: Date | string | null;
  base?:  { code_base?: string; nom?: string; numero?: string } | null;
  vol?: {
    numero_mission?: string;
    immatriculation?: string;
    date_heure?: Date | string;
    type_mission?: string;
    base_depart?:  { code_base?: string } | null;
    base_arrivee?: { code_base?: string } | null;
  } | null;
  passagers?:    { nom?: string; prenom?: string; grade?: string; categorie?: string; unite?: string }[];
  materiels?:    { designation?: string; quantite?: number; poids_kg?: number | string }[];
  marchandises?: { designation?: string; classe_onu?: string; poids_kg?: number | string }[];
  equipages?:    { nom?: string; prenom?: string; fonction?: string }[];
  validations?:  TamponData[];
}

// ─── Utilitaires ───────────────────────────────────────────────────────────

/** Échappement HTML — TOUTE donnée dynamique passe par ici (anti-injection). */
function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fmtDateCourte(d: Date | string | null | undefined): string {
  return fmtDate(d).split(' ')[0] ?? '';
}

// ─── Le tampon circulaire ──────────────────────────────────────────────────
// Rendu en SVG : un cercle net à l'impression, indépendant des polices.
// La couleur d'encre est la même pour tous (bleu réglementaire) ; seul le
// COMBASE porte ACCORD au lieu de VU.

function tamponSvg(t: TamponData): string {
  const signe = t.statut === StatutValidation.APPROUVE && !!t.mention;

  if (!signe) {
    // Emplacement réservé : cercle en pointillés, étape nommée dessous.
    return `
      <svg viewBox="0 0 150 150" class="tampon tampon-vide" xmlns="http://www.w3.org/2000/svg">
        <circle cx="75" cy="75" r="60" fill="none" stroke="#9aa" stroke-width="1.5" stroke-dasharray="5 4"/>
        <text x="75" y="80" text-anchor="middle" class="t-attente">EN ATTENTE</text>
      </svg>`;
  }

  const l1 = esc(t.tampon_ligne1);
  const l2 = t.tampon_ligne2 ? esc(t.tampon_ligne2) : '';
  const dateStr = fmtDateCourte(t.date_heure);

  // Deux ou trois lignes selon la présence de tampon_ligne2 (COMBORD/COMBASE).
  const lignesTexte = l2
    ? `<text x="75" y="72" text-anchor="middle" class="t-l1">${l1}</text>
       <text x="75" y="90" text-anchor="middle" class="t-l2">${l2}</text>`
    : `<text x="75" y="82" text-anchor="middle" class="t-l1">${l1}</text>`;

  return `
    <svg viewBox="0 0 150 150" class="tampon tampon-signe" xmlns="http://www.w3.org/2000/svg">
      <circle cx="75" cy="75" r="62" fill="none" stroke="#123a8f" stroke-width="2.5"/>
      <circle cx="75" cy="75" r="55" fill="none" stroke="#123a8f" stroke-width="1"/>
      <text x="75" y="42" text-anchor="middle" class="t-mention">${esc(t.mention)}</text>
      <line x1="30" y1="52" x2="120" y2="52" stroke="#123a8f" stroke-width="0.8"/>
      ${lignesTexte}
      <line x1="30" y1="102" x2="120" y2="102" stroke="#123a8f" stroke-width="0.8"/>
      <text x="75" y="118" text-anchor="middle" class="t-date">${esc(dateStr)}</text>
    </svg>`;
}

function blocSignature(etape: EtapeValidation, t: TamponData | undefined): string {
  const data: TamponData = t ?? {
    etape, statut: StatutValidation.EN_ATTENTE,
    mention: null, tampon_ligne1: null, tampon_ligne2: null,
    signataire_nom: null, signataire_grade: null, date_heure: null,
  };
  return `
    <div class="bloc">
      <div class="bloc-titre">${esc(LIBELLE_ETAPE[etape])}</div>
      ${tamponSvg(data)}
    </div>`;
}

// ─── Bandeau consignes CEMAA ───────────────────────────────────────────────

function bandeauCemaa(data: ManifesteRenderData): string {
  if (!data.consignes_cemaa_appliquees) return '';
  const d = fmtDate(data.consignes_cemaa_date);
  return `
    <div class="cemaa-flag">
      <span class="cemaa-pastille">CEMAA</span>
      CONSIGNES CEMAA APPLIQUÉES${d ? ` — ${esc(d)}` : ''}
    </div>`;
}

// ─── Tableaux de contenu ───────────────────────────────────────────────────

function tablePassagers(rows: ManifesteRenderData['passagers']): string {
  if (!rows?.length) return '<p class="vide">Aucun passager déclaré.</p>';
  const trs = rows.map((p, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(p.grade)} ${esc(p.nom)} ${esc(p.prenom)}</td>
      <td>${esc(p.categorie)}</td>
      <td>${esc(p.unite)}</td>
    </tr>`).join('');
  return `
    <table class="tbl">
      <thead><tr><th class="c">N°</th><th>Identité</th><th>Catégorie</th><th>Unité</th></tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

function tableFret(
  materiels: ManifesteRenderData['materiels'],
  marchandises: ManifesteRenderData['marchandises'],
): string {
  const mats = (materiels ?? []).map((m) => ({
    designation: m.designation, detail: '', poids: m.poids_kg, qte: m.quantite,
  }));
  const dgr = (marchandises ?? []).map((m) => ({
    designation: m.designation, detail: `ONU ${m.classe_onu ?? ''}`.trim(), poids: m.poids_kg, qte: 1,
  }));
  const all = [...mats, ...dgr];
  if (!all.length) return '<p class="vide">Aucun fret déclaré.</p>';
  const trs = all.map((m, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(m.designation)}${m.detail ? ` <span class="dgr">${esc(m.detail)}</span>` : ''}</td>
      <td class="c">${esc(m.qte)}</td>
      <td class="c">${esc(m.poids)}</td>
    </tr>`).join('');
  return `
    <table class="tbl">
      <thead><tr><th class="c">N°</th><th>Désignation</th><th class="c">Qté</th><th class="c">Poids (kg)</th></tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

// ─── Filigrane de confidentialité ──────────────────────────────────────────

function filigrane(watermark: string): string {
  if (!watermark) return '';
  return `<div class="watermark">${esc(watermark)}</div>`;
}

// ─── Document complet ──────────────────────────────────────────────────────

export function renderManifesteHtml(
  data: ManifesteRenderData,
  watermark = '',
): string {
  const valParEtape = new Map<string, TamponData>(
    (data.validations ?? []).map((v) => [v.etape, v]),
  );

  const blocs = BLOCS_SIGNATURE
    .map((etape) => blocSignature(etape, valParEtape.get(etape)))
    .join('');

  const routeEscale = data.vol
    ? `${esc(data.vol.base_depart?.code_base)} → ${esc(data.vol.base_arrivee?.code_base)}`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5px; color: #1a1a1a; margin: 0; }

  .watermark {
    position: fixed; top: 42%; left: 50%; transform: translate(-50%,-50%) rotate(-38deg);
    font-size: 62px; font-weight: 800; color: rgba(200,0,0,0.12);
    letter-spacing: 4px; white-space: nowrap; z-index: 0; pointer-events: none;
  }
  .page { position: relative; z-index: 1; }

  header { text-align: center; border-bottom: 2px solid #123a8f; padding-bottom: 6px; margin-bottom: 8px; }
  header .rep { font-size: 9px; letter-spacing: 1px; color: #444; }
  header h1 { font-size: 16px; margin: 4px 0 2px; color: #123a8f; text-transform: uppercase; }
  header .sub { font-size: 10px; color: #555; }

  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3px 14px; margin: 8px 0; font-size: 10px; }
  .meta div { border-bottom: 1px dotted #ccc; padding: 2px 0; }
  .meta b { color: #123a8f; }

  .cemaa-flag {
    background: #fdf2e0; border: 1.5px solid #c8860a; color: #8a5a00;
    font-weight: 700; font-size: 10px; padding: 4px 10px; margin: 6px 0;
    border-radius: 3px; display: flex; align-items: center; gap: 8px; letter-spacing: 0.5px;
  }
  .cemaa-pastille {
    background: #c8860a; color: #fff; font-size: 8.5px; font-weight: 800;
    padding: 2px 6px; border-radius: 10px; letter-spacing: 1px;
  }

  h2.section { font-size: 11px; color: #123a8f; border-left: 3px solid #123a8f;
    padding-left: 6px; margin: 12px 0 5px; text-transform: uppercase; }

  table.tbl { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.tbl th { background: #123a8f; color: #fff; padding: 4px 6px; text-align: left; font-weight: 600; }
  table.tbl td { padding: 3px 6px; border-bottom: 1px solid #e2e2e2; }
  table.tbl tr:nth-child(even) td { background: #f6f8fc; }
  .c { text-align: center; }
  .dgr { color: #b00; font-weight: 700; font-size: 8.5px; }
  .vide { font-style: italic; color: #888; font-size: 9.5px; padding: 4px 0; }

  .signatures { margin-top: 16px; page-break-inside: avoid; }
  .signatures h2 { text-align: center; }
  .blocs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 8px; }
  .bloc { text-align: center; border: 1px solid #dde; border-radius: 4px; padding: 6px 2px 4px; }
  .bloc-titre { font-size: 8px; font-weight: 700; color: #123a8f; text-transform: uppercase;
    margin-bottom: 4px; min-height: 22px; display: flex; align-items: center; justify-content: center; }
  .tampon { width: 100%; height: auto; max-width: 92px; }
  .t-mention  { font-size: 15px; font-weight: 800; fill: #123a8f; letter-spacing: 1px; }
  .t-l1 { font-size: 11px; font-weight: 700; fill: #123a8f; }
  .t-l2 { font-size: 10px; font-weight: 600; fill: #123a8f; }
  .t-date { font-size: 8px; fill: #123a8f; }
  .t-attente { font-size: 9px; fill: #9aa; letter-spacing: 1px; }

  footer { margin-top: 14px; border-top: 1px solid #ccc; padding-top: 4px;
    font-size: 8px; color: #888; display: flex; justify-content: space-between; }
  .statut-tag { font-weight: 700; }
  .statut-VALIDE { color: #1a7a34; }
  .statut-REJETE { color: #b00; }
  .statut-EN_VALIDATION, .statut-SOUMIS { color: #c8860a; }
</style>
</head>
<body>
  ${filigrane(watermark)}
  <div class="page">
    <header>
      <div class="rep">RÉPUBLIQUE DU CAMEROUN — FORCES ARMÉES CAMEROUNAISES</div>
      <h1>Manifeste d'escale aérienne</h1>
      <div class="sub">Système Intégré de Gestion des Escales Aériennes — SIGEA</div>
    </header>

    ${bandeauCemaa(data)}

    <div class="meta">
      <div><b>N° manifeste :</b> ${esc(data.numero ?? data.id)}</div>
      <div><b>Mission :</b> ${esc(data.vol?.numero_mission)}</div>
      <div><b>Aéronef :</b> ${esc(data.vol?.immatriculation)}</div>
      <div><b>Route :</b> ${routeEscale}</div>
      <div><b>Départ :</b> ${esc(fmtDate(data.vol?.date_heure))}</div>
      <div><b>Type mission :</b> ${esc(data.vol?.type_mission)}</div>
      <div><b>Base d'escale :</b> ${esc(data.base?.code_base)} — ${esc(data.base?.nom)}</div>
      <div><b>Statut :</b> <span class="statut-tag statut-${esc(data.statut)}">${esc(data.statut)}</span></div>
      <div>${data.flag_sensible ? '<b style="color:#b00">VOL SENSIBLE</b>' : ''}</div>
    </div>

    <h2 class="section">Passagers</h2>
    ${tablePassagers(data.passagers)}

    <h2 class="section">Fret & marchandises</h2>
    ${tableFret(data.materiels, data.marchandises)}

    <div class="signatures">
      <h2 class="section">Circuit de validation</h2>
      <div class="blocs">${blocs}</div>
    </div>

    <footer>
      <span>SIGEA — Document ${esc(data.statut === 'VALIDE' ? 'validé' : 'en cours de validation')}</span>
      <span>Généré le ${esc(fmtDate(new Date()))}</span>
    </footer>
  </div>
</body>
</html>`;
}