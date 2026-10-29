// apps/notification-service/src/messagerie/adapters/journal-operateur.adapter.ts
//
// Opérateur de substitution : écrit le message au journal, n'envoie rien.
//
// ── Pourquoi il existe, et pourquoi il est bruyant ──
// Sans lui, un environnement de recette sans passerelle laisserait la file
// s'accumuler en erreur, et l'on ne saurait pas distinguer « pas configuré »
// de « configuré et cassé ». Il permet aussi de relire exactement ce que
// recevront les voyageurs avant la mise en service.
//
// Il journalise en AVERTISSEMENT et non en information, à dessein : s'il tourne
// en production, cela doit sauter aux yeux dans les journaux. Un dispositif de
// substitution silencieux finit toujours par être oublié en place.

import { Injectable, Logger } from '@nestjs/common';
import { OperateurSms, ResultatEnvoi } from '../operateur.port';

@Injectable()
export class JournalOperateurAdapter implements OperateurSms {
  readonly nom = 'journal (aucun envoi réel)';
  private readonly logger = new Logger(JournalOperateurAdapter.name);

  envoyer(destinataire: string, contenu: string): Promise<ResultatEnvoi> {
    this.logger.warn(
      `AUCUN OPÉRATEUR CONFIGURÉ — message NON envoyé à ${this.masquer(destinataire)} : ` +
        `« ${contenu} »`,
    );
    return Promise.resolve({ reference: `JOURNAL-${Date.now()}` });
  }

  /**
   * Masque le numéro dans le journal.
   *
   * Les journaux sont conservés, exportés, parfois lus par des prestataires.
   * Un numéro de téléphone de militaire n'a pas à y figurer en clair, même
   * dans un environnement de recette alimenté par des données réelles.
   */
  private masquer(numero: string): string {
    return numero.length > 4 ? `${numero.slice(0, 4)}****${numero.slice(-2)}` : '****';
  }
}