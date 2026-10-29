// apps/liste-service/src/circuit/liste-state-machine.ts
//
// Cœur du circuit : SEC_ADJ_AIR → ADJ_AIR → COMRMIA → COMBASE → COMBORD.
//
// ═══════════════════════════════════════════════════════════════════════════
// LES QUATRE INVARIANTS QUE CE FICHIER TIENT
// ═══════════════════════════════════════════════════════════════════════════
//
// 1. UN VISA PORTE SUR UN CONTENU, PAS SUR UNE DATE.
//    Chaque apposition fige un instantané (ListeSnapshot) DANS la transaction.
//    Un visa sans instantané serait une signature dont on ignore l'objet.
//
// 2. L'ORDRE DES ESCALES EST STRICT.
//    « Le manifeste de l'escale n+1 doit être validé après celui de l'escale
//    n. » Contrôlé à l'étape COMBASE, parce que c'est là que le manifeste est
//    émis — le contrôler plus tôt bloquerait inutilement la saisie des RMIA
//    aval, qui peuvent légitimement travailler en parallèle.
//
// 3. LA SIGNATURE DU COMBASE RESTE LA SIENNE, MÊME DÉLÉGUÉE.
//    Le COMGMO ou le COMSECBASE discrimine et déclenche ; le visa imprimé
//    porte le nom du commandant de base, et la note de délégation — non
//    imprimée — conserve qui a agi. C'est littéralement ce que décrit la
//    directive.
//
// 4. LE MANIFESTE NAÎT À L'ARRÊTÉ, PAS AVANT.
//    Il est l'extrait des seules lignes hiérarchisées. La liste d'attente ne
//    le franchit jamais.

import {
  Injectable, BadRequestException, ForbiddenException, NotFoundException,
  ConflictException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@sigea/shared-database';
import { ListeSnapshotService } from '@sigea/shared-integrity';
import { EventPublisher } from '@sigea/shared-messaging';
import { LISTE_EVENTS } from '@sigea/shared-events';
import {
  JwtPayload, RoleUtilisateur, Rmia, EtapeListe, StatutListe, StatutManifeste,
  NatureLigne, MentionVisa, StatutConsigne, StatutMessage,
  ETAPE_LISTE_SEQUENCE, ETAPE_LISTE_TO_ROLE, MENTION_PAR_ETAPE, LIBELLE_ETAPE_LISTE,
  ETAPE_BLOQUEE_PAR_CONSIGNE, ETAPE_EMISSION_MANIFESTE,
  etapeListeSuivante, rangEtapeListe, estEtapeListeFinale,
  rolesEffectifs, delegationPourRole, rmiasCouvertes,
  titreSignataire, ROLES_DELEGATAIRES_COMBASE,
} from '@sigea/shared-types';

export interface ViserDto {
  commentaire?: string;
  /**
   * Note de délégation, obligatoire lorsque le COMBASE fait signer par le
   * COMGMO ou le COMSECBASE. Non imprimée sur le document, conservée pour
   * l'archivage.
   */
  note_delegation?: string;
}

export interface BlocVisa {
  etape:      EtapeListe;
  libelle:    string;
  rang:       number;
  appose:     boolean;
  mention:    MentionVisa | null;
  date_heure: Date | null;
  signataire: { nom: string; prenom: string; grade: string; titre: string } | null;
  par_delegation: boolean;
  par_interim:    boolean;
  hash_court:     string | null;
}

export interface AvancementListe {
  liste_id:       string;
  statut:         StatutListe;
  etape_courante: EtapeListe | null;
  rang_courant:   number;
  total_etapes:   number;
  blocs:          BlocVisa[];
  consignes_bloquantes: {
    id: string; autorite: string; statut: StatutConsigne; observation: string | null;
  }[];
  /** Listes amont non encore arrêtées, qui interdisent l'arrêté de celle-ci. */
  escales_amont_en_attente: { ordre: number; statut: StatutListe }[];
}

@Injectable()
export class ListeStateMachine {
  private readonly logger = new Logger(ListeStateMachine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: ListeSnapshotService,
    private readonly events: EventPublisher,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // Apposition d'un visa
  // ═══════════════════════════════════════════════════════════════════════

  async viser(liste_id: string, user: JwtPayload, dto: ViserDto): Promise<unknown> {
    const liste = await this.charger(liste_id, user);
    const etape = liste.etape_courante as EtapeListe | null;

    if (!etape) {
      throw new ConflictException("Cette liste n'attend aucune signature.");
    }
    if (liste.statut === StatutListe.CLOTUREE) {
      throw new BadRequestException('Circuit terminé : le manifeste est définitif.');
    }

    const { signataire, delegataire, delegation } = await this.resoudreSignataire(liste, etape, user);

    // ── Contrôles propres à chaque étape ──
    if (etape === EtapeListe.SEC_ADJ_AIR) {
      await this.verifierListeNonVide(liste_id);
    }
    if (etape === ETAPE_EMISSION_MANIFESTE) {
      await this.verifierEscalesAmont(liste.vol_id, liste.etape.ordre);
      if (delegataire && !dto.note_delegation?.trim()) {
        throw new BadRequestException(
          'Discrimination déléguée : une note de délégation est requise pour l\'archivage.',
        );
      }
    }
    if (etape === ETAPE_BLOQUEE_PAR_CONSIGNE) {
      await this.verifierConsignes(liste.vol_id, liste.etape_id, liste_id);
    }

    const suivante = etapeListeSuivante(etape);
    const termine  = estEtapeListeFinale(etape);

    const titre = titreSignataire(ETAPE_LISTE_TO_ROLE[etape], {
      rmia: liste.rmia as Rmia,
      code_base: liste.etape.base.code_base,
    });

    const resultat = await this.prisma.$transaction(async (tx) => {
      // Compare-and-swap sur l'étape : si un autre signataire est passé entre
      // le chargement et ici, count vaut 0 et rien n'est écrit. Pas de verrou
      // explicite, pas d'interblocage possible.
      const cas = await tx.listeEmbarquement.updateMany({
        where: { id: liste_id, etape_courante: etape },
        data: {
          etape_courante: suivante,
          statut: termine
            ? StatutListe.CLOTUREE
            : etape === ETAPE_EMISSION_MANIFESTE
              ? StatutListe.ARRETEE
              : StatutListe.EN_VALIDATION,
          motif_rejet: null,
        },
      });
      if (cas.count === 0) {
        throw new ConflictException('Étape déjà franchie par un autre signataire.');
      }

      // Instantané AVANT le visa : il doit refléter le contenu tel qu'il était
      // au moment de la décision, pas après d'éventuels effets de bord.
      const snap = await this.snapshots.figer(liste_id, etape, user.sub, tx, { versionner: true });

      const visa = await tx.visaListe.upsert({
        where:  { liste_id_etape: { liste_id, etape } },
        update: {
          mention: MENTION_PAR_ETAPE[etape], date_heure: new Date(),
          signataire_id: signataire.id,
          signataire_nom: signataire.nom, signataire_prenom: signataire.prenom,
          signataire_grade: signataire.grade, signataire_titre: titre,
          delegataire_id:    delegataire?.id    ?? null,
          delegataire_nom:   delegataire?.nom   ?? null,
          delegataire_grade: delegataire?.grade ?? null,
          note_delegation:   dto.note_delegation?.trim() ?? null,
          par_interim:    Boolean(delegation),
          interim_id:     delegation?.id ?? null,
          titulaire_nom:   delegation ? signataire.nom   : null,
          titulaire_grade: delegation ? signataire.grade : null,
          hash_contenu: snap.hash, version_contenu: snap.version,
          commentaire: dto.commentaire ?? null,
        },
        create: {
          liste_id, etape, mention: MENTION_PAR_ETAPE[etape],
          signataire_id: signataire.id,
          signataire_nom: signataire.nom, signataire_prenom: signataire.prenom,
          signataire_grade: signataire.grade, signataire_titre: titre,
          delegataire_id:    delegataire?.id    ?? null,
          delegataire_nom:   delegataire?.nom   ?? null,
          delegataire_grade: delegataire?.grade ?? null,
          note_delegation:   dto.note_delegation?.trim() ?? null,
          par_interim:    Boolean(delegation),
          interim_id:     delegation?.id ?? null,
          titulaire_nom:   delegation ? signataire.nom   : null,
          titulaire_grade: delegation ? signataire.grade : null,
          hash_contenu: snap.hash, version_contenu: snap.version,
          commentaire: dto.commentaire ?? null,
        },
      });

      let manifeste_id: string | null = null;
      if (etape === ETAPE_EMISSION_MANIFESTE) {
        manifeste_id = await this.emettreManifeste(tx, liste, user.sub);
      }
      if (termine) {
        manifeste_id = await this.rendreDefinitif(tx, liste_id);
      }

      return { visa, manifeste_id, hash: snap.hash };
    });

    await this.publierApresVisa(liste, etape, suivante, user, resultat, dto);

    this.logger.log(
      `Visa ${etape} apposé sur liste ${liste_id} par ${user.sub}` +
        (delegataire ? ` (délégation à ${delegataire.id})` : '') +
        ` — suivante : ${suivante ?? 'FIN'}`,
    );

    return { etape, mention: MENTION_PAR_ETAPE[etape], etape_suivante: suivante, ...resultat };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Renvoi en arrière
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Renvoie la liste à une étape amont.
   *
   * Les visas AVAL n'existent pas — le séquencement est strict. Les visas
   * AMONT, eux, sont purgés : ils portaient sur un contenu que la correction
   * va modifier, et les laisser en place ferait croire que l'ADJ_AIR a vu une
   * liste qu'il n'a jamais vue. Les INSTANTANÉS, en revanche, sont conservés :
   * ils constituent l'historique probant du dossier.
   */
  async rejeter(
    liste_id: string, user: JwtPayload,
    params: { motif: string; etape_retour?: EtapeListe },
  ): Promise<unknown> {
    if (!params.motif?.trim()) {
      throw new BadRequestException('Un motif est obligatoire pour renvoyer une liste.');
    }

    const liste = await this.charger(liste_id, user);
    const etape = liste.etape_courante as EtapeListe | null;
    if (!etape) throw new ConflictException("Cette liste n'attend aucune action.");

    await this.resoudreSignataire(liste, etape, user);

    const retour = params.etape_retour ?? EtapeListe.SEC_ADJ_AIR;
    if (rangEtapeListe(retour) >= rangEtapeListe(etape)) {
      throw new BadRequestException(
        `On ne renvoie qu'en arrière : ${retour} n'est pas antérieure à ${etape}.`,
      );
    }
    if (liste.statut === StatutListe.CLOTUREE) {
      throw new BadRequestException('Le manifeste est définitif : plus aucun renvoi possible.');
    }

    await this.prisma.$transaction(async (tx) => {
      const cas = await tx.listeEmbarquement.updateMany({
        where: { id: liste_id, etape_courante: etape },
        data: {
          etape_courante: retour,
          statut: retour === EtapeListe.SEC_ADJ_AIR ? StatutListe.REJETEE : StatutListe.EN_VALIDATION,
          motif_rejet: params.motif.trim(),
        },
      });
      if (cas.count === 0) {
        throw new ConflictException('Étape déjà traitée par un autre signataire.');
      }

      // L'état rejeté est figé AVANT la purge : c'est le seul moment où le
      // contenu exact soumis aux signataires amont est encore intact.
      await this.snapshots.figer(liste_id, `${etape}_REJET`, user.sub, tx, { versionner: true });

      const aPurger = ETAPE_LISTE_SEQUENCE.filter(
        (e) => rangEtapeListe(e) >= rangEtapeListe(retour),
      );
      await tx.visaListe.deleteMany({ where: { liste_id, etape: { in: aPurger } } });

      // Un manifeste déjà émis devient caduc. Il est annulé, pas supprimé :
      // un numéro de manifeste attribué ne se réutilise pas.
      await tx.manifeste.updateMany({
        where: { liste_id, statut: StatutManifeste.EMIS },
        data:  { statut: StatutManifeste.ANNULE },
      });
      // Les messages non encore partis sont retirés de la file : prévenir des
      // passagers d'un embarquement annulé coûte plus cher que de ne rien dire.
      await tx.messageVoyageur.deleteMany({
        where: { liste_id, statut: StatutMessage.EN_ATTENTE },
      });
      // Le verrou posé à l'arrêté est levé : la liste redevient modifiable.
      await tx.ligneListe.updateMany({
        where: { liste_id, origine: 'SAISIE' },
        data:  { verrouille: false },
      });
    });

    await this.events.publish(LISTE_EVENTS.LISTE_REJETEE, {
      liste_id, vol_id: liste.vol_id, rmia: liste.rmia as Rmia,
      etape, etape_retour: retour, motif: params.motif.trim(),
      rejete_par: user.sub, timestamp: new Date().toISOString(),
    });

    this.logger.warn(
      `Liste ${liste_id} renvoyée de ${etape} vers ${retour} par ${user.sub} — ${params.motif}`,
    );
    return { etape_courante: retour, motif: params.motif.trim() };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Avancement
  // ═══════════════════════════════════════════════════════════════════════

  async avancement(liste_id: string, user: JwtPayload): Promise<AvancementListe> {
    const liste = await this.charger(liste_id, user, { pourSignature: false });

    const [visas, consignes, amont] = await Promise.all([
      this.prisma.visaListe.findMany({ where: { liste_id } }),
      this.consignesNonConfirmees(liste.vol_id, liste.etape_id),
      this.prisma.listeEmbarquement.findMany({
        where: { vol_id: liste.vol_id, etape: { ordre: { lt: liste.etape.ordre } } },
        select: { statut: true, etape: { select: { ordre: true } } },
      }),
    ]);

    const parEtape = new Map(visas.map((v) => [v.etape as unknown as EtapeListe, v]));

    return {
      liste_id,
      statut:         liste.statut as unknown as StatutListe,
      etape_courante: liste.etape_courante as EtapeListe | null,
      rang_courant:   liste.etape_courante
        ? rangEtapeListe(liste.etape_courante as EtapeListe) : 0,
      total_etapes:   ETAPE_LISTE_SEQUENCE.length,
      blocs: ETAPE_LISTE_SEQUENCE.map((etape) => {
        const v = parEtape.get(etape);
        return {
          etape,
          libelle: LIBELLE_ETAPE_LISTE[etape],
          rang:    rangEtapeListe(etape),
          appose:  Boolean(v),
          mention: (v?.mention as unknown as MentionVisa) ?? null,
          date_heure: v?.date_heure ?? null,
          signataire: v
            ? {
                nom: v.signataire_nom, prenom: v.signataire_prenom,
                grade: v.signataire_grade, titre: v.signataire_titre,
              }
            : null,
          par_delegation: Boolean(v?.delegataire_id),
          par_interim:    v?.par_interim ?? false,
          // Forme courte, comparable de visu sur un document imprimé.
          hash_court: v ? v.hash_contenu.slice(0, 16).toUpperCase() : null,
        };
      }),
      consignes_bloquantes: consignes.map((c) => ({
        id: c.id, autorite: String(c.autorite),
        statut: c.statut_realisation as unknown as StatutConsigne,
        observation: c.observation_realisation,
      })),
      escales_amont_en_attente: amont
        .filter((a) => a.statut !== StatutListe.ARRETEE && a.statut !== StatutListe.CLOTUREE)
        .map((a) => ({ ordre: a.etape.ordre, statut: a.statut as unknown as StatutListe })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Interne
  // ═══════════════════════════════════════════════════════════════════════

  private async charger(liste_id: string, user: JwtPayload, _opts?: { pourSignature?: boolean }) {
    const liste = await this.prisma.listeEmbarquement.findUnique({
      where: { id: liste_id },
      include: {
        etape: {
          select: {
            id: true, ordre: true, base_id: true,
            base: { select: { code_base: true, nom: true } },
          },
        },
        vol: {
          select: {
            id: true, numero_mission: true, date_heure: true, immatriculation: true,
            combord_id: true, flag_sensible: true,
          },
        },
      },
    });
    if (!liste) throw new NotFoundException('Liste introuvable');

    const roles = rolesEffectifs(user);
    const visible =
      rmiasCouvertes(user).includes(liste.rmia as Rmia) ||
      (liste.etape.base_id === user.base_id &&
        roles.some((r) => r === RoleUtilisateur.COMBASE || ROLES_DELEGATAIRES_COMBASE.includes(r))) ||
      (roles.includes(RoleUtilisateur.COMBORD) && liste.vol.combord_id === user.sub) ||
      roles.includes(RoleUtilisateur.ADMIN) ||
      roles.includes(RoleUtilisateur.SCOPS) ||
      roles.includes(RoleUtilisateur.CEMAA) ||
      roles.includes(RoleUtilisateur.MAGE);

    if (!visible) throw new NotFoundException('Liste introuvable');
    return liste;
  }

  /**
   * Détermine qui SIGNE, et qui a agi.
   *
   * Trois cas, et ils ne se confondent pas :
   *   • le titulaire signe lui-même ;
   *   • un suppléant signe au titre d'une délégation d'intérim — le visa porte
   *     la mention P/I et le nom du titulaire empêché ;
   *   • le COMGMO ou le COMSECBASE discrimine POUR le COMBASE — le visa porte
   *     le nom du COMBASE, et la note de délégation conserve qui a agi.
   *
   * Le troisième cas est propre à l'étape COMBASE et vient directement de la
   * directive. Le confondre avec l'intérim produirait un document signé par
   * quelqu'un qui n'est pas commandant de base.
   */
  private async resoudreSignataire(
    liste: { etape: { base_id: string }; rmia: unknown },
    etape: EtapeListe,
    user: JwtPayload,
  ): Promise<{
    signataire: { id: string | null; nom: string; prenom: string; grade: string };
    delegataire: { id: string; nom: string; grade: string } | null;
    delegation: { id: string } | null;
  }> {
    const roleAttendu = ETAPE_LISTE_TO_ROLE[etape];
    const roles = rolesEffectifs(user);

    const moi = await this.prisma.utilisateur.findUnique({
      where: { id: user.sub },
      select: { id: true, nom: true, prenom: true, grade: true },
    });
    if (!moi) throw new NotFoundException('Signataire introuvable');

    // Cas 1 : le titulaire du rôle attendu.
    if (user.role === roleAttendu) {
      return { signataire: moi, delegataire: null, delegation: null };
    }

    // Cas 2 : délégation d'intérim sur ce rôle.
    const delegation = delegationPourRole(user, roleAttendu);
    if (delegation) {
      const active = await this.chargerDelegationActive(delegation.id, user.sub);
      // La délégation est RELUE EN BASE et jamais crue sur parole du jeton :
      // un jeton reste valide 15 minutes, et « fermer les accès » doit fermer
      // les accès, pas les fermer bientôt.
      return {
        signataire: { id: moi.id, nom: moi.nom, prenom: moi.prenom, grade: moi.grade },
        delegataire: null,
        delegation: { id: delegation.id, ...active },
      };
    }

    // Cas 3 : discrimination déléguée par le COMBASE.
    if (etape === EtapeListe.COMBASE &&
        roles.some((r) => ROLES_DELEGATAIRES_COMBASE.includes(r))) {
      const combase = await this.prisma.utilisateur.findFirst({
        where: { role: RoleUtilisateur.COMBASE, base_id: liste.etape.base_id, actif: true },
        select: { id: true, nom: true, prenom: true, grade: true },
      });
      if (!combase) {
        throw new ConflictException(
          "Aucun commandant de base actif sur cette base : la délégation ne peut pas être exercée.",
        );
      }
      return {
        signataire: combase,
        delegataire: { id: moi.id, nom: moi.nom, grade: moi.grade },
        delegation: null,
      };
    }

    throw new ForbiddenException(
      `Ce n'est pas votre tour : la liste attend ${LIBELLE_ETAPE_LISTE[etape]}. ` +
        `Rôles détenus : ${roles.join(', ')}.`,
    );
  }

  private async chargerDelegationActive(
    interim_id: string, suppleant_id: string,
  ): Promise<{ nom: string; grade: string }> {
    const maintenant = new Date();
    const row = await this.prisma.interim.findFirst({
      where: {
        id: interim_id, suppleant_id, actif: true,
        date_debut: { lte: maintenant },
        OR: [{ date_fin: null }, { date_fin: { gt: maintenant } }],
      },
      select: { titulaire: { select: { nom: true, grade: true } } },
    });
    if (!row) {
      throw new ForbiddenException(
        'Votre délégation a été révoquée ou est arrivée à échéance. Reconnectez-vous.',
      );
    }
    return row.titulaire;
  }

  private async verifierListeNonVide(liste_id: string): Promise<void> {
    const n = await this.prisma.ligneListe.count({
      where: { liste_id, nature: NatureLigne.HIERARCHISEE },
    });
    if (n === 0) {
      throw new BadRequestException(
        "La liste hiérarchisée est vide : il n'y a rien à transmettre à l'Adjoint Air.",
      );
    }
  }

  /**
   * « Le manifeste de l'escale n+1 est validé après celui de l'escale n. »
   *
   * Contrôlé ici et pas plus tôt : les RMIA aval peuvent légitimement
   * constituer leurs listes en parallèle, et les bloquer dès la saisie ferait
   * perdre à tout le monde le temps que la directive cherche justement à gagner.
   */
  private async verifierEscalesAmont(vol_id: string, ordre: number): Promise<void> {
    const amont = await this.prisma.listeEmbarquement.findMany({
      where: {
        vol_id,
        etape: { ordre: { lt: ordre } },
        statut: { notIn: [StatutListe.ARRETEE, StatutListe.CLOTUREE] },
      },
      select: { statut: true, etape: { select: { ordre: true, base: { select: { code_base: true } } } } },
      orderBy: { etape: { ordre: 'asc' } },
    });
    if (amont.length) {
      const detail = amont
        .map((a) => `${a.etape.base.code_base} (point ${a.etape.ordre}, ${a.statut})`)
        .join(', ');
      throw new ConflictException(
        `Arrêté impossible : l'escale précédente doit être arrêtée d'abord — ${detail}.`,
      );
    }
  }

  private consignesNonConfirmees(vol_id: string, etape_id: string) {
    return this.prisma.consigneAutorite.findMany({
      where: {
        vol_id,
        OR: [{ etape_id: null }, { etape_id }],
        statut_realisation: { in: [StatutConsigne.EMISE, StatutConsigne.NON_REALISEE] },
      },
      select: {
        id: true, autorite: true,
        statut_realisation: true, observation_realisation: true,
      },
    });
  }

  private async verifierConsignes(
    vol_id: string, etape_id: string, liste_id: string,
  ): Promise<void> {
    const enAttente = await this.consignesNonConfirmees(vol_id, etape_id);
    if (!enAttente.length) return;

    // Le message distingue « pas encore examinée » de « examinée et refusée » :
    // dans le premier cas il faut relancer l'autorité, dans le second corriger
    // le dossier. Confondre les deux fait perdre du temps et pousse à
    // contourner l'outil.
    const nonExaminees = enAttente.filter(
      (c) => (c.statut_realisation as unknown as StatutConsigne) === StatutConsigne.EMISE,
    );
    const refusees = enAttente.filter(
      (c) => (c.statut_realisation as unknown as StatutConsigne) === StatutConsigne.NON_REALISEE,
    );

    const details: string[] = [];
    if (nonExaminees.length) {
      const autorites = [...new Set(nonExaminees.map((c) => String(c.autorite)))].join(' et ');
      details.push(
        `${nonExaminees.length} consigne(s) ${autorites} en attente de confirmation d'exécution`,
      );
    }
    for (const c of refusees) {
      details.push(
        `consigne ${c.autorite} déclarée NON EXÉCUTÉE` +
          (c.observation_realisation ? ` — « ${c.observation_realisation} »` : ''),
      );
    }

    this.logger.warn(`Visa COMBORD bloqué sur liste ${liste_id} : ${enAttente.length} consigne(s)`);
    throw new ForbiddenException(`Visa impossible : ${details.join(' ; ')}.`);
  }

  /**
   * Émet le manifeste à l'arrêté du COMBASE.
   *
   * SEULES les lignes hiérarchisées y sont portées. La liste d'attente n'est
   * pas communiquée — c'est une exigence explicite de la directive, et la
   * respecter ici, à la source, vaut mieux que de la respecter dans chaque
   * écran et chaque gabarit PDF.
   */
  private async emettreManifeste(
    tx: Prisma.TransactionClient,
    liste: {
      id: string; vol_id: string; flag_sensible?: boolean;
      etape: { id: string; ordre: number; base_id: string };
      vol: { numero_mission: string; date_heure: Date; flag_sensible: boolean };
    },
    emis_par: string,
  ): Promise<string> {
    const lignes = await tx.ligneListe.findMany({
      where: { liste_id: liste.id, nature: NatureLigne.HIERARCHISEE },
      orderBy: [{ priorite: 'asc' }, { rang: 'asc' }],
    });
    const frets = await tx.fretListe.findMany({
      where: { liste_id: liste.id, retire: false },
    });

    // Numéro déterministe : mission + rang de l'escale. Un numéro aléatoire
    // obligerait à le chercher pour rapprocher un manifeste de son vol.
    const numero = `${liste.vol.numero_mission}/E${liste.etape.ordre}`;

    const manifeste = await tx.manifeste.create({
      data: {
        vol_id:   liste.vol_id,
        base_id:  liste.etape.base_id,
        liste_id: liste.id,
        etape_id: liste.etape.id,
        numero_manifeste: numero,
        statut:        StatutManifeste.EMIS,
        flag_sensible: liste.vol.flag_sensible,
        emis_par,
        passagers: {
          create: lignes.map((l) => ({
            base_id: liste.etape.base_id,
            ligne_liste_id: l.id,
            priorite: l.priorite, rang: l.rang,
            nom: l.nom, prenom: l.prenom, grade: l.grade,
            categorie: l.categorie, matricule: l.matricule, cni: l.cni,
            unite: l.unite, telephone: l.telephone,
            destination: l.destination, debarquement_ordre: l.debarquement_ordre,
            nb_bagages: l.nb_bagages, masse_bagages_kg: l.masse_bagages_kg,
            couleur_bagages: l.couleur_bagages,
            contact_urgence_nom: l.contact_urgence_nom,
            contact_urgence_tel: l.contact_urgence_tel,
            contact_urgence_qual: l.contact_urgence_qual,
            ref_autorisation: l.ref_autorisation,
            origine: l.origine,
          })),
        },
        materiels: {
          create: frets.map((f) => ({
            base_id: liste.etape.base_id,
            fret_liste_id: f.id,
            designation: f.designation, type_mission_log: f.type_mission_log,
            proprietaire: f.proprietaire, poids_kg: f.poids_kg, volume: f.volume,
            destination: f.destination, debarquement_ordre: f.debarquement_ordre,
            expediteur_nom: f.expediteur_nom,
            expediteur_fonction: f.expediteur_fonction,
            expediteur_tel: f.expediteur_tel,
            classe_iata: f.classe_iata, conditionnement: f.conditionnement,
            origine: f.origine,
          })),
        },
      },
      select: { id: true },
    });

    // Verrou : à partir d'ici, seul le commandant de bord touche à ces lignes.
    await tx.ligneListe.updateMany({
      where: { liste_id: liste.id, nature: NatureLigne.HIERARCHISEE },
      data:  { verrouille: true },
    });

    // Messages aux voyageurs, mis en file. L'envoi effectif relève de la
    // passerelle opérateur : le créer ici, dans la transaction, garantit qu'on
    // ne prévient jamais personne d'un arrêté qui aurait échoué.
    await tx.messageVoyageur.createMany({
      data: lignes.map((l) => ({
        liste_id: liste.id,
        ligne_id: l.id,
        telephone: l.telephone,
        contenu: this.composerMessage(l, liste.vol),
        statut: StatutMessage.EN_ATTENTE,
      })),
    });

    return manifeste.id;
  }

  /**
   * Message pratique adressé au voyageur.
   *
   * Court et sans donnée sensible : il transite par un opérateur civil. Ni
   * matricule, ni unité, ni nature de mission — seulement ce qu'il faut pour
   * se présenter au bon endroit à la bonne heure.
   */
  private composerMessage(
    ligne: { nom: string; prenom: string },
    vol: { numero_mission: string; date_heure: Date },
  ): string {
    const quand = new Date(vol.date_heure).toLocaleString('fr-FR', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Douala',
    });
    return (
      `ARMEE DE L'AIR — ${ligne.nom} ${ligne.prenom}, vous etes retenu(e) sur le vol ` +
      `${vol.numero_mission} du ${quand}. Presentez-vous 2h avant au poste de police ` +
      `de la base, muni d'une piece d'identite. Bagages selon franchise notifiee. ` +
      `Message automatique, ne pas repondre.`
    );
  }

  /** Visa du COMBORD : le manifeste devient opposable. */
  private async rendreDefinitif(
    tx: Prisma.TransactionClient, liste_id: string,
  ): Promise<string | null> {
    const manifeste = await tx.manifeste.findFirst({
      where: { liste_id, statut: StatutManifeste.EMIS },
      select: { id: true },
    });
    if (!manifeste) {
      throw new ConflictException(
        "Aucun manifeste émis pour cette liste : l'arrêté du commandant de base est manquant.",
      );
    }
    await tx.manifeste.update({
      where: { id: manifeste.id },
      data:  { statut: StatutManifeste.DEFINITIF, definitif_le: new Date() },
    });
    return manifeste.id;
  }

  private async publierApresVisa(
    liste: {
      id: string; vol_id: string; rmia: unknown;
      etape: { base_id: string }; vol: { date_heure: Date; combord_id: string | null };
    },
    etape: EtapeListe,
    suivante: EtapeListe | null,
    user: JwtPayload,
    resultat: { manifeste_id: string | null; hash: string; visa: { delegataire_id: string | null } },
    _dto: ViserDto,
  ): Promise<void> {
    const ts = new Date().toISOString();

    await this.events.publish(LISTE_EVENTS.LISTE_VISEE, {
      liste_id: liste.id, vol_id: liste.vol_id, rmia: liste.rmia as Rmia,
      etape, mention: MENTION_PAR_ETAPE[etape], etape_suivante: suivante,
      signataire_id: user.sub,
      delegataire_id: resultat.visa.delegataire_id,
      hash_contenu: resultat.hash, timestamp: ts,
    });

    if (etape === ETAPE_EMISSION_MANIFESTE && resultat.manifeste_id) {
      const destinataires = await this.prisma.ligneListe.findMany({
        where: { liste_id: liste.id, nature: NatureLigne.HIERARCHISEE },
        select: { id: true, telephone: true, nom: true, prenom: true },
      });
      await this.events.publish(LISTE_EVENTS.LISTE_ARRETEE, {
        liste_id: liste.id, vol_id: liste.vol_id,
        manifeste_id: resultat.manifeste_id,
        base_id: liste.etape.base_id, rmia: liste.rmia as Rmia,
        nb_passagers: destinataires.length,
        destinataires: destinataires.map((d) => ({
          ligne_id: d.id, telephone: d.telephone, nom: d.nom, prenom: d.prenom,
        })),
        date_heure_vol: new Date(liste.vol.date_heure).toISOString(),
        timestamp: ts,
      });
    }

    if (estEtapeListeFinale(etape) && resultat.manifeste_id) {
      await this.events.publish(LISTE_EVENTS.LISTE_CLOTUREE, {
        liste_id: liste.id, vol_id: liste.vol_id,
        manifeste_id: resultat.manifeste_id,
        base_id: liste.etape.base_id,
        combord_id: liste.vol.combord_id ?? user.sub,
        timestamp: ts,
      });
    }
  }
}