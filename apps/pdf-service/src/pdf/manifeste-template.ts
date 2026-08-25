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

  /**
   * Cartouche d'authenticité. Absent tant qu'aucun instantané n'a été figé
   * (manifeste en brouillon) : le document est alors imprimé sans QR, ce qui
   * est correct — il n'y a rien à authentifier.
   */
  authenticite?: {
    /** Empreinte SHA-256 complète du dernier instantané. */
    hash: string;
    /** Forme courte imprimée en clair, recopiable si le QR est abîmé. */
    hash_court: string;
    /** Étape à laquelle l'empreinte a été figée. */
    etape: string;
    date: Date | string;
    /** Image PNG du QR, en data URI. Généré par PdfService. */
    qr_data_uri: string;
    /** URL encodée dans le QR, affichée en clair sous le cartouche. */
    url: string;
    numero_controle?: string | null;
  } | null;
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
  const INK = '#123a8f'; // encre bleu réglementaire (VU et ACCORD, conforme aux modèles)

  if (!signe) {
    // Emplacement réservé : cercle en pointillés « EN ATTENTE ».
    return `
      <svg viewBox="0 0 160 160" class="tampon" xmlns="http://www.w3.org/2000/svg">
        <circle cx="80" cy="80" r="68" fill="none" stroke="#b3bccd" stroke-width="1.6" stroke-dasharray="5 4"/>
        <text x="80" y="85" text-anchor="middle" font-family="Arial, sans-serif" font-size="9.5"
              fill="#9aa6b8" letter-spacing="1">EN ATTENTE</text>
      </svg>`;
  }

  const l1 = esc(t.tampon_ligne1);
  const l2 = t.tampon_ligne2 ? esc(t.tampon_ligne2) : '';
  const dateStr = esc(fmtDateCourte(t.date_heure));
  const mention = esc(t.mention);

  // Rôle/signataire : 1 ligne (VU simple) ou 2 lignes (COMBORD/COMBASE).
  const lignes = l2
    ? `<text x="80" y="86" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="${INK}">${l1}</text>
       <text x="80" y="101" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="600" fill="${INK}">${l2}</text>`
    : `<text x="80" y="94" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="${INK}">${l1}</text>`;

  return `
    <svg viewBox="0 0 160 160" class="tampon" xmlns="http://www.w3.org/2000/svg">
      <circle cx="80" cy="80" r="70" fill="none" stroke="${INK}" stroke-width="3"/>
      <circle cx="80" cy="80" r="62" fill="none" stroke="${INK}" stroke-width="1.2"/>
      <text x="80" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="19"
            font-weight="800" fill="${INK}" letter-spacing="1">${mention}</text>
      <line x1="34" y1="64" x2="126" y2="64" stroke="${INK}" stroke-width="1"/>
      ${lignes}
      <line x1="42" y1="112" x2="118" y2="112" stroke="${INK}" stroke-width="0.8"/>
      <text x="80" y="127" text-anchor="middle" font-family="Arial, sans-serif" font-size="8.5" fill="${INK}">${dateStr}</text>
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

/**
 * Cartouche d'authenticité imprimé en pied de document.
 *
 * Le QR porte l'URL de vérification ; l'empreinte courte est imprimée en clair
 * à côté pour rester exploitable si le code est déchiré, mouillé ou photocopié
 * de travers — situation banale sur un tarmac.
 */
function cartoucheAuthenticite(data: ManifesteRenderData): string {
  const a = data.authenticite;
  if (!a) {
    return `<div class="auth auth-absent">
      <div class="auth-txt">
        <div class="auth-t">Document non authentifiable</div>
        <div class="auth-d">Aucune empreinte n'a été figée pour cet état du manifeste.
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
      <div class="auth-w">Ce numéro doit être identique à celui affiché après
        lecture du code. Toute divergence rend le tirage irrecevable.</div>` : ''}
      <div class="auth-d">Figée à l'étape ${esc(a.etape)} le ${esc(fmtDate(a.date))}</div>
    </div>
  </div>`;
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
  .tampon { width: 100%; height: auto; max-width: 96px; }
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

  .auth { margin-top: 12px; border: 1px solid #123a8f; border-radius: 4px;
    padding: 7px 9px; display: flex; gap: 10px; align-items: center;
    background: #f6f8fd; page-break-inside: avoid; }
  .auth-absent { border-color: #c9a227; background: #fdfaf0; }
  .auth-qr { width: 76px; height: 76px; flex-shrink: 0; }
  .auth-t { font-size: 9.5px; font-weight: 700; color: #123a8f;
    text-transform: uppercase; letter-spacing: 0.06em; }
  .auth-absent .auth-t { color: #8a6d0b; }
  .auth-d { font-size: 8px; color: #555; line-height: 1.45; margin-top: 2px; }
  .auth-url { font-family: 'Consolas', monospace; color: #123a8f; }
  .auth-h { font-size: 9px; margin-top: 3px; font-family: 'Consolas', monospace;
    letter-spacing: 0.08em; color: #1a1a1a; }
  .auth-n   { margin-top: 5px; display: flex; align-items: baseline; gap: 8px; }
  .auth-n-l { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #5b6472; }
  .auth-n-v { font-family: Consolas, 'Courier New', monospace; font-size: 13px;
              font-weight: 700; letter-spacing: 1.6px; color: #123a8f; }
  .auth-w   { margin-top: 3px; font-size: 7px; line-height: 1.4; color: #7a0016; }
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

    ${cartoucheAuthenticite(data)}

    <footer>
      <span>SIGEA — Document ${esc(data.statut === 'VALIDE' ? 'validé' : 'en cours de validation')}</span>
      <span>Généré le ${esc(fmtDate(new Date()))}</span>
    </footer>
  </div>
</body>
</html>`;
}