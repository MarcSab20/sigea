// apps/validation-service/src/state-machine/validation-state-machine.ts
//
// Cœur du circuit de validation SIGVEA.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI CHANGE PAR RAPPORT À LA VERSION DU DÉPÔT
// ═══════════════════════════════════════════════════════════════════════════
//
// 1. BLOC ORPHELIN SUPPRIMÉ (bloquant à la compilation)
//    `appliquerConsigneCemaa()` contenait un objet `empreinte` référençant
//    `tampon`, `delegation` et `titulaire` — trois identifiants inexistants
//    dans cette portée. Copier-coller manifestement destiné à `valider()`.
//    Le service ne compilait pas.
//
// 2. MÉTHODE ATTENDUE PAR LE CONSUMER (bloquant à l'exécution)
//    `autorite-consumer.service.ts` appelle `appliquerConsigneAutorite(id,
//    autorite)`. Seule `appliquerConsigneCemaa(id)` existait. Toute consigne
//    MAGE — et désormais CEMAA — partait à la poubelle.
//
// 3. INTÉRIM RÉELLEMENT APPLIQUÉ (besoin 6)
//    L'ancienne version résolvait l'étape par `ROLE_TO_ETAPE[user.role]`, en
//    ignorant `rolesEffectifs()`. Un suppléant ne pouvait donc rien signer, et
//    le tampon n'aurait de toute façon porté aucune mention « P/I » : les
//    colonnes par_interim / interim_id / titulaire_* n'étaient jamais écrites.
//    Le schéma, `composerTampon()` et `RolesGuard` étaient prêts ; seul ce
//    fichier ne branchait pas la chaîne.
//
// 4. ÉTAPE CEMAA_SENSIBLE RETIRÉE DE LA SÉQUENCE (vols sensibles)
//    `prochaineEtape()` intercalait encore CEMAA_SENSIBLE avant le COMBASE
//    pour les vols sensibles. Or CEMAA_SENSIBLE n'est pas dans ETAPE_SEQUENCE
//    et le CEMAA n'est pas dans ROLE_TO_ETAPE : le manifeste arrivait sur une
//    étape que PERSONNE ne pouvait franchir par la voie normale. Un vol
//    sensible se bloquait définitivement dès que le COMGMO signait, sauf à ce
//    qu'une consigne arrive par le bus au bon moment.
//    Règle retenue, conforme à la demande : le circuit est IDENTIQUE pour tous
//    les vols — Chef escale → COMESO → COMGMO → COMBASE → COMBORD. Ce qui
//    change pour un vol ayant reçu une consigne, c'est que l'autorité
//    émettrice doit ATTESTER de son exécution avant l'ACCORD du COMBASE. Ce
//    n'est pas un visa : aucun tampon n'est apposé à ce titre.
//
// 5. MAGE TRAITÉ COMME LE CEMAA DANS LE CLOISONNEMENT
//    `chargerManifeste()` n'exemptait du filtre par base que le CEMAA. Le MAGE
//    est une autorité centrale au même titre : le test passe désormais par
//    `estAutoriteCentrale()` sur les rôles effectifs.
//
// ═══════════════════════════════════════════════════════════════════════════
//
// L'ordre du circuit vient de @sigea/shared-types (ETAPE_SEQUENCE) : ne le
// redéfinissez jamais localement.

import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import {
  EtapeValidation,
  RoleUtilisateur,
  StatutManifeste,
  StatutValidation,
  StatutConsigne,
  AutoriteCentrale,
  JwtPayload,
  DelegationJwt,
  ROLE_TO_ETAPE,
  ETAPE_TO_ROLE,
  ETAPE_SEQUENCE,
  LIBELLE_ETAPE,
  MENTION_INTERIM,
  composerTampon,
  etapeSuivante,
  ETAPE_BLOQUEE_PAR_CONSIGNE,
  rangEtape,
  rolesEffectifs,
  delegationPourRole,
  estAutoriteCentrale,
} from '@sigea/shared-types';
import { EVENTS } from '@sigea/shared-events';
import { EventPublisher } from '@sigea/shared-messaging';
import { SnapshotService } from '@sigea/shared-integrity';

/** Vue de l'avancement, destinée à l'IHM et à l'impression des 5 blocs. */
export interface AvancementCircuit {
  manifeste_id:   string;
  statut:         StatutManifeste;
  etape_courante: EtapeValidation | null;
  rang_courant:   number;
  total_etapes:   number;
  consignes_cemaa_appliquees: boolean;
  consignes_mage_appliquees:  boolean;
  blocs: {
    etape:      EtapeValidation;
    libelle:    string;
    rang:       number;
    statut:     StatutValidation | 'NON_ATTEINTE';
    date_heure: Date | null;
    commentaire: string | null;
    /** Tampon figé ; null tant que l'étape n'est pas approuvée. */
    tampon: {
      mention:          string;
      tampon_ligne1:    string;
      tampon_ligne2:    string | null;
      signataire_nom:   string;
      signataire_grade: string;
      /** Mention « P/I » à imprimer sous la mention principale. */
      par_interim:      boolean;
      mention_interim:  string | null;
      titulaire_nom:    string | null;
      titulaire_grade:  string | null;
    } | null;
  }[];
  /**
   * Consignes d'autorité non confirmées à ce jour. Remplace l'ancien
   * `verrou_cemaa`, qui décrivait une étape de circuit désormais supprimée.
   * Tableau vide = rien ne bloque.
   */
  consignes_bloquantes: {
    id: string;
    autorite: AutoriteCentrale;
    type: string;
    statut: StatutConsigne;
    observation: string | null;
  }[];
  /**
   * @deprecated Conservé le temps que l'IHM bascule sur
   * `consignes_bloquantes`. `requis` reflète l'existence d'une consigne, plus
   * l'ancienne étape de circuit.
   */
  verrou_cemaa: { requis: boolean; accorde: boolean; date_heure: Date | null } | null;
}

/** Étape à franchir et, le cas échéant, délégation qui y autorise. */
interface HabilitationEtape {
  etape: EtapeValidation;
  delegation?: DelegationJwt;
}

@Injectable()
export class ValidationStateMachine {
  private readonly logger = new Logger(ValidationStateMachine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly snapshots: SnapshotService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Validation d'une étape
  // ─────────────────────────────────────────────────────────────────────────

  async valider(manifeste_id: string, user: JwtPayload, commentaire?: string): Promise<unknown> {
    const manifeste = await this.chargerManifeste(manifeste_id, user);

    if (manifeste.statut === StatutManifeste.VALIDE) {
      throw new BadRequestException('Manifeste déjà validé : circuit terminé');
    }
    if (manifeste.statut === StatutManifeste.REJETE) {
      throw new BadRequestException(
        "Manifeste rejeté : il doit être corrigé et resoumis par le chef d'escale",
      );
    }
    if (manifeste.statut === StatutManifeste.BROUILLON) {
      throw new BadRequestException(
        "Manifeste non soumis : le chef d'escale doit d'abord le soumettre",
      );
    }

    const { etape, delegation } = this.habiliter(manifeste, user);

    if (etape === EtapeValidation.CHEF_ESCALE) {
      // Le VU du chef d'escale est apposé par la soumission (manifeste-service),
      // pas ici : soumettre EST signer. Une seconde apposition dupliquerait le tampon.
      throw new BadRequestException(
        "Le visa du chef d'escale est apposé lors de la soumission du manifeste",
      );
    }

    // ── Consignes d'autorité non confirmées ──
    //
    // Le circuit est le MÊME pour tous les vols. Ce qui change, pour un vol
    // ayant reçu une consigne du CEMAA ou du MAGE, c'est que l'autorité
    // émettrice doit ATTESTER que sa consigne a été exécutée avant que le
    // commandant de base engage son accord.
    //
    // Le contrôle est data-driven : il ne teste PAS `flag_sensible`, mais
    // l'existence d'une consigne en attente. Un vol sensible sans consigne
    // n'est bloqué par rien ; un vol ordinaire ayant reçu une consigne l'est.
    if (etape === ETAPE_BLOQUEE_PAR_CONSIGNE) {
      await this.verifierConsignes(manifeste.vol_id, manifeste.base_id, manifeste_id, etape);
    }

    // ── Composition du tampon, figée maintenant ──
    //
    // La délégation est RELUE EN BASE, jamais crue sur parole du jeton. Deux
    // raisons, dont la seconde est une faille si on l'ignore :
    //   1. le jeton ne porte que { id, role } — le nom du titulaire empêché,
    //      qui doit figurer sur le tampon, n'y est pas ;
    //   2. un jeton reste valide jusqu'à son expiration (15 min). Sans cette
    //      relecture, un suppléant dont l'administrateur vient de révoquer la
    //      délégation continuerait de signer pendant un quart d'heure. Le
    //      besoin exprimé est explicite : « fermer les accès » doit fermer
    //      les accès, pas les fermer bientôt.
    const titulaire = delegation
      ? await this.chargerDelegationActive(delegation.id, user.sub)
      : null;

    const tampon = composerTampon({
      etape,
      base_numero:       manifeste.base.numero,
      base_code:         manifeste.base.code_base,
      signataire_nom:    manifeste.signataire.nom,
      signataire_prenom: manifeste.signataire.prenom,
      signataire_grade:  manifeste.signataire.grade,
      immatriculation:   manifeste.vol.immatriculation,
      par_interim:       Boolean(delegation),
      titulaire_nom:     titulaire?.nom   ?? undefined,
      titulaire_grade:   titulaire?.grade ?? undefined,
    });

    // Ce qui part en base : le tampon plus le rattachement à la délégation.
    // `interim_id` n'est pas dans EmpreinteTampon (c'est une clé technique,
    // pas un élément imprimé) ; il est ajouté ici et conservé même après
    // révocation, pour que la piste d'audit reste lisible des années plus tard.
    const empreinte = {
      mention:          tampon.mention,
      tampon_ligne1:    tampon.tampon_ligne1,
      tampon_ligne2:    tampon.tampon_ligne2    ?? null,
      signataire_nom:   tampon.signataire_nom,
      signataire_grade: tampon.signataire_grade,
      par_interim:      tampon.par_interim,
      interim_id:       delegation?.id ?? null,
      titulaire_nom:    tampon.titulaire_nom   ?? null,
      titulaire_grade:  tampon.titulaire_grade ?? null,
    };

    const suivante = etapeSuivante(etape);
    const termine  = suivante === null;

    // ── Écriture atomique ──
    // Le updateMany conditionné sur etape_courante est un compare-and-swap :
    // si un autre validateur a déjà franchi cette étape entre le chargement et
    // ici, count vaut 0 et rien n'est écrit. Pas de verrou explicite.
    const resultat = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.manifeste.updateMany({
        where: { id: manifeste_id, etape_courante: etape },
        data: {
          etape_courante: suivante,
          statut: termine ? StatutManifeste.VALIDE : StatutManifeste.EN_VALIDATION,
        },
      });
      if (cas.count === 0) {
        throw new ConflictException('Étape déjà franchie par un autre validateur');
      }

      const visa = await tx.validationEtape.upsert({
        where:  { manifeste_id_etape: { manifeste_id, etape } },
        update: {
          statut:        StatutValidation.APPROUVE,
          validateur_id: user.sub,
          commentaire:   commentaire ?? null,
          date_heure:    new Date(),
          ...empreinte,
        },
        create: {
          manifeste_id,
          etape,
          statut:        StatutValidation.APPROUVE,
          validateur_id: user.sub,
          commentaire:   commentaire ?? null,
          ...empreinte,
        },
      });

      // Historisation du contenu signé, DANS la transaction : soit l'étape est
      // franchie ET le contenu figé, soit ni l'un ni l'autre. Un visa sans
      // instantané serait une signature dont on ignore l'objet.
      await this.snapshots.figer(manifeste_id, etape, user.sub, tx);

      return visa;
    });

    this.logger.log(
      `Étape franchie : manifeste=${manifeste_id} etape=${etape} par=${user.sub}` +
        (delegation ? ` (P/I, délégation=${delegation.id})` : '') +
        ` suivante=${suivante ?? 'FIN'}`,
    );

    const ts  = new Date().toISOString();
    const ctx = { manifeste_id, base_id: manifeste.base_id, vol_id: manifeste.vol_id, timestamp: ts };

    await this.events.publish(EVENTS.MANIFESTE_STEP_VALIDATED, {
      ...ctx, etape, statut: StatutValidation.APPROUVE, etape_suivante: suivante,
      par_interim: tampon.par_interim,
    });

    if (termine) {
      // Le circuit est clos par le COMBORD, pas par le COMBASE : `user.sub`
      // n'est donc pas le signataire COMBASE. On relit le visa COMBASE déjà
      // apposé (garanti présent, il précède le COMBORD dans la séquence)
      // plutôt que de publier l'identité du mauvais validateur.
      const visaCombase = manifeste.validations.find(
        (v) => v.etape === EtapeValidation.COMBASE && v.statut === StatutValidation.APPROUVE,
      );

      await this.events.publish(EVENTS.MANIFESTE_COMPLETED, {
        ...ctx,
        flag_sensible: manifeste.flag_sensible,
        validateur_combase_id: visaCombase?.validateur_id ?? user.sub,
      });
    }

    return resultat;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rejet
  // ─────────────────────────────────────────────────────────────────────────

  async rejeter(manifeste_id: string, user: JwtPayload, motif: string): Promise<unknown> {
    if (!motif?.trim()) {
      throw new BadRequestException('Un motif est obligatoire pour rejeter un manifeste');
    }

    const manifeste = await this.chargerManifeste(manifeste_id, user);

    if (
      manifeste.statut !== StatutManifeste.SOUMIS &&
      manifeste.statut !== StatutManifeste.EN_VALIDATION
    ) {
      throw new BadRequestException(`Un manifeste ${manifeste.statut} ne peut pas être rejeté`);
    }

    const { etape, delegation } = this.habiliter(manifeste, user);

    // Les étapes situées APRÈS celle-ci n'ont pas encore pu être franchies
    // (séquencement strict), il n'y a donc rien à invalider en aval. On purge
    // en revanche les visas AMONT : le document repart au chef d'escale, et
    // un visa apposé sur une version corrigée n'aurait plus de sens.
    const resultat = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.manifeste.updateMany({
        where: { id: manifeste_id, etape_courante: etape },
        data:  { statut: StatutManifeste.REJETE, etape_courante: null },
      });
      if (cas.count === 0) {
        throw new ConflictException('Étape déjà traitée par un autre validateur');
      }

      // L'état rejeté est figé AVANT la purge : c'est le seul moment où le
      // contenu exact soumis aux signataires amont est encore intact.
      await this.snapshots.figer(manifeste_id, `${etape}_REJET`, user.sub, tx, { versionner: true });

      // Purge des visas amont, tampons compris : ils ne doivent pas survivre
      // à une correction du contenu. Les INSTANTANÉS, eux, sont conservés —
      // ils constituent l'historique probant du dossier.
      await tx.validationEtape.deleteMany({
        where: { manifeste_id, etape: { not: etape } },
      });

      return tx.validationEtape.upsert({
        where:  { manifeste_id_etape: { manifeste_id, etape } },
        update: {
          statut: StatutValidation.REJETE, validateur_id: user.sub,
          commentaire: motif, date_heure: new Date(),
          // Un rejet n'appose aucun tampon : on efface toute empreinte
          // résiduelle d'un passage antérieur sur cette étape.
          mention: null, tampon_ligne1: null, tampon_ligne2: null,
          signataire_nom: null, signataire_grade: null,
          // La délégation, elle, est CONSERVÉE : savoir qu'un rejet a été
          // prononcé par intérim a la même valeur probante qu'une signature.
          par_interim: Boolean(delegation), interim_id: delegation?.id ?? null,
        },
        create: {
          manifeste_id, etape, statut: StatutValidation.REJETE,
          validateur_id: user.sub, commentaire: motif,
          par_interim: Boolean(delegation), interim_id: delegation?.id ?? null,
        },
      });
    });

    this.logger.warn(
      `Manifeste rejeté : ${manifeste_id} à l'étape ${etape} par ${user.sub}` +
        (delegation ? ' (P/I)' : ''),
    );

    await this.events.publish(EVENTS.MANIFESTE_STEP_REJECTED, {
      manifeste_id, base_id: manifeste.base_id, vol_id: manifeste.vol_id,
      etape, statut: StatutValidation.REJETE, motif,
      timestamp: new Date().toISOString(),
    });

    return resultat;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Avancement — alimente l'IHM ET l'impression des 5 blocs
  // ─────────────────────────────────────────────────────────────────────────

  async avancement(manifeste_id: string, user: JwtPayload): Promise<AvancementCircuit> {
    const manifeste = await this.chargerManifeste(manifeste_id, user);
    const parEtape  = new Map(manifeste.validations.map((v) => [v.etape, v]));

    const blocs = ETAPE_SEQUENCE.map((etape) => {
      const v = parEtape.get(etape);
      const approuve = v?.statut === StatutValidation.APPROUVE;
      return {
        etape,
        libelle:     LIBELLE_ETAPE[etape],
        rang:        rangEtape(etape),
        statut:      (v?.statut ?? 'NON_ATTEINTE') as StatutValidation | 'NON_ATTEINTE',
        date_heure:  v?.date_heure ?? null,
        commentaire: v?.commentaire ?? null,
        // Le tampon n'est exposé que si l'étape est réellement approuvée :
        // aucun « VU » ne doit pouvoir s'imprimer sans signature effective.
        tampon: approuve && v?.mention
          ? {
              mention:          v.mention,
              tampon_ligne1:    v.tampon_ligne1 ?? '',
              tampon_ligne2:    v.tampon_ligne2 ?? null,
              signataire_nom:   v.signataire_nom ?? '',
              signataire_grade: v.signataire_grade ?? '',
              par_interim:      v.par_interim ?? false,
              mention_interim:  v.par_interim ? MENTION_INTERIM : null,
              titulaire_nom:    v.titulaire_nom   ?? null,
              titulaire_grade:  v.titulaire_grade ?? null,
            }
          : null,
      };
    });

    const bloquantes = await this.consignesNonConfirmees(manifeste.vol_id, manifeste.base_id);

    // Les enums Prisma sont nominalement distincts de ceux de shared-types,
    // même à valeurs identiques. On franchit la frontière explicitement.
    const etapeCourante = manifeste.etape_courante as unknown as EtapeValidation | null;

    return {
      manifeste_id,
      statut:         manifeste.statut as unknown as StatutManifeste,
      etape_courante: etapeCourante,
      rang_courant:   etapeCourante ? rangEtape(etapeCourante) : 0,
      total_etapes:   ETAPE_SEQUENCE.length,
      consignes_cemaa_appliquees: manifeste.consignes_cemaa_appliquees,
      consignes_mage_appliquees:  manifeste.consignes_mage_appliquees,
      blocs,
      consignes_bloquantes: bloquantes.map((c) => ({
        id:          c.id,
        autorite:    c.autorite as unknown as AutoriteCentrale,
        type:        String(c.type),
        statut:      c.statut_realisation as unknown as StatutConsigne,
        observation: c.observation_realisation ?? null,
      })),
      verrou_cemaa: bloquantes.length
        ? { requis: true, accorde: false, date_heure: null }
        : null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Consignes d'autorité centrale
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Marque l'application d'une consigne CEMAA **ou** MAGE sur un manifeste.
   *
   * Appelée par le consumer d'évènements, jamais par une requête HTTP : seule
   * l'autorité émettrice, via son propre service, peut déclencher ceci.
   *
   * Ne franchit AUCUNE étape : depuis la correction du circuit, une consigne
   * n'est pas un visa. Elle pose un drapeau (bandeau imprimé sur le PDF) et
   * incrémente un compteur, tous deux cloisonnés par autorité. Le déblocage du
   * COMBASE, lui, dépend de `statut_realisation` sur la consigne elle-même —
   * confirmé par l'autorité depuis son espace, pas ici.
   *
   * Idempotent au sens qui compte : rejouer le message (redelivery RabbitMQ)
   * ne débloque ni ne bloque rien de plus. Le compteur, lui, s'incrémente —
   * c'est un indicateur, pas une donnée probante.
   */
  async appliquerConsigneAutorite(
    manifeste_id: string,
    autorite: AutoriteCentrale,
  ): Promise<void> {
    const manifeste = await this.prisma.manifeste.findUnique({
      where: { id: manifeste_id },
      select: { id: true, base_id: true, vol_id: true },
    });
    if (!manifeste) {
      this.logger.warn(`Consigne ${autorite} : manifeste ${manifeste_id} introuvable`);
      return;
    }

    const champs =
      autorite === AutoriteCentrale.MAGE
        ? {
            consignes_mage_appliquees: true,
            consignes_mage_date: new Date(),
            consignes_mage_nb: { increment: 1 },
          }
        : {
            consignes_cemaa_appliquees: true,
            consignes_cemaa_date: new Date(),
            consignes_cemaa_nb: { increment: 1 },
          };

    await this.prisma.manifeste.update({ where: { id: manifeste_id }, data: champs });

    this.logger.log(`Consigne ${autorite} appliquée : manifeste=${manifeste_id}`);
  }

  /**
   * @deprecated Utiliser `appliquerConsigneAutorite(id, AutoriteCentrale.CEMAA)`.
   * Conservé pour les appelants antérieurs au lot 4.
   */
  async appliquerConsigneCemaa(manifeste_id: string): Promise<void> {
    return this.appliquerConsigneAutorite(manifeste_id, AutoriteCentrale.CEMAA);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Interne
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Détermine l'étape que cet utilisateur est habilité à franchir MAINTENANT,
   * et la délégation qui l'y autorise le cas échéant.
   *
   * ── Pourquoi partir de l'étape courante et non du rôle ──
   * Un suppléant porte plusieurs rôles effectifs : le sien plus ceux qu'il
   * couvre. Résoudre `ROLE_TO_ETAPE[user.role]` d'abord — ce que faisait
   * l'ancienne version — élit arbitrairement le rôle propre et rend
   * l'intérim inopérant. On regarde donc ce que le manifeste ATTEND, puis on
   * vérifie que l'utilisateur peut y répondre. Un COMESO couvrant le COMGMO
   * franchit ainsi les deux étapes, l'une après l'autre, sans ambiguïté.
   */
  private habiliter(
    manifeste: { etape_courante: unknown },
    user: JwtPayload,
  ): HabilitationEtape {
    const attendue = manifeste.etape_courante as EtapeValidation | null;

    if (!attendue) {
      throw new ConflictException(
        'Ce manifeste n\'attend aucune signature (circuit terminé ou manifeste rejeté)',
      );
    }

    const roleAttendu = ETAPE_TO_ROLE[attendue];
    if (!roleAttendu) {
      // Étape historique (CEMAA_SENSIBLE / MAGE_SENSIBLE) laissée par une
      // version antérieure. On ne bricole pas : on le dit clairement, et
      // l'administrateur repositionne le manifeste (script de reprise).
      throw new ConflictException(
        `Le manifeste est positionné sur l'étape ${attendue}, qui n'est plus produite. ` +
          "Signalez-le à l'administrateur : une reprise de données est nécessaire.",
      );
    }

    if (user.role === roleAttendu) {
      return { etape: attendue };
    }

    const delegation = delegationPourRole(user, roleAttendu);
    if (delegation) {
      return { etape: attendue, delegation };
    }

    // Message utile : dire ce qui est attendu, et ce que l'utilisateur détient.
    const detenus = rolesEffectifs(user).join(', ');
    const propre  = ROLE_TO_ETAPE[user.role];
    if (!propre) {
      throw new ForbiddenException(
        `Le rôle ${user.role} n'intervient pas dans le circuit de validation`,
      );
    }
    throw new ConflictException(
      `Ce n'est pas votre tour : le manifeste attend la validation de ` +
        `${LIBELLE_ETAPE[attendue]}. Rôles détenus : ${detenus}.`,
    );
  }

  /**
   * Relit la délégation invoquée et vérifie qu'elle est TOUJOURS en vigueur.
   *
   * Contrôles : délégation existante, non révoquée, fenêtre temporelle
   * ouverte, et suppléant bien celui qui présente le jeton. Le dernier point
   * paraît superflu — le jeton vient d'être signé par le service d'auth —
   * mais il coûte une comparaison de chaînes et ferme la porte à un jeton
   * rejoué ou forgé à partir d'une clé compromise.
   */
  private async chargerDelegationActive(
    interim_id: string,
    suppleant_id: string,
  ): Promise<{ nom: string; grade: string }> {
    const maintenant = new Date();
    const row = await this.prisma.interim.findFirst({
      where: {
        id: interim_id,
        suppleant_id,
        actif: true,
        date_debut: { lte: maintenant },
        OR: [{ date_fin: null }, { date_fin: { gt: maintenant } }],
      },
      select: { titulaire: { select: { nom: true, grade: true } } },
    });

    if (!row) {
      throw new ForbiddenException(
        'Votre délégation a été révoquée ou est arrivée à échéance. ' +
          'Reconnectez-vous : si elle a été renouvelée, vos droits seront rétablis.',
      );
    }
    return row.titulaire;
  }

  /** Consignes qui bloquent encore le circuit pour ce vol / cette escale. */
  private consignesNonConfirmees(vol_id: string, base_id: string) {
    return this.prisma.consigneCemaa.findMany({
      where: {
        vol_id,
        // Consigne ciblant une escale précise, ou le vol entier.
        OR: [{ escale_base_id: null }, { escale_base_id: base_id }],
        statut_realisation: { in: [StatutConsigne.EMISE, StatutConsigne.NON_REALISEE] },
      },
      select: {
        id: true, autorite: true, type: true,
        statut_realisation: true, observation_realisation: true,
      },
    });
  }

  private async verifierConsignes(
    vol_id: string,
    base_id: string,
    manifeste_id: string,
    etape: EtapeValidation,
  ): Promise<void> {
    const enAttente = await this.consignesNonConfirmees(vol_id, base_id);
    if (!enAttente.length) return;

    // Le message distingue « pas encore examinée » de « examinée et refusée » :
    // dans le premier cas il faut relancer l'autorité, dans le second il faut
    // corriger le manifeste. Confondre les deux fait perdre du temps à tout
    // le monde, et pousse à contourner l'outil.
    const nonExaminees = enAttente.filter(
      (c) => (c.statut_realisation as unknown as StatutConsigne) === StatutConsigne.EMISE,
    );
    const refusees = enAttente.filter(
      (c) => (c.statut_realisation as unknown as StatutConsigne) === StatutConsigne.NON_REALISEE,
    );

    const details: string[] = [];
    if (nonExaminees.length) {
      const autorites = [...new Set(nonExaminees.map((c) => c.autorite))].join(' et ');
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

    this.logger.warn(
      `Signature ${etape} bloquée : manifeste=${manifeste_id} ` +
        `${enAttente.length} consigne(s) non confirmée(s)`,
    );
    throw new ForbiddenException(`Signature impossible : ${details.join(' ; ')}.`);
  }

  /**
   * Les autorités centrales — CEMAA et MAGE — n'appartiennent à aucune base et
   * doivent pouvoir consulter les manifestes de toutes les escales. Filtrer
   * sur base_id les exclurait de leur propre périmètre. Tout autre rôle reste
   * cloisonné.
   *
   * Le test porte sur les rôles EFFECTIFS : un officier assurant l'intérim
   * d'une autorité centrale bénéficie du même périmètre — sans quoi la
   * délégation serait purement décorative.
   */
  private async chargerManifeste(manifeste_id: string, user: JwtPayload) {
    const centrale = rolesEffectifs(user).some(estAutoriteCentrale);
    const cloisonnement = centrale ? {} : { base_id: user.base_id };

    const manifeste = await this.prisma.manifeste.findFirst({
      where: { id: manifeste_id, ...cloisonnement },
      include: {
        validations: true,
        base: { select: { numero: true, code_base: true } },
        vol:  { select: { immatriculation: true } },
      },
    });
    if (!manifeste) {
      throw new NotFoundException(
        `Manifeste ${manifeste_id} introuvable ou hors de votre périmètre`,
      );
    }

    const signataire = await this.prisma.utilisateur.findUnique({
      where:  { id: user.sub },
      select: { nom: true, prenom: true, grade: true },
    });
    if (!signataire) throw new NotFoundException('Signataire introuvable');

    return { ...manifeste, signataire };
  }
}