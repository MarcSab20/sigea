// apps/validation-service/src/state-machine/validation-state-machine.ts
//
// Cœur du circuit de validation SIGEA.
//
// Règles tenues ici, et nulle part ailleurs :
//   • une étape ne peut être franchie que si c'est SON tour (etape_courante) ;
//   • le tampon est composé et FIGÉ à l'instant de la signature ;
//   • un manifeste sensible ne peut atteindre le COMBASE sans accord CEMAA ;
//   • l'avancement est un compare-and-swap atomique : deux validateurs
//     simultanés ne peuvent pas franchir la même étape deux fois.
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
  JwtPayload,
  ROLE_TO_ETAPE,
  ETAPE_SEQUENCE,
  LIBELLE_ETAPE,
  composerTampon,
  etapeSuivante,
  rangEtape,
} from '@sigea/shared-types';
import { EVENTS } from '@sigea/shared-events';
import { EventPublisher } from '@sigea/shared-messaging';

/** Vue de l'avancement, destinée à l'IHM et à l'impression des 5 blocs. */
export interface AvancementCircuit {
  manifeste_id:   string;
  statut:         StatutManifeste;
  etape_courante: EtapeValidation | null;
  rang_courant:   number;
  total_etapes:   number;
  consignes_cemaa_appliquees: boolean;
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
    } | null;
  }[];
  /** Verrou CEMAA — présent uniquement si le manifeste est sensible. */
  verrou_cemaa: { requis: boolean; accorde: boolean; date_heure: Date | null } | null;
}

@Injectable()
export class ValidationStateMachine {
  private readonly logger = new Logger(ValidationStateMachine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Validation d'une étape
  // ─────────────────────────────────────────────────────────────────────────

  async valider(manifeste_id: string, user: JwtPayload, commentaire?: string): Promise<unknown> {
    const etape = ROLE_TO_ETAPE[user.role];
    if (!etape) {
      throw new ForbiddenException(`Le rôle ${user.role} n'intervient pas dans le circuit de validation`);
    }
    if (etape === EtapeValidation.CHEF_ESCALE) {
      // Le VU du chef d'escale est apposé par la soumission (manifeste-service),
      // pas ici : soumettre EST signer. Une seconde apposition dupliquerait le tampon.
      throw new BadRequestException(
        "Le visa du chef d'escale est apposé lors de la soumission du manifeste",
      );
    }

    const manifeste = await this.chargerManifeste(manifeste_id, user);

    if (manifeste.statut === StatutManifeste.VALIDE) {
      throw new BadRequestException('Manifeste déjà validé : circuit terminé');
    }
    if (manifeste.statut === StatutManifeste.REJETE) {
      throw new BadRequestException("Manifeste rejeté : il doit être corrigé et resoumis par le chef d'escale");
    }
    if (manifeste.statut === StatutManifeste.BROUILLON) {
      throw new BadRequestException("Manifeste non soumis : le chef d'escale doit d'abord le soumettre");
    }

    // ── C'est bien son tour ? ──
    if (manifeste.etape_courante !== etape) {
      const attendu = manifeste.etape_courante
        ? LIBELLE_ETAPE[manifeste.etape_courante]
        : 'aucune (circuit terminé)';
      throw new ConflictException(
        `Ce n'est pas votre tour : le manifeste attend la validation de ${attendu}`,
      );
    }

    // ── Verrou CEMAA : ceinture et bretelles ──
    // La séquence place déjà CEMAA_SENSIBLE avant COMBASE pour un manifeste
    // sensible, mais on revérifie : l'ancienne version cherchait une étape
    // CEMAA « EN_ATTENTE » et laissait donc passer le cas où l'étape
    // n'existait pas du tout.
    if (etape === EtapeValidation.COMBASE && manifeste.flag_sensible) {
      const accordCemaa = manifeste.validations.find(
        (v) => v.etape === EtapeValidation.CEMAA_SENSIBLE && v.statut === StatutValidation.APPROUVE,
      );
      if (!accordCemaa) {
        throw new ForbiddenException(
          'Manifeste sensible : accord CEMAA requis avant signature du commandant de base',
        );
      }
    }

    // ── Composition du tampon, figée maintenant ──
    // CEMAA_SENSIBLE n'est pas un des 5 blocs imprimés : c'est un verrou.
    // On enregistre l'étape sans tampon.
    const tampon =
      etape === EtapeValidation.CEMAA_SENSIBLE
        ? null
        : composerTampon({
            etape,
            base_numero:       manifeste.base.numero,
            base_code:         manifeste.base.code_base,
            signataire_nom:    manifeste.signataire.nom,
            signataire_prenom: manifeste.signataire.prenom,
            signataire_grade:  manifeste.signataire.grade,
            immatriculation:   manifeste.vol.immatriculation,
          });

    const suivante = this.prochaineEtape(etape, manifeste.flag_sensible);
    const termine = suivante === null;

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

      return tx.validationEtape.upsert({
        where:  { manifeste_id_etape: { manifeste_id, etape } },
        update: {
          statut:      StatutValidation.APPROUVE,
          validateur_id: user.sub,
          commentaire: commentaire ?? null,
          date_heure:  new Date(),
          ...(tampon ?? {}),
        },
        create: {
          manifeste_id,
          etape,
          statut:      StatutValidation.APPROUVE,
          validateur_id: user.sub,
          commentaire: commentaire ?? null,
          ...(tampon ?? {}),
        },
      });
    });

    this.logger.log(
      `Étape franchie : manifeste=${manifeste_id} etape=${etape} par=${user.sub} suivante=${suivante ?? 'FIN'}`,
    );

    const ts = new Date().toISOString();
    const ctx = { manifeste_id, base_id: manifeste.base_id, vol_id: manifeste.vol_id, timestamp: ts };

    await this.events.publish(EVENTS.MANIFESTE_STEP_VALIDATED, {
      ...ctx, etape, statut: StatutValidation.APPROUVE, etape_suivante: suivante,
    });

    if (termine) {
      await this.events.publish(EVENTS.MANIFESTE_COMPLETED, {
        ...ctx, flag_sensible: manifeste.flag_sensible, validateur_combase_id: user.sub,
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

    const etape = ROLE_TO_ETAPE[user.role];
    if (!etape) throw new ForbiddenException(`Le rôle ${user.role} n'intervient pas dans le circuit`);

    const manifeste = await this.chargerManifeste(manifeste_id, user);

    if (manifeste.statut !== StatutManifeste.SOUMIS && manifeste.statut !== StatutManifeste.EN_VALIDATION) {
      throw new BadRequestException(`Un manifeste ${manifeste.statut} ne peut pas être rejeté`);
    }
    if (manifeste.etape_courante !== etape) {
      throw new ConflictException("Ce n'est pas votre tour : vous ne pouvez pas rejeter cette étape");
    }

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

      // Purge des visas amont, tampons compris : ils ne doivent pas survivre
      // à une correction du contenu.
      await tx.validationEtape.deleteMany({
        where: { manifeste_id, etape: { not: etape } },
      });

      return tx.validationEtape.upsert({
        where:  { manifeste_id_etape: { manifeste_id, etape } },
        update: {
          statut: StatutValidation.REJETE, validateur_id: user.sub,
          commentaire: motif, date_heure: new Date(),
          mention: null, tampon_ligne1: null, tampon_ligne2: null,
          signataire_nom: null, signataire_grade: null,
        },
        create: {
          manifeste_id, etape, statut: StatutValidation.REJETE,
          validateur_id: user.sub, commentaire: motif,
        },
      });
    });

    this.logger.warn(`Manifeste rejeté : ${manifeste_id} à l'étape ${etape} par ${user.sub}`);

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

    const parEtape = new Map(manifeste.validations.map((v) => [v.etape, v]));

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
            }
          : null,
      };
    });

    const cemaa = parEtape.get(EtapeValidation.CEMAA_SENSIBLE);

    // Les enums Prisma (StatutManifeste, EtapeValidation) sont nominalement
    // distincts de ceux de @sigea/shared-types, même à valeurs identiques.
    // On franchit la frontière explicitement (les valeurs sont garanties égales).
    const etapeCourante = manifeste.etape_courante as unknown as EtapeValidation | null;

    return {
      manifeste_id,
      statut:         manifeste.statut as unknown as StatutManifeste,
      etape_courante: etapeCourante,
      rang_courant:   etapeCourante ? rangEtape(etapeCourante) : 0,
      total_etapes:   ETAPE_SEQUENCE.length,
      consignes_cemaa_appliquees: manifeste.consignes_cemaa_appliquees,
      blocs,
      verrou_cemaa: manifeste.flag_sensible
        ? {
            requis:     true,
            accorde:    cemaa?.statut === StatutValidation.APPROUVE,
            date_heure: cemaa?.date_heure ?? null,
          }
        : null,
    };
  }

  /**
   * Applique une consigne CEMAA à un manifeste :
   *   1. marque `consignes_cemaa_appliquees` (→ bandeau sur le PDF) ;
   *   2. si le manifeste est sensible ET attend l'étape CEMAA_SENSIBLE,
   *      franchit ce verrou et débloque l'accès au COMBASE.
   *
   * Idempotent : rejouer le même event (redelivery RabbitMQ) ne double ni le
   * compteur de consignes ni l'avancement du circuit.
   *
   * Appelée par le consumer d'évènements, jamais par une requête HTTP :
   * seule l'autorité CEMAA, via son propre service, peut déclencher ceci.
   */
  async appliquerConsigneCemaa(manifeste_id: string): Promise<void> {
    const manifeste = await this.prisma.manifeste.findUnique({
      where: { id: manifeste_id },
      select: {
        id: true, statut: true, etape_courante: true, flag_sensible: true,
        base_id: true, vol_id: true, consignes_cemaa_appliquees: true,
      },
    });
    if (!manifeste) {
      this.logger.warn(`Consigne CEMAA : manifeste ${manifeste_id} introuvable`);
      return;
    }

    const dejaApplique = manifeste.consignes_cemaa_appliquees;

    // ── 1. Marquage du flag + compteur (source du bandeau PDF) ──
    await this.prisma.manifeste.update({
      where: { id: manifeste_id },
      data: {
        consignes_cemaa_appliquees: true,
        consignes_cemaa_date: new Date(),
        consignes_cemaa_nb: { increment: 1 },
      },
    });

    // ── 2. Franchissement du verrou CEMAA_SENSIBLE, si c'est le tour ──
    // Uniquement pour un manifeste sensible effectivement EN ATTENTE de cette
    // étape. Un manifeste ordinaire n'a pas ce verrou ; un manifeste sensible
    // pas encore parvenu à CEMAA_SENSIBLE le franchira au moment voulu (le
    // flag est déjà posé, l'accord sera enregistré ici quand ce sera son tour).
    if (
      manifeste.flag_sensible &&
      manifeste.etape_courante === EtapeValidation.CEMAA_SENSIBLE
    ) {
      const cas = await this.prisma.$transaction(async (tx) => {
        const swap = await tx.manifeste.updateMany({
          where: { id: manifeste_id, etape_courante: EtapeValidation.CEMAA_SENSIBLE },
          data:  { etape_courante: EtapeValidation.COMBASE },
        });
        if (swap.count === 0) return false; // déjà franchie par un autre message

        await tx.validationEtape.upsert({
          where:  { manifeste_id_etape: { manifeste_id, etape: EtapeValidation.CEMAA_SENSIBLE } },
          update: { statut: StatutValidation.APPROUVE, date_heure: new Date() },
          create: {
            manifeste_id,
            etape:  EtapeValidation.CEMAA_SENSIBLE,
            statut: StatutValidation.APPROUVE,
          },
        });
        return true;
      });

      if (cas) {
        this.logger.log(`Verrou CEMAA franchi : manifeste=${manifeste_id} → COMBASE`);
        await this.events.publish(EVENTS.MANIFESTE_STEP_VALIDATED, {
          manifeste_id,
          base_id: manifeste.base_id,
          vol_id:  manifeste.vol_id,
          etape:   EtapeValidation.CEMAA_SENSIBLE,
          statut:  StatutValidation.APPROUVE,
          etape_suivante: EtapeValidation.COMBASE,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (!dejaApplique) {
      this.logger.log(`Consignes CEMAA appliquées : manifeste=${manifeste_id}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Interne
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sur un manifeste sensible, le verrou CEMAA s'intercale entre le COMBORD
   * et le COMBASE. Sur un manifeste ordinaire, il n'existe pas.
   */
  private prochaineEtape(etape: EtapeValidation, sensible: boolean): EtapeValidation | null {
    if (etape === EtapeValidation.CEMAA_SENSIBLE) return EtapeValidation.COMBASE;
    const suivante = etapeSuivante(etape);
    if (sensible && suivante === EtapeValidation.COMBASE) return EtapeValidation.CEMAA_SENSIBLE;
    return suivante;
  }

  /**
   * Le CEMAA est une autorité centrale : il n'appartient à aucune base et doit
   * pouvoir traiter les manifestes sensibles de toutes les escales. Filtrer sur
   * base_id l'exclurait de son propre verrou. Tout autre rôle reste cloisonné.
   */
  private async chargerManifeste(manifeste_id: string, user: JwtPayload) {
    const cloisonnement =
      user.role === RoleUtilisateur.CEMAA ? {} : { base_id: user.base_id };

    const manifeste = await this.prisma.manifeste.findFirst({
      where: { id: manifeste_id, ...cloisonnement },
      include: {
        validations: true,
        base: { select: { numero: true, code_base: true } },
        vol:  { select: { immatriculation: true } },
      },
    });
    if (!manifeste) {
      throw new NotFoundException(`Manifeste ${manifeste_id} introuvable ou hors de votre périmètre`);
    }

    const signataire = await this.prisma.utilisateur.findUnique({
      where:  { id: user.sub },
      select: { nom: true, prenom: true, grade: true },
    });
    if (!signataire) throw new NotFoundException('Signataire introuvable');

    return { ...manifeste, signataire };
  }
}