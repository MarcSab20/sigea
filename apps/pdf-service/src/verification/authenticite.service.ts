// apps/pdf-service/src/verification/authenticite.service.ts
//
// Construction du cartouche d'authenticité et vérification publique.
//
// ── Évolution du 21/08/2026 ──
// Le dispositif passe de UN à DEUX facteurs :
//   1. l'empreinte SHA-256 du contenu  → « ce document a-t-il été altéré ? »
//   2. le numéro de contrôle           → « ce QR appartient-il à CE document ? »
//
// Le premier seul laissait passer l'attaque la plus simple : photographier le
// QR d'un manifeste authentique et le recoller sur un faux. Le verdict restait
// AUTHENTIQUE, puisque le QR pointe bien vers un état signé — celui de l'autre
// document. Le numéro de contrôle, imprimé en clair SOUS le QR et encodé DANS
// le QR, rend la substitution visible.

import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { SnapshotService, empreinteCourte } from '@sigea/shared-integrity';
import { NumeroControleService } from './numero-controle.service';

export interface CartoucheAuthenticite {
  hash: string;
  hash_court: string;
  etape: string;
  date: Date;
  qr_data_uri: string;
  url: string;
  /**
   * Numéro EN CLAIR, à imprimer sous le QR.
   *
   * C'est le seul endroit de la chaîne d'impression où il apparaît. Il ne
   * transite ni par un journal, ni par une réponse d'API non authentifiée.
   */
  numero_controle: string;
}

export type VerdictAuthenticite =
  | 'AUTHENTIQUE'
  | 'AUTHENTIQUE_NUMERO_DISCORDANT'
  | 'PERIME'
  | 'INCONNU'
  | 'NON_VERIFIABLE';

export interface ResultatVerification {
  verdict: VerdictAuthenticite;
  message: string;
  etape?: string;
  date_signature?: Date;
  reference?: string;
  /**
   * true  : le numéro présenté correspond ;
   * false : il ne correspond pas — document très probablement recomposé ;
   * null  : aucun numéro présenté, ou manifeste antérieur au dispositif.
   */
  numero_concordant?: boolean | null;
  /** Forme masquée « CM-****-****-7T1D », publiable sans risque. */
  numero_masque?: string | null;
}

@Injectable()
export class AuthenticiteService {
  private readonly logger = new Logger(AuthenticiteService.name);

  constructor(
    private readonly snapshots: SnapshotService,
    private readonly numeros: NumeroControleService,
  ) {}

  private baseUrl(): string {
    return (process.env.VERIFICATION_PUBLIC_URL ?? 'https://sigea.mindef.cm').replace(/\/+$/, '');
  }

  /**
   * Cartouche à imprimer, ou null si le manifeste n'a aucun instantané.
   *
   * Le QR est généré en correction d'erreur 'H' (~30 % de redondance) : un
   * document manipulé sur un tarmac, plié, taché ou photocopié doit rester
   * scannable. C'est le paramètre qui compte le plus en pratique.
   *
   * L'ajout du paramètre `n` allonge l'URL d'une vingtaine de caractères. À ce
   * volume, le QR reste en version 6-8 avec 'H' : aucune perte de robustesse
   * mesurable. Si vous chargiez davantage la charge utile, il faudrait
   * repasser en 'Q' — et l'arbitrage se ferait au détriment du terrain.
   */
  async cartouche(manifeste_id: string): Promise<CartoucheAuthenticite | null> {
    const courant = await this.snapshots.empreinteCourante(manifeste_id);
    if (!courant || courant.hash === 'non-verifiable') return null;

    // Émission paresseuse : le numéro naît à la première impression.
    const { code } = await this.numeros.obtenir(manifeste_id, courant.etape);

    const url =
      `${this.baseUrl()}/verification/${manifeste_id}` +
      `?h=${courant.hash}&n=${encodeURIComponent(code)}`;

    const qr_data_uri = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: { dark: '#123a8fff', light: '#ffffffff' },
    });

    return {
      hash: courant.hash,
      hash_court: empreinteCourte(courant.hash),
      etape: courant.etape,
      date: courant.date,
      qr_data_uri,
      url,
      numero_controle: code,
    };
  }

  /**
   * Vérifie un document présenté.
   *
   * Ne renvoie AUCUN contenu de manifeste : cet endpoint est public et non
   * authentifié. Il répond « ce papier correspond-il à un état signé », pas
   * « que contient ce vol ». Divulguer la liste des passagers d'un vol
   * sensible à quiconque scanne un QR serait une fuite majeure.
   *
   * Le numéro n'est jamais renvoyé en clair : seule sa forme masquée l'est,
   * et seulement lorsqu'il concorde.
   */
  async verifier(
    manifeste_id: string,
    hash: string,
    numero?: string,
  ): Promise<ResultatVerification> {
    const normalise = hash.trim().toLowerCase();
    const r = await this.snapshots.verifier(manifeste_id, normalise);

    if (!r.connu) {
      this.logger.warn(
        `Vérification en échec : manifeste=${manifeste_id} hash=${normalise.slice(0, 12)}…`,
      );
      return {
        verdict: 'INCONNU',
        message:
          "Aucune signature ne correspond à ce document. Il n'a pas été produit par SIGVEA, " +
          'ou son empreinte a été altérée.',
        numero_concordant: null,
      };
    }

    const reference = manifeste_id.slice(0, 8).toUpperCase();

    if (!r.conforme) {
      // On ne pousse pas plus loin : le contenu ayant changé, la question du
      // numéro est secondaire — le tirage est à refaire dans tous les cas.
      return {
        verdict: 'PERIME',
        message:
          'Ce document correspond à un état signé, mais le manifeste a été modifié depuis. ' +
          "Le tirage présenté n'est plus à jour : exiger une réimpression.",
        etape: r.etape,
        date_signature: r.date,
        reference,
        numero_concordant: null,
      };
    }

    // ── Second facteur ──
    const concordant = await this.numeros.concordant(manifeste_id, numero);

    if (concordant === false) {
      this.logger.warn(
        `ALERTE : empreinte valide mais numéro discordant — manifeste=${manifeste_id}`,
      );
      return {
        verdict: 'AUTHENTIQUE_NUMERO_DISCORDANT',
        message:
          "L'empreinte correspond à un état signé, mais le numéro de contrôle présenté " +
          "n'est pas celui de ce manifeste. Ce code a très probablement été recopié depuis " +
          'un autre document. NE PAS ACCEPTER ce tirage : contacter le commandement de la base.',
        etape: r.etape,
        date_signature: r.date,
        reference,
        numero_concordant: false,
        numero_masque: null,
      };
    }

    const suffixe = await this.numeros.suffixe(manifeste_id);

    return {
      verdict: 'AUTHENTIQUE',
      message:
        concordant === true
          ? "Document authentique. Le contenu et le numéro de contrôle correspondent à l'état signé."
          : "Document authentique quant à son contenu. Aucun numéro de contrôle n'a été présenté : " +
            'comparez celui imprimé sous le code avec le suffixe indiqué ci-dessous.',
      etape: r.etape,
      date_signature: r.date,
      reference,
      numero_concordant: concordant,
      numero_masque: suffixe ? this.numeros.masquer(suffixe) : null,
    };
  }
}