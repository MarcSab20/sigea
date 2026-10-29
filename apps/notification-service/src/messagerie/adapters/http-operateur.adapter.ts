// apps/notification-service/src/messagerie/adapters/http-operateur.adapter.ts
//
// Adaptateur HTTP générique, pilote par variables d'environnement.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE CET ADAPTATEUR EST, ET CE QU'IL N'EST PAS
// ═══════════════════════════════════════════════════════════════════════════
// Il couvre le cas très répandu d'une passerelle acceptant un POST JSON
// authentifié par en-tête, et rendant un identifiant de message. Beaucoup de
// passerelles africaines fonctionnent ainsi, mais PAS toutes : certaines
// attendent du form-urlencoded, d'autres signent la requête, d'autres encore
// parlent SMPP et pas HTTP du tout.
//
// Tant que l'opérateur n'est pas arrêté, cet adaptateur permet de câbler et de
// tester la chaîne complète. Le jour où le contrat réel est connu, deux issues :
// les noms de champs suffisent et il se configure ; ou le protocole diffère, et
// on écrit une seconde classe implémentant `OperateurSms`. Dans les deux cas,
// rien d'autre ne bouge.

import { Injectable, Logger } from '@nestjs/common';
import { OperateurSms, ResultatEnvoi, EchecEnvoi } from '../operateur.port';

/**
 * Codes HTTP considérés comme DÉFINITIFS.
 *
 * 400, 404, 422 : la requête est mauvaise, la rejouer ne changera rien.
 * 401 et 403 en font partie : un jeton invalide se corrige en configuration,
 * pas en réessayant — et marteler une passerelle avec de mauvaises
 * informations d'authentification est le meilleur moyen de se faire bloquer.
 * 402 (crédit épuisé) est volontairement ABSENT : il se résout par un
 * rechargement, et les messages doivent attendre, pas être perdus.
 */
const STATUTS_DEFINITIFS = new Set([400, 401, 403, 404, 422]);

@Injectable()
export class HttpOperateurAdapter implements OperateurSms {
  readonly nom = process.env.SMS_OPERATEUR_NOM ?? 'passerelle-http';
  private readonly logger = new Logger(HttpOperateurAdapter.name);

  private readonly url       = process.env.SMS_OPERATEUR_URL ?? '';
  private readonly token     = process.env.SMS_OPERATEUR_TOKEN ?? '';
  private readonly enteteAuth = process.env.SMS_OPERATEUR_HEADER ?? 'Authorization';
  private readonly schema    = process.env.SMS_OPERATEUR_SCHEMA ?? 'Bearer';
  private readonly expediteur = process.env.SMS_EXPEDITEUR ?? 'FAC-SIGEA';

  // Noms de champs, configurables : c'est précisément ce qui diffère d'une
  // passerelle à l'autre.
  private readonly champDest    = process.env.SMS_CHAMP_DESTINATAIRE ?? 'to';
  private readonly champTexte   = process.env.SMS_CHAMP_TEXTE ?? 'message';
  private readonly champExped   = process.env.SMS_CHAMP_EXPEDITEUR ?? 'from';
  private readonly champRef     = process.env.SMS_CHAMP_REFERENCE ?? 'id';

  private readonly timeoutMs = Number(process.env.SMS_TIMEOUT_MS ?? 15_000);

  estConfigure(): boolean {
    return this.url.length > 0;
  }

  async envoyer(destinataire: string, contenu: string): Promise<ResultatEnvoi> {
    if (!this.estConfigure()) {
      throw new EchecEnvoi(
        'SMS_OPERATEUR_URL non configurée : aucun opérateur joignable.',
        true, 'NON_CONFIGURE',
      );
    }

    // AbortController plutôt qu'un timeout applicatif : sans lui, une
    // passerelle qui accepte la connexion puis ne répond jamais immobilise un
    // emplacement de la file jusqu'au timeout TCP, c'est-à-dire des minutes.
    const abort = new AbortController();
    const minuteur = setTimeout(() => abort.abort(), this.timeoutMs);

    try {
      const reponse = await fetch(this.url, {
        method: 'POST',
        signal: abort.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { [this.enteteAuth]: `${this.schema} ${this.token}`.trim() } : {}),
        },
        body: JSON.stringify({
          [this.champDest]:  destinataire,
          [this.champTexte]: contenu,
          [this.champExped]: this.expediteur,
        }),
      });

      const corps = await reponse.text();

      if (!reponse.ok) {
        const definitif = STATUTS_DEFINITIFS.has(reponse.status);
        throw new EchecEnvoi(
          `HTTP ${reponse.status} — ${corps.slice(0, 200)}`,
          definitif,
          String(reponse.status),
        );
      }

      return { reference: this.extraireReference(corps, destinataire) };
    } catch (e) {
      if (e instanceof EchecEnvoi) throw e;
      if ((e as Error).name === 'AbortError') {
        // Un timeout n'est JAMAIS définitif, mais il est ambigu : la passerelle
        // a peut-être déjà pris le message en charge. On rejouera, au risque
        // d'un doublon — un voyageur prévenu deux fois est un désagrément,
        // un voyageur jamais prévenu est un siège vide.
        throw new EchecEnvoi(`Délai dépassé (${this.timeoutMs} ms)`, false, 'TIMEOUT');
      }
      throw new EchecEnvoi((e as Error).message, false, 'RESEAU');
    } finally {
      clearTimeout(minuteur);
    }
  }

  /**
   * Extrait la référence de la réponse.
   *
   * Tolérant par construction : la réponse peut être du JSON plat, du JSON
   * imbriqué sous `data`, ou du texte brut. Une référence introuvable n'est pas
   * une erreur d'envoi — le message EST parti, et l'échec serait un faux
   * négatif qui déclencherait un second envoi. On fabrique alors une référence
   * locale, préfixée pour qu'on sache qu'elle ne vient pas de l'opérateur.
   */
  private extraireReference(corps: string, destinataire: string): string {
    try {
      const json = JSON.parse(corps) as Record<string, unknown>;
      const plat = json[this.champRef];
      if (typeof plat === 'string' || typeof plat === 'number') return String(plat);

      const data = json['data'];
      if (data && typeof data === 'object') {
        const imbrique = (data as Record<string, unknown>)[this.champRef];
        if (typeof imbrique === 'string' || typeof imbrique === 'number') return String(imbrique);
      }
    } catch {
      // Réponse non-JSON : on retombe sur la référence locale.
    }

    const locale = `LOCAL-${Date.now()}-${destinataire.slice(-4)}`;
    this.logger.warn(
      `Réponse opérateur sans champ « ${this.champRef} » — référence locale ${locale}`,
    );
    return locale;
  }
}