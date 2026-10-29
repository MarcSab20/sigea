// apps/pdf-service/src/pdf/liste-template.ts
//
// Gabarit de la LISTE HIÉRARCHISÉE et de la LISTE D'ATTENTE.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI UN SECOND GABARIT, ET NON UNE VARIANTE DU MANIFESTE
// ═══════════════════════════════════════════════════════════════════════════
// Ce sont deux documents distincts, de structures distinctes, comme le pose la
// directive. Le manifeste est un document d'embarquement : une liste de gens à
// bord, un visa. Celui-ci est un document de décision : six tableaux de
// priorité, une liste d'attente, et quatre signatures successives dont chacune
// atteste d'une discrimination.
//
// Les six tableaux sont TOUJOURS imprimés, même vides. Un tableau absent se lit
// comme un oubli de l'opérateur ; un tableau vide se lit comme une absence de
// candidat à cette priorité. La différence compte devant une autorité.
//
// La liste d'attente est imprimée sur une PAGE SÉPARÉE, et la fonction de rendu
// accepte de l'omettre. Le manifeste ne la reçoit jamais ; l'ADJ_AIR et le
// COMRMIA en ont besoin.

import {
  EtapeListe, MentionVisa, Priorite,
  ETAPE_LISTE_SEQUENCE, LIBELLE_ETAPE_LISTE, LIBELLE_MENTION, LIBELLE_RMIA,
} from '@sigea/shared-types';
import {
  esc, fmtDate, fmtDateCourte, STYLE_COMMUN, cartoucheAuthenticite,
  MENTION_INTERIM, VisaData, ManifesteRenderData,
} from './manifeste-template';

const INK = '#123a8f';

export interface LigneRenderData {
  rang:        number;
  nom:         string;
  prenom:      string;
  grade?:      string | null;
  matricule?:  string | null;
  unite?:      string | null;
  categorie:   string;
  telephone:   string;
  destination: string;
  nb_bagages:  number;
  masse_bagages_kg: number | string;
  /** Vrai pour une inscription imposée par le CEMAA ou le MAGE. */
  imposee:     boolean;
}

export interface VisaListeRenderData extends VisaData {
  etape: EtapeListe;
  /** Renseigné à l'étape COMBASE lorsque la discrimination a été déléguée. */
  delegataire_nom?:   string | null;
  delegataire_grade?: string | null;
  hash_court:         string;
}

export interface ListeRenderData {
  id:      string;
  version: number;
  statut:  string;
  rmia:    string;

  vol?: {
    numero_mission?:  string;
    immatriculation?: string;
    date_heure?:      Date | string;
    type_mission?:    string;
    itineraire?:      { ordre: number; code_base?: string }[];
  } | null;

  point?: { ordre: number; code_base?: string; nom?: string } | null;

  quota_places:   number;
  quota_masse_kg: number;

  /** Six entrées, de P1 à P6, dans l'ordre. Toujours six, même vides. */
  tableaux: { priorite: Priorite; libelle: string; lignes: LigneRenderData[] }[];
  /** Omise pour les destinataires qui n'y ont pas droit. */
  liste_attente?: LigneRenderData[] | null;

  visas: VisaListeRenderData[];
  authenticite?: ManifesteRenderData['authenticite'];
}

// ─── Tampon de visa, format réduit (quatre côte à côte) ────────────────────

function tamponVisa(v: VisaListeRenderData | undefined, etape: EtapeListe): string {
  if (!v) {
    return `
      <svg viewBox="0 0 170 170" class="tampon-v" xmlns="http://www.w3.org/2000/svg">
        <circle cx="85" cy="85" r="73" fill="none" stroke="#b3bccd"
                stroke-width="1.8" stroke-dasharray="5 4"/>
        <text x="85" y="90" text-anchor="middle" font-family="Arial, sans-serif"
              font-size="10" fill="#9aa6b8" letter-spacing="1">EN ATTENTE</text>
      </svg>`;
  }

  const mention = esc(LIBELLE_MENTION[v.mention as MentionVisa] ?? v.mention);
  // Les mentions longues (« SIGNATURE NUMÉRIQUE ») sont écrites sur deux lignes :
  // les comprimer les rendrait illisibles une fois le document photocopié.
  const mots = mention.split(' ');
  const mentionSvg = mots.length > 1
    ? `<text x="85" y="56" text-anchor="middle" font-family="Arial, sans-serif"
             font-size="12" font-weight="800" fill="${INK}">${esc(mots[0])}</text>
       <text x="85" y="70" text-anchor="middle" font-family="Arial, sans-serif"
             font-size="12" font-weight="800" fill="${INK}">${esc(mots.slice(1).join(' '))}</text>`
    : `<text x="85" y="64" text-anchor="middle" font-family="Arial, sans-serif"
             font-size="15" font-weight="800" fill="${INK}" letter-spacing="1">${mention}</text>`;

  const pi = v.par_interim
    ? `<text x="30" y="60" text-anchor="middle" font-family="Arial, sans-serif"
             font-size="12" font-weight="800" fill="${INK}">${esc(MENTION_INTERIM)}</text>`
    : '';

  // La délégation n'apparaît PAS sur le tampon : la directive veut que la
  // signature visible reste celle du commandant de base. Elle figure sous la
  // grille, en mention d'archivage.
  return `
    <svg viewBox="0 0 170 170" class="tampon-v" xmlns="http://www.w3.org/2000/svg">
      <circle cx="85" cy="85" r="75" fill="none" stroke="${INK}" stroke-width="3"/>
      <circle cx="85" cy="85" r="67" fill="none" stroke="${INK}" stroke-width="1.2"/>
      ${pi}
      ${mentionSvg}
      <line x1="30" y1="78" x2="140" y2="78" stroke="${INK}" stroke-width="1"/>
      <text x="85" y="95" text-anchor="middle" font-family="Arial, sans-serif"
            font-size="8" font-weight="600" fill="${INK}">${esc(v.signataire_titre)}</text>
      <text x="85" y="110" text-anchor="middle" font-family="Arial, sans-serif"
            font-size="11" font-weight="700" fill="${INK}">${
              esc(`${v.signataire_grade} ${v.signataire_nom}`.trim())}</text>
      <line x1="40" y1="120" x2="130" y2="120" stroke="${INK}" stroke-width="0.8"/>
      <text x="85" y="134" text-anchor="middle" font-family="Arial, sans-serif"
            font-size="8.5" fill="${INK}">${esc(fmtDateCourte(v.date_heure))}</text>
      <text x="85" y="147" text-anchor="middle" font-family="Consolas, monospace"
            font-size="6.5" fill="#5b6472">${esc(v.hash_court)}</text>
    </svg>`;
}

function grilleVisas(visas: VisaListeRenderData[]): string {
  const parEtape = new Map(visas.map((v) => [v.etape, v]));
  // Le COMBORD est exclu : son visa appartient au manifeste, pas à la liste.
  const etapes = ETAPE_LISTE_SEQUENCE.filter((e) => e !== EtapeListe.COMBORD);

  const blocs = etapes.map((e) => `
    <div class="bloc">
      <div class="bloc-titre">${esc(LIBELLE_ETAPE_LISTE[e])}</div>
      ${tamponVisa(parEtape.get(e), e)}
    </div>`).join('');

  const combase = parEtape.get(EtapeListe.COMBASE);
  const note = combase?.delegataire_nom
    ? `<div class="delegation">Discrimination exercée par délégation du commandant de base,
        par ${esc(`${combase.delegataire_grade ?? ''} ${combase.delegataire_nom}`.trim())}.
        Mention portée pour archivage.</div>`
    : '';

  return `<div class="blocs">${blocs}</div>${note}`;
}

// ─── Tableaux ──────────────────────────────────────────────────────────────

function tableLignes(lignes: LigneRenderData[], avecTelephone: boolean): string {
  if (!lignes.length) return '<p class="vide">Aucun candidat à cette priorité.</p>';
  const trs = lignes.map((l) => `
    <tr>
      <td class="c">${esc(l.rang)}</td>
      <td>${esc(l.grade)} ${esc(l.nom)} ${esc(l.prenom)}${
        l.imposee ? ' <span class="imp">IMPOSÉ</span>' : ''}</td>
      <td>${esc(l.matricule)}</td>
      <td>${esc(l.unite)}</td>
      <td>${esc(l.categorie)}</td>
      <td>${esc(l.destination)}</td>
      ${avecTelephone ? `<td>${esc(l.telephone)}</td>` : ''}
      <td class="c">${esc(l.nb_bagages)}</td>
      <td class="c">${esc(l.masse_bagages_kg)}</td>
    </tr>`).join('');
  return `
    <table class="tbl">
      <thead><tr>
        <th class="c">Rang</th><th>Identité</th><th>Matricule</th><th>Unité</th>
        <th>Catégorie</th><th>Destination</th>
        ${avecTelephone ? '<th>Téléphone</th>' : ''}
        <th class="c">Bag.</th><th class="c">Kg</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

function sectionsPriorite(tableaux: ListeRenderData['tableaux']): string {
  return tableaux.map((t) => `
    <div class="prio-bloc">
      <h2 class="section">${esc(t.libelle)} — ${t.lignes.length} inscrit(s)</h2>
      ${tableLignes(t.lignes, false)}
    </div>`).join('');
}

// ─── Document complet ──────────────────────────────────────────────────────

export function renderListeHtml(data: ListeRenderData, watermark = ''): string {
  const route = (data.vol?.itineraire ?? [])
    .sort((a, b) => a.ordre - b.ordre)
    .map((p) => esc(p.code_base))
    .join(' → ');

  const nbRetenus = data.tableaux.reduce((s, t) => s + t.lignes.length, 0);
  const masse = data.tableaux
    .flatMap((t) => t.lignes)
    .reduce((s, l) => s + Number(l.masse_bagages_kg || 0), 0);

  const pageAttente = data.liste_attente?.length
    ? `
    <div class="saut"></div>
    <header class="h2nd">
      <h1>Liste d'attente</h1>
      <div class="sub">${esc(data.vol?.numero_mission)} — ${esc(data.point?.code_base)}</div>
    </header>
    <p class="note">Les personnes ci-dessous ne sont pas retenues au titre du quota alloué.
      Elles sont communiquées aux autorités de validation à titre de réserve et ne figurent
      sur aucun manifeste.</p>
    ${tableLignes(data.liste_attente, false)}`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
${STYLE_COMMUN}
  .blocs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; }
  .bloc { text-align: center; border: 1px solid #dde; border-radius: 4px; padding: 6px 2px 4px; }
  .bloc-titre { font-size: 8px; font-weight: 700; color: ${INK}; text-transform: uppercase;
    margin-bottom: 4px; min-height: 22px; display: flex; align-items: center; justify-content: center; }
  .tampon-v { width: 100%; height: auto; max-width: 118px; }
  .delegation { margin-top: 6px; font-size: 7.5px; color: #5b6472; font-style: italic;
    border-top: 1px dotted #ccc; padding-top: 4px; }
  .prio-bloc { page-break-inside: avoid; margin-bottom: 4px; }
  .saut { page-break-before: always; }
  .h2nd { margin-top: 0; }
  .note { font-size: 8.5px; color: #666; font-style: italic; margin: 6px 0 8px; }
  .quota { background: #eef3fb; border: 1px solid ${INK}; border-radius: 3px;
    padding: 5px 10px; margin: 6px 0; font-size: 10px; display: flex; gap: 20px; }
  .quota b { color: ${INK}; }
</style>
</head>
<body>
  ${watermark ? `<div class="watermark">${esc(watermark)}</div>` : ''}
  <div class="page">
    <header>
      <div class="rep">RÉPUBLIQUE DU CAMEROUN — FORCES ARMÉES CAMEROUNAISES</div>
      <h1>Liste hiérarchisée d'embarquement</h1>
      <div class="sub">${esc(LIBELLE_RMIA[data.rmia as keyof typeof LIBELLE_RMIA] ?? data.rmia)}
        — Système Intégré de Gestion des Escales Aériennes</div>
    </header>

    <div class="meta">
      <div><b>Mission :</b> ${esc(data.vol?.numero_mission)}</div>
      <div><b>Aéronef :</b> ${esc(data.vol?.immatriculation)}</div>
      <div><b>Départ :</b> ${esc(fmtDate(data.vol?.date_heure))}</div>
      <div><b>Route :</b> ${route}</div>
      <div><b>Point d'embarquement :</b> ${esc(data.point?.code_base)} (escale ${esc(data.point?.ordre)})</div>
      <div><b>Statut :</b> ${esc(data.statut)}</div>
    </div>

    <div class="quota">
      <span><b>Quota alloué :</b> ${esc(data.quota_places)} place(s) — ${esc(data.quota_masse_kg)} kg</span>
      <span><b>Retenus :</b> ${esc(nbRetenus)}</span>
      <span><b>Masse bagages :</b> ${esc(Number(masse.toFixed(2)))} kg</span>
      <span><b>En attente :</b> ${esc(data.liste_attente?.length ?? 0)}</span>
    </div>

    ${sectionsPriorite(data.tableaux)}

    <div class="signatures">
      <h2 class="section">Validations successives</h2>
      ${grilleVisas(data.visas)}
    </div>

    ${cartoucheAuthenticite(data.authenticite)}

    <footer>
      <span>SIGEA — Liste hiérarchisée, version ${esc(data.version)}</span>
      <span>Généré le ${esc(fmtDate(new Date()))}</span>
    </footer>

    ${pageAttente}
  </div>
</body>
</html>`;
}