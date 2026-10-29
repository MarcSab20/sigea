// apps/notification-service/src/messagerie/operateur.port.ts
//
// Contrat d'un opérateur de messagerie.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI UN PORT, ET NON UN CLIENT ÉCRIT EN DUR
// ═══════════════════════════════════════════════════════════════════════════
// L'opérateur n'est pas arrêté à ce jour, et il changera : une passerelle
// civile se renégocie, une passerelle SMPP du ministère se substitue à une API
// HTTP. Tout le reste du dispositif — file d'attente, reprise sur échec,
// supervision — est indépendant de ce choix. Le port isole la seule partie qui
// bouge, et les quelque 300 lignes qui l'entourent n'auront pas à être
// relues le jour où l'on bascule.
//
// L'implémentation concrète à fournir tient dans une classe et une méthode.

/** Issue d'un envoi réussi. */
export interface ResultatEnvoi {
  /**
   * Référence rendue par l'opérateur.
   *
   * C'est la SEULE preuve de prise en charge. Un opérateur qui n'en rend pas
   * doit se voir attribuer une référence locale par son adaptateur, faute de
   * quoi on ne saurait pas distinguer « envoyé » de « cru envoyé ».
   */
  reference: string;
}

/**
 * Échec d'envoi.
 *
 * `permanent` est le champ qui compte. Un numéro inexistant ne deviendra pas
 * valide en réessayant : le rejouer vingt fois consomme du crédit et retarde
 * les messages qui, eux, peuvent partir. Une coupure réseau, à l'inverse, se
 * résout toute seule. Confondre les deux produit soit une file bloquée, soit
 * une facture inutile.
 */
export class EchecEnvoi extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'EchecEnvoi';
  }
}

export interface OperateurSms {
  /** Nom court, journalisé et affiché en supervision. */
  readonly nom: string;

  /**
   * Envoie un message.
   *
   * @param destinataire Numéro au format E.164 (« +237… »). La normalisation
   *                     est faite en amont par MessagerieService : un
   *                     adaptateur n'a pas à connaître le plan de numérotation
   *                     camerounais.
   * @throws EchecEnvoi
   */
  envoyer(destinataire: string, contenu: string): Promise<ResultatEnvoi>;
}

/** Jeton d'injection : le port est une interface, elle ne survit pas à la compilation. */
export const OPERATEUR_SMS = Symbol('OPERATEUR_SMS');