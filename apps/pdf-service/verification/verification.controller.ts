// apps/pdf-service/src/verification/verification.controller.ts
//
// Endpoint PUBLIC de vérification d'authenticité. Aucune authentification :
// c'est le point de scan d'un QR par un contrôleur sur le terrain, qui n'a pas
// de compte SIGVEA.
//
// Contreparties assumées et traitées ci-dessous :
//   • aucune donnée de manifeste n'est renvoyée (seulement un verdict) ;
//   • le numéro de contrôle n'est jamais renvoyé en clair, seulement masqué ;
//   • débit limité, l'endpoint étant un oracle d'existence exploitable ;
//   • réponse HTML pour un scan au téléphone, JSON pour l'intégration.

import { Controller, Get, Param, Query, Res, Header, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthenticiteService, ResultatVerification } from './authenticite.service';

/** Motifs stricts : tout écart renvoie INCONNU sans toucher la base. */
const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOTIF_HASH = /^[0-9a-fA-F]{16,64}$/;
/** Numéro de contrôle : préfixe, groupes, tirets et casse tolérés. */
const MOTIF_NUMERO = /^[A-Za-z0-9-]{4,32}$/;

@ApiTags('Vérification publique')
@Controller('verification')
@UseGuards(ThrottlerGuard)
export class VerificationController {
  constructor(private readonly auth: AuthenticiteService) {}

  /**
   * Page de vérification lisible, destinée au scan direct du QR.
   *
   * 20 requêtes/minute : suffisant pour un contrôle au sol, insuffisant pour
   * énumérer des identifiants de manifeste — ni, désormais, pour tenter des
   * numéros de contrôle au hasard (75 bits d'entropie contre 20 essais/minute).
   */
  @Get(':id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ApiExcludeEndpoint()
  async page(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('h') h?: string,
    @Query('n') n?: string,
  ): Promise<void> {
    const r = await this.resoudre(id, h, n);
    // 409 pour tout ce qui n'est pas pleinement conforme : un intégrateur tiers
    // qui ne lit que le code HTTP doit voir passer la discordance de numéro.
    res.status(r.verdict === 'AUTHENTIQUE' ? 200 : 409).type('html').send(pageHtml(r, id));
  }

  /** Même vérification, en JSON, pour une intégration tierce. */
  @Get(':id/json')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: "Vérifier l'authenticité d'un manifeste imprimé (public)" })
  json(
    @Param('id') id: string,
    @Query('h') h?: string,
    @Query('n') n?: string,
  ): Promise<ResultatVerification> {
    return this.resoudre(id, h, n);
  }

  /**
   * Les entrées malformées sont rejetées AVANT toute requête base : cela évite
   * qu'un scan approximatif ou une sonde automatisée ne génère du trafic SQL,
   * et uniformise la réponse (pas de différence de temps entre « mal formé »
   * et « inexistant »).
   *
   * Un `n` malformé est traité comme ABSENT, non comme faux. Motif : un QR
   * partiellement illisible peut amputer la fin de l'URL. Crier au faux
   * document dans ce cas produirait des alertes injustifiées sur le terrain,
   * et finirait par faire ignorer les vraies.
   */
  private async resoudre(id: string, h?: string, n?: string): Promise<ResultatVerification> {
    if (!MOTIF_UUID.test(id) || !h || !MOTIF_HASH.test(h)) {
      return {
        verdict: 'INCONNU',
        message:
          'Référence ou empreinte illisible. Vérifier la saisie, ou rescanner le code ' +
          'imprimé sur le document.',
        numero_concordant: null,
      };
    }
    const numero = n && MOTIF_NUMERO.test(n) ? n : undefined;
    return this.auth.verifier(id, h, numero);
  }
}

// ─── Rendu de la page ──────────────────────────────────────────────────────

const COULEURS: Record<string, { fond: string; bord: string; texte: string; titre: string }> = {
  AUTHENTIQUE:                   { fond: '#f0f9f2', bord: '#1a7a34', texte: '#14532d', titre: 'Document authentique' },
  AUTHENTIQUE_NUMERO_DISCORDANT: { fond: '#fdf0f0', bord: '#b00020', texte: '#7a0016', titre: 'Numéro de contrôle discordant' },
  PERIME:                        { fond: '#fdf6e8', bord: '#c8860a', texte: '#7c4a03', titre: 'Document périmé' },
  INCONNU:                       { fond: '#fdf0f0', bord: '#b00020', texte: '#7a0016', titre: 'Document non reconnu' },
  NON_VERIFIABLE:                { fond: '#f4f4f5', bord: '#71717a', texte: '#3f3f46', titre: 'Non vérifiable' },
};

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pageHtml(r: ResultatVerification, id: string): string {
  const c = COULEURS[r.verdict] ?? COULEURS.NON_VERIFIABLE;
  const fmt = (d?: Date): string =>
    d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : '—';

  // Consigne d'action, distincte du verdict. Un contrôleur au sol a besoin de
  // savoir QUOI FAIRE, pas seulement ce qu'il en est.
  const consigne =
    r.verdict === 'AUTHENTIQUE_NUMERO_DISCORDANT'
      ? `<div class="a">NE PAS ACCEPTER — rendre compte au commandement de la base d'escale.</div>`
      : r.verdict === 'AUTHENTIQUE' && r.numero_concordant === null
        ? `<div class="w">Comparez le numéro imprimé sous le code avec celui affiché ci-dessous.
             S'ils diffèrent, le document est à rejeter.</div>`
        : '';

  const ligneNumero = r.numero_masque
    ? `<div><span>Numéro de contrôle</span><b>${esc(r.numero_masque)}</b></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Vérification SIGVEA</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#eef0f4;
    min-height:100vh;display:flex;align-items:center;justify-content:center;padding:18px}
  .c{background:#fff;border-radius:12px;max-width:440px;width:100%;overflow:hidden;
    box-shadow:0 4px 24px rgba(0,0,0,.1)}
  .h{background:#123a8f;color:#fff;padding:16px 20px}
  .h .r{font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.8}
  .h .t{font-size:17px;font-weight:700;margin-top:3px}
  .v{background:${c.fond};border-left:5px solid ${c.bord};padding:18px 20px}
  .v .t{font-size:19px;font-weight:700;color:${c.texte}}
  .v .m{font-size:13.5px;color:${c.texte};margin-top:7px;line-height:1.5}
  .a{margin:0 20px 14px;padding:12px 14px;background:#b00020;color:#fff;border-radius:8px;
    font-size:13.5px;font-weight:700;line-height:1.45;text-align:center}
  .w{margin:0 20px 14px;padding:11px 14px;background:#fdf6e8;border:1px solid #e8c98a;
    color:#7c4a03;border-radius:8px;font-size:12.5px;line-height:1.5}
  .d{padding:16px 20px;font-size:13px;color:#3f3f46}
  .d div{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f2;gap:12px}
  .d div:last-child{border:0}
  .d b{font-weight:600;color:#18181b;font-family:Consolas,monospace;text-align:right}
  .f{padding:12px 20px;background:#fafafa;font-size:11px;color:#71717a;line-height:1.5;
    border-top:1px solid #eee}
</style></head><body>
<div class="c">
  <div class="h">
    <div class="r">Forces Armées Camerounaises — SIGVEA</div>
    <div class="t">Vérification d'un manifeste d'escale</div>
  </div>
  <div class="v">
    <div class="t">${esc(c.titre)}</div>
    <div class="m">${esc(r.message)}</div>
  </div>
  ${consigne}
  <div class="d">
    <div><span>Référence</span><b>${esc(r.reference ?? id.slice(0, 8).toUpperCase())}</b></div>
    ${ligneNumero}
    ${r.etape ? `<div><span>Étape signée</span><b>${esc(r.etape)}</b></div>` : ''}
    ${r.date_signature ? `<div><span>Date de signature</span><b>${esc(fmt(r.date_signature))}</b></div>` : ''}
    <div><span>Contrôle effectué le</span><b>${esc(fmt(new Date()))}</b></div>
  </div>
  <div class="f">
    Ce contrôle atteste uniquement de la correspondance entre le document présenté et un état
    signé dans SIGVEA. Il ne divulgue aucune information sur le vol ni sur ses occupants.
    Le numéro complet n'est consultable que par l'administrateur du système.
    En cas de doute, se rapprocher du commandement de la base d'escale.
  </div>
</div></body></html>`;
}