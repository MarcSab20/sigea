// apps/pdf-service/src/verification/authenticite.service.ts
//
// Construction du cartouche d'authenticité et vérification publique.

import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { SnapshotService, empreinteCourte } from '@sigea/shared-integrity';

export interface CartoucheAuthenticite {
  hash: string;
  hash_court: string;
  etape: string;
  date: Date;
  qr_data_uri: string;
  url: string;
}

/** Verdict rendu au public. Volontairement à trois états, pas deux. */
export type VerdictAuthenticite =
  | 'AUTHENTIQUE'
  | 'PERIME'
  | 'INCONNU'
  | 'NON_VERIFIABLE';

export interface ResultatVerification {
  verdict: VerdictAuthenticite;
  message: string;
  /** Métadonnées non sensibles. Jamais de contenu de manifeste ici. */
  etape?: string;
  date_signature?: Date;
  reference?: string;
}

@Injectable()
export class AuthenticiteService {
  private readonly logger = new Logger(AuthenticiteService.name);

  constructor(private readonly snapshots: SnapshotService) {}

  /** Base publique de l'URL de vérification, sans slash final. */
  private baseUrl(): string {
    return (process.env.VERIFICATION_PUBLIC_URL ?? 'https://sigea.mindef.cm').replace(/\/+$/, '');
  }

  /**
   * Cartouche à imprimer, ou null si le manifeste n'a aucun instantané.
   *
   * Le QR est généré en correction d'erreur 'H' (~30 % de redondance) : un
   * document manipulé sur un tarmac, plié, taché ou photocopié doit rester
   * scannable. C'est le paramètre qui compte le plus en pratique.
   */
  async cartouche(manifeste_id: string): Promise<CartoucheAuthenticite | null> {
    const courant = await this.snapshots.empreinteCourante(manifeste_id);
    if (!courant || courant.hash === 'non-verifiable') return null;

    const url = `${this.baseUrl()}/verification/${manifeste_id}?h=${courant.hash}`;

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
    };
  }

  /**
   * Vérifie un document présenté.
   *
   * Ne renvoie AUCUN contenu de manifeste : cet endpoint est public et non
   * authentifié. Il répond « ce papier correspond-il à un état signé », pas
   * « que contient ce vol ». Divulguer la liste des passagers d'un vol
   * sensible à quiconque scanne un QR serait une fuite majeure.
   */
  async verifier(manifeste_id: string, hash: string): Promise<ResultatVerification> {
    // Normalisation : un hash recopié à la main arrive en majuscules, et la
    // forme courte (16 caractères) doit être acceptée au même titre.
    const normalise = hash.trim().toLowerCase();

    const r = await this.snapshots.verifier(manifeste_id, normalise);

    if (!r.connu) {
      this.logger.warn(`Vérification en échec : manifeste=${manifeste_id} hash=${normalise.slice(0, 12)}…`);
      return {
        verdict: 'INCONNU',
        message:
          "Aucune signature ne correspond à ce document. Il n'a pas été produit par SIGEA, " +
          'ou son empreinte a été altérée.',
      };
    }

    if (!r.conforme) {
      return {
        verdict: 'PERIME',
        message:
          'Ce document correspond à un état signé, mais le manifeste a été modifié depuis. ' +
          "Le tirage présenté n'est plus à jour : exiger une réimpression.",
        etape: r.etape,
        date_signature: r.date,
        reference: manifeste_id.slice(0, 8).toUpperCase(),
      };
    }

    return {
      verdict: 'AUTHENTIQUE',
      message: 'Document authentique. Son contenu correspond exactement à l\'état signé.',
      etape: r.etape,
      date_signature: r.date,
      reference: manifeste_id.slice(0, 8).toUpperCase(),
    };
  }
}
