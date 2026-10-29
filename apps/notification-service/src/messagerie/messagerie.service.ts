// apps/notification-service/src/messagerie/messagerie.service.ts
//
// Vidange de la file des messages aux voyageurs.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE MODÈLE RETENU : FILE EN BASE, PAS ENVOI DIRECT
// ═══════════════════════════════════════════════════════════════════════════
// Les messages sont créés en base, à l'état EN_ATTENTE, DANS la transaction qui
// arrête la liste (voir ListeStateMachine.emettreManifeste). Ce service les
// consomme ensuite, de façon asynchrone.
//
// La raison est simple : un opérateur téléphonique est indisponible, lent, ou
// facturé à l'appel. Si l'envoi était fait dans la transaction d'arrêté, une
// panne de la passerelle ferait échouer l'arrêté du commandant de base —
// c'est-à-dire qu'un dysfonctionnement chez un prestataire civil bloquerait un
// acte de commandement. Inacceptable.
//
// Conséquence assumée : l'arrêté réussit, et les messages peuvent partir avec
// du retard. C'est le bon compromis, et la supervision expose l'état de la file
// pour que le retard soit visible plutôt que subi.

import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { StatutMessage } from '@sigea/shared-types';
import { OPERATEUR_SMS, OperateurSms, EchecEnvoi } from './operateur.port';

/** Nombre maximal de tentatives avant abandon définitif. */
const MAX_TENTATIVES = 5;

/**
 * Attente avant nouvelle tentative, en minutes, indexée par nombre d'échecs.
 *
 * Progression douce et bornée : un vol part dans quelques heures, un délai
 * exponentiel classique (1, 2, 4, 8, 16 h) ferait arriver le dernier essai
 * après le décollage. Au-delà de cinq tentatives, c'est à un humain d'agir.
 */
const ATTENTE_MINUTES = [0, 2, 5, 15, 30];

/** Taille d'un lot de vidange. Modeste : on ménage la passerelle. */
const TAILLE_LOT = 20;

/** Période de la boucle de reprise. */
const PERIODE_MS = 60_000;

@Injectable()
export class MessagerieService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagerieService.name);
  private boucle?: ReturnType<typeof setInterval>;
  private enCours = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OPERATEUR_SMS) private readonly operateur: OperateurSms,
  ) {}

  onModuleInit(): void {
    this.logger.log(`Messagerie active — opérateur : ${this.operateur.nom}`);
    // setInterval plutôt qu'un ordonnanceur : une seule tâche périodique ne
    // justifie pas une dépendance supplémentaire, et le verrou `enCours`
    // suffit à empêcher deux vidanges concurrentes dans le même processus.
    this.boucle = setInterval(() => void this.vidanger(), PERIODE_MS);
  }

  onModuleDestroy(): void {
    if (this.boucle) clearInterval(this.boucle);
  }

  /**
   * Envoie les messages prêts à partir.
   *
   * « Prêts » signifie : en attente, et dont le délai de reprise est écoulé.
   * Le délai se calcule sur `updatedAt`, qui porte la date du dernier essai —
   * aucune colonne supplémentaire n'est nécessaire, et le schéma reste stable.
   */
  async vidanger(liste_id?: string): Promise<{ envoyes: number; echecs: number }> {
    if (this.enCours && !liste_id) return { envoyes: 0, echecs: 0 };
    this.enCours = true;

    try {
      const maintenant = Date.now();

      const candidats = await this.prisma.messageVoyageur.findMany({
        where: {
          statut: StatutMessage.EN_ATTENTE,
          nb_tentatives: { lt: MAX_TENTATIVES },
          ...(liste_id ? { liste_id } : {}),
        },
        orderBy: { createdAt: 'asc' },
        take: TAILLE_LOT,
      });

      const prets = candidats.filter((m) => {
        const attente = ATTENTE_MINUTES[m.nb_tentatives] ?? 30;
        return maintenant - m.updatedAt.getTime() >= attente * 60_000;
      });
      if (!prets.length) return { envoyes: 0, echecs: 0 };

      let envoyes = 0;
      let echecs  = 0;

      // Séquentiel, et non en parallèle : les passerelles appliquent des
      // limites de débit, et dépasser la cadence autorisée fait rejeter le lot
      // entier. Vingt messages à la minute suffisent largement au besoin.
      for (const m of prets) {
        const numero = this.normaliser(m.telephone);
        if (!numero) {
          await this.marquerEchecDefinitif(m.id, 'Numéro inexploitable');
          echecs += 1;
          continue;
        }

        try {
          const { reference } = await this.operateur.envoyer(numero, m.contenu);
          await this.prisma.messageVoyageur.update({
            where: { id: m.id },
            data: {
              statut: StatutMessage.ENVOYE,
              operateur_ref: reference,
              envoye_le: new Date(),
              nb_tentatives: { increment: 1 },
              derniere_erreur: null,
            },
          });
          envoyes += 1;
        } catch (e) {
          echecs += 1;
          const erreur = e instanceof EchecEnvoi ? e : new EchecEnvoi(String(e), false);
          const tentatives = m.nb_tentatives + 1;
          const abandon = erreur.permanent || tentatives >= MAX_TENTATIVES;

          await this.prisma.messageVoyageur.update({
            where: { id: m.id },
            data: {
              statut: abandon ? StatutMessage.ECHEC : StatutMessage.EN_ATTENTE,
              nb_tentatives: tentatives,
              derniere_erreur: `${erreur.code ?? 'ERR'} — ${erreur.message}`.slice(0, 500),
            },
          });

          if (abandon) {
            this.logger.error(
              `Message ${m.id} abandonné après ${tentatives} tentative(s) : ${erreur.message}`,
            );
          }
        }
      }

      if (envoyes || echecs) {
        this.logger.log(`Vidange : ${envoyes} envoyé(s), ${echecs} en échec`);
      }
      return { envoyes, echecs };
    } finally {
      this.enCours = false;
    }
  }

  /** État de la file pour une liste : alimente l'écran de supervision. */
  async etat(liste_id: string): Promise<unknown> {
    const [parStatut, echecs] = await Promise.all([
      this.prisma.messageVoyageur.groupBy({
        by: ['statut'],
        where: { liste_id },
        _count: { _all: true },
      }),
      this.prisma.messageVoyageur.findMany({
        where: { liste_id, statut: StatutMessage.ECHEC },
        select: { id: true, telephone: true, nb_tentatives: true, derniere_erreur: true },
      }),
    ]);

    const compte = (s: StatutMessage): number =>
      parStatut.find((g) => (g.statut as unknown as StatutMessage) === s)?._count._all ?? 0;

    return {
      operateur:  this.operateur.nom,
      en_attente: compte(StatutMessage.EN_ATTENTE),
      envoyes:    compte(StatutMessage.ENVOYE),
      echecs:     compte(StatutMessage.ECHEC),
      // Les numéros sont masqués : cet écran est consulté par plusieurs
      // personnes, et le détail d'un échec n'exige pas le numéro en clair.
      detail_echecs: echecs.map((e) => ({
        id: e.id,
        telephone: this.masquer(e.telephone),
        nb_tentatives: e.nb_tentatives,
        erreur: e.derniere_erreur,
      })),
    };
  }

  /**
   * Remet en file les messages en échec d'une liste.
   *
   * Action humaine explicite : un abandon signifie qu'une cause extérieure a
   * été constatée — crédit épuisé, passerelle en panne, numéro corrigé. Rejouer
   * automatiquement un abandon ferait boucler indéfiniment le cas du numéro
   * définitivement faux.
   */
  async relancer(liste_id: string): Promise<{ relances: number }> {
    const { count } = await this.prisma.messageVoyageur.updateMany({
      where: { liste_id, statut: StatutMessage.ECHEC },
      data:  { statut: StatutMessage.EN_ATTENTE, nb_tentatives: 0, derniere_erreur: null },
    });
    if (count) {
      this.logger.log(`Relance manuelle : ${count} message(s) remis en file (liste ${liste_id})`);
      void this.vidanger(liste_id);
    }
    return { relances: count };
  }

  /**
   * Normalise un numéro vers E.164, plan camerounais.
   *
   * Les numéros arrivent sous toutes les formes : « 677 12 34 56 »,
   * « 00237677123456 », « +237-677-12-34-56 ». La passerelle, elle, n'en
   * accepte qu'une. Normaliser au moment de l'envoi, et non à la saisie, évite
   * de rejeter un enregistrement pour une question de mise en forme — le
   * secrétaire a mieux à faire que de deviner un format.
   *
   * Renvoie `null` si le numéro reste inexploitable : c'est un échec définitif,
   * pas un échec réseau, et il doit être signalé tel quel.
   */
  private normaliser(brut: string): string | null {
    let n = brut.replace(/[^\d+]/g, '');

    if (n.startsWith('00')) n = `+${n.slice(2)}`;
    if (!n.startsWith('+')) {
      // Un numéro camerounais national compte 9 chiffres depuis 2015 et
      // commence par 2 (fixe) ou 6 (mobile).
      if (/^[26]\d{8}$/.test(n)) n = `+237${n}`;
      else if (/^237[26]\d{8}$/.test(n)) n = `+${n}`;
      else return null;
    }

    // Longueur E.164 : indicatif compris, entre 8 et 15 chiffres.
    return /^\+\d{8,15}$/.test(n) ? n : null;
  }

  private async marquerEchecDefinitif(id: string, motif: string): Promise<void> {
    await this.prisma.messageVoyageur.update({
      where: { id },
      data: {
        statut: StatutMessage.ECHEC,
        nb_tentatives: MAX_TENTATIVES,
        derniere_erreur: motif,
      },
    });
  }

  private masquer(numero: string): string {
    return numero.length > 4 ? `${numero.slice(0, 4)}****${numero.slice(-2)}` : '****';
  }
}