// apps/liste-service/src/listes/listes.service.ts
//
// Constitution et discrimination des listes d'embarquement.
//
// ═══════════════════════════════════════════════════════════════════════════
// LES DEUX RÈGLES QUI STRUCTURENT TOUT CE FICHIER
// ═══════════════════════════════════════════════════════════════════════════
//
// 1. UN SEUL RÔLE INSÈRE : le SEC_ADJ_AIR.
//    Toutes les autres autorités DISCRIMINENT — elles retirent, réordonnent,
//    requalifient, mais n'ajoutent jamais un nom. Seule exception, étroite et
//    assumée : l'imposition d'urgence par le CEMAA ou le MAGE, qui crée une
//    ligne verrouillée, hors discrimination.
//
// 2. DEUX PLAFONDS, ET C'EST LE PLUS BAS QUI S'APPLIQUE.
//    Le quota alloué par le SCOPS à un point d'embarquement est une décision
//    de commandement. La place physique restante sur le tronçon qui part de ce
//    point, transit compris, est une contrainte d'aéronef. Un quota de 20
//    places à Douala ne vaut rien si 18 passagers de Yaoundé restent à bord
//    pour Garoua. `disponibilite()` évalue les deux.

import {
  Injectable, BadRequestException, ForbiddenException, NotFoundException,
  ConflictException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@sigea/shared-database';
import {
  JwtPayload, RoleUtilisateur, Rmia, Priorite, NatureLigne, EtapeListe,
  StatutListe, StatutPotentialite, OrigineEnregistrement, AutoriteCentrale,
  Perimetre, perimetreEffectif, rolesEffectifs, rmiasCouvertes,
  occupationTroncons, disponibiliteAuPoint, repartirParPriorite,
  peutDiscriminer, voitListeAttente, estImposee,
  OccupationTroncon, DisponibiliteEmbarquement,
  ROLES_DELEGATAIRES_COMBASE,
} from '@sigea/shared-types';
import {
  SelectionnerDto, CreateLigneDto, DiscriminerDto, ReordonnerDto,
  CreateFretDto, ImposerDto,
} from './dto/ligne.dto';

type ModeAcces = 'LECTURE' | 'ECRITURE';

@Injectable()
export class ListesService {
  private readonly logger = new Logger(ListesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════
  // Accès
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Charge une liste et vérifie que l'utilisateur a le droit de la voir.
   *
   * Un seul point d'entrée pour toutes les opérations : c'est la seule façon
   * de garantir qu'aucune route n'oublie le cloisonnement. Les contrôles
   * d'ÉTAPE (« est-ce votre tour ») restent ailleurs — ils relèvent du circuit,
   * pas du périmètre.
   */
  private async chargerListe(liste_id: string, user: JwtPayload, mode: ModeAcces) {
    const liste = await this.prisma.listeEmbarquement.findUnique({
      where: { id: liste_id },
      include: {
        etape: { select: { id: true, ordre: true, base_id: true, rmia: true } },
        vol: {
          select: {
            id: true, numero_mission: true, date_heure: true, combord_id: true,
            capacite_places: true, capacite_cargo_kg: true, statut: true,
            itineraire: { select: { ordre: true }, orderBy: { ordre: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!liste) throw new NotFoundException('Liste introuvable');

    const roles  = rolesEffectifs(user);
    const portee = perimetreEffectif(user);

    const estNational  = portee === Perimetre.NATIONAL;
    const estDeLaRmia  = rmiasCouvertes(user).includes(liste.rmia as Rmia);
    const estDeLaBase  = liste.etape.base_id === user.base_id &&
      roles.some((r) =>
        r === RoleUtilisateur.COMBASE || ROLES_DELEGATAIRES_COMBASE.includes(r));
    const estLeCombord = roles.includes(RoleUtilisateur.COMBORD) &&
      liste.vol.combord_id === user.sub;

    if (!estNational && !estDeLaRmia && !estDeLaBase && !estLeCombord) {
      // 404 et non 403 : un 403 confirmerait l'existence d'une liste que
      // l'appelant n'a pas le droit de connaître.
      throw new NotFoundException('Liste introuvable');
    }

    if (mode === 'ECRITURE' && estNational && !roles.some((r) =>
      r === RoleUtilisateur.CEMAA || r === RoleUtilisateur.MAGE || r === RoleUtilisateur.ADMIN)) {
      throw new ForbiddenException(
        "Le SCOPS alloue les quotas ; il n'intervient pas dans la composition des listes.",
      );
    }

    return liste;
  }

  /** Le SEC_ADJ_AIR, et lui seul, insère. */
  private exigerSaisisseur(user: JwtPayload): void {
    if (!rolesEffectifs(user).includes(RoleUtilisateur.SEC_ADJ_AIR)) {
      throw new ForbiddenException(
        "Seul le secrétaire de l'Adjoint Air porte des noms sur une liste.",
      );
    }
  }

  /** La liste doit être ouverte à la saisie. */
  private exigerSaisissable(liste: { statut: StatutListe; etape_courante: EtapeListe | null }): void {
    const ouverte =
      (liste.statut === StatutListe.OUVERTE || liste.statut === StatutListe.REJETEE) &&
      liste.etape_courante === EtapeListe.SEC_ADJ_AIR;
    if (!ouverte) {
      throw new ConflictException(
        'La liste est engagée dans le circuit de validation : plus aucune inscription ' +
          "n'est possible. Demandez son renvoi à l'autorité qui la détient.",
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Occupation et disponibilité
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Occupation de chaque tronçon du vol, TOUTES listes confondues.
   *
   * Toutes listes confondues, parce que c'est le seul calcul juste : les
   * passagers de Yaoundé occupent des sièges sur le tronçon Douala–Garoua sans
   * figurer sur la liste de Douala. Restreindre le calcul à une liste
   * reproduirait exactement le défaut que la directive demande de corriger.
   */
  private async occupationVol(vol_id: string): Promise<OccupationTroncon[]> {
    const vol = await this.prisma.vol.findUnique({
      where: { id: vol_id },
      select: {
        capacite_places: true, capacite_cargo_kg: true,
        itineraire: { select: { ordre: true }, orderBy: { ordre: 'desc' }, take: 1 },
        listes: {
          select: {
            lignes: {
              select: {
                nature: true, embarquement_ordre: true,
                debarquement_ordre: true, masse_bagages_kg: true,
              },
            },
            frets: {
              select: {
                retire: true, embarquement_ordre: true,
                debarquement_ordre: true, poids_kg: true,
              },
            },
          },
        },
      },
    });
    if (!vol) throw new NotFoundException('Vol introuvable');

    const nbPoints = vol.itineraire[0]?.ordre ?? 0;

    const lignes = vol.listes.flatMap((l) =>
      l.lignes.map((x) => ({
        nature:             x.nature as unknown as NatureLigne,
        embarquement_ordre: x.embarquement_ordre,
        debarquement_ordre: x.debarquement_ordre,
        masse_bagages_kg:   Number(x.masse_bagages_kg),
      })),
    );
    const frets = vol.listes.flatMap((l) =>
      l.frets.map((f) => ({
        retire:             f.retire,
        embarquement_ordre: f.embarquement_ordre,
        debarquement_ordre: f.debarquement_ordre,
        poids_kg:           Number(f.poids_kg),
      })),
    );

    return occupationTroncons(lignes, frets, nbPoints, {
      places:   vol.capacite_places,
      masse_kg: Number(vol.capacite_cargo_kg),
    });
  }

  /** Ce qu'il reste à embarquer sur cette liste, les deux plafonds confondus. */
  private async disponibilite(
    liste: { id: string; vol_id: string; quota_places: number; quota_masse_kg: Prisma.Decimal | number },
    ordre: number,
  ): Promise<DisponibiliteEmbarquement> {
    const [agr, masse, troncons] = await Promise.all([
      this.prisma.ligneListe.count({
        where: { liste_id: liste.id, nature: NatureLigne.HIERARCHISEE },
      }),
      this.prisma.ligneListe.aggregate({
        where: { liste_id: liste.id, nature: NatureLigne.HIERARCHISEE },
        _sum: { masse_bagages_kg: true },
      }),
      this.occupationVol(liste.vol_id),
    ]);

    const fret = await this.prisma.fretListe.aggregate({
      where: { liste_id: liste.id, retire: false },
      _sum: { poids_kg: true },
    });

    return disponibiliteAuPoint(
      { places: liste.quota_places, masse_kg: Number(liste.quota_masse_kg) },
      {
        places:   agr,
        masse_kg: Number(masse._sum.masse_bagages_kg ?? 0) + Number(fret._sum.poids_kg ?? 0),
      },
      troncons.find((t) => t.ordre === ordre),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Consultation
  // ═══════════════════════════════════════════════════════════════════════

  /** Listes à traiter par l'utilisateur, selon son rôle et son périmètre. */
  async mesListes(user: JwtPayload): Promise<unknown[]> {
    const roles  = rolesEffectifs(user);
    const rmias  = rmiasCouvertes(user);
    const portee = perimetreEffectif(user);

    const clauses: Prisma.ListeEmbarquementWhereInput[] = [];

    if (rmias.length) {
      clauses.push({ rmia: { in: rmias } });
    }
    if (roles.some((r) => r === RoleUtilisateur.COMBASE || ROLES_DELEGATAIRES_COMBASE.includes(r))) {
      clauses.push({ etape: { base_id: user.base_id } });
    }
    if (roles.includes(RoleUtilisateur.COMBORD)) {
      clauses.push({ vol: { combord_id: user.sub } });
    }
    if (portee === Perimetre.NATIONAL) {
      clauses.push({});
    }
    if (!clauses.length) return [];

    const listes = await this.prisma.listeEmbarquement.findMany({
      where: { OR: clauses, statut: { not: StatutListe.CLOTUREE } },
      include: {
        etape: { select: { ordre: true, base: { select: { code_base: true, nom: true } } } },
        vol:   { select: { numero_mission: true, date_heure: true, immatriculation: true } },
        _count: { select: { lignes: true } },
      },
      orderBy: [{ vol: { date_heure: 'asc' } }, { etape: { ordre: 'asc' } }],
    });

    // `a_traiter` dit à l'IHM s'il s'agit d'un dossier en attente de CET
    // utilisateur, ou d'un dossier simplement visible. Sans ce drapeau, chaque
    // écran refait le calcul, et finit par le refaire différemment.
    return listes.map((l) => ({
      ...l,
      a_traiter: this.estSonTour(l.etape_courante as EtapeListe | null, user),
    }));
  }

  private estSonTour(etape: EtapeListe | null, user: JwtPayload): boolean {
    if (!etape) return false;
    const roles = rolesEffectifs(user);
    switch (etape) {
      case EtapeListe.SEC_ADJ_AIR: return roles.includes(RoleUtilisateur.SEC_ADJ_AIR);
      case EtapeListe.ADJ_AIR:     return roles.includes(RoleUtilisateur.ADJ_AIR);
      case EtapeListe.COMRMIA:     return roles.includes(RoleUtilisateur.COMRMIA);
      case EtapeListe.COMBASE:
        return roles.some((r) =>
          r === RoleUtilisateur.COMBASE || ROLES_DELEGATAIRES_COMBASE.includes(r));
      case EtapeListe.COMBORD:     return roles.includes(RoleUtilisateur.COMBORD);
      default: return false;
    }
  }

  /**
   * Vue complète d'une liste : six tableaux de priorité, liste d'attente,
   * fret, et disponibilité résiduelle.
   *
   * La liste d'attente n'est PAS renvoyée au commandant de bord : la directive
   * est explicite, le manifeste ne porte que les noms retenus. Le filtrage se
   * fait ici, côté serveur — masquer la liste dans l'IHM laisserait les données
   * transiter sur le réseau et apparaître dans les outils de développement.
   */
  async consulter(liste_id: string, user: JwtPayload): Promise<unknown> {
    const liste = await this.chargerListe(liste_id, user, 'LECTURE');

    const [lignes, frets, visas, dispo] = await Promise.all([
      this.prisma.ligneListe.findMany({
        where: { liste_id },
        orderBy: [{ priorite: 'asc' }, { rang: 'asc' }],
      }),
      this.prisma.fretListe.findMany({ where: { liste_id }, orderBy: { designation: 'asc' } }),
      this.prisma.visaListe.findMany({ where: { liste_id }, orderBy: { date_heure: 'asc' } }),
      this.disponibilite(liste, liste.etape.ordre),
    ]);

    const etape = liste.etape_courante as EtapeListe | null;
    const montrerAttente = !etape || voitListeAttente(etape) ||
      !rolesEffectifs(user).includes(RoleUtilisateur.COMBORD);

    const hierarchisees = lignes.filter((l) => l.nature === NatureLigne.HIERARCHISEE);
    const attente       = lignes.filter((l) => l.nature === NatureLigne.ATTENTE);
    const retirees      = lignes.filter((l) => l.nature === NatureLigne.RETIREE);

    return {
      liste: {
        id: liste.id, statut: liste.statut, etape_courante: etape,
        rmia: liste.rmia, version: liste.version, motif_rejet: liste.motif_rejet,
        quota_places: liste.quota_places, quota_masse_kg: Number(liste.quota_masse_kg),
        point: { ordre: liste.etape.ordre, base_id: liste.etape.base_id },
        vol: liste.vol,
      },
      disponibilite: dispo,
      tableaux: repartirParPriorite(
        hierarchisees.map((l) => ({ ...l, priorite: l.priorite as unknown as Priorite })),
      ),
      liste_attente: montrerAttente
        ? attente.sort((a, b) => a.rang - b.rang)
        : undefined,
      lignes_retirees: montrerAttente ? retirees : undefined,
      frets: frets.filter((f) => !f.retire),
      visas,
    };
  }

  /** Occupation de chaque tronçon : écran de contrôle du sur-réservation. */
  async troncons(vol_id: string, user: JwtPayload): Promise<OccupationTroncon[]> {
    // Le contrôle d'accès passe par une liste du vol : si l'utilisateur n'en
    // voit aucune, il n'a pas à connaître le remplissage de l'appareil.
    const une = await this.prisma.listeEmbarquement.findFirst({
      where: { vol_id }, select: { id: true },
    });
    if (!une) throw new NotFoundException('Vol introuvable ou non diffusé');
    await this.chargerListe(une.id, user, 'LECTURE');
    return this.occupationVol(vol_id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Constitution — SEC_ADJ_AIR uniquement
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Porte des personnes du vivier sur la liste.
   *
   * Le débordement en liste d'attente est le comportement par défaut : un
   * secrétaire qui sélectionne quarante noms pour vingt places veut vingt
   * retenus et vingt en attente, pas un message d'erreur et quarante noms à
   * ressaisir. Le refus sec reste possible (`deborder_en_attente: false`) pour
   * les cas où la sélection doit être exacte.
   */
  async selectionner(liste_id: string, dto: SelectionnerDto, user: JwtPayload): Promise<unknown> {
    this.exigerSaisisseur(user);
    const liste = await this.chargerListe(liste_id, user, 'ECRITURE');
    this.exigerSaisissable(liste);

    const ordreMax = liste.vol.itineraire[0]?.ordre ?? 0;
    for (const s of dto.selections) {
      this.verifierTrajet(liste.etape.ordre, s.debarquement_ordre, ordreMax);
    }

    const ids = dto.selections.map((s) => s.potentialite_id);
    const viviers = await this.prisma.potentialite.findMany({
      where: { id: { in: ids }, rmia: liste.rmia },
    });
    if (viviers.length !== ids.length) {
      throw new BadRequestException(
        'Une ou plusieurs personnes sélectionnées sont inconnues ou hors de votre région militaire.',
      );
    }

    // Une même personne ne peut pas figurer deux fois sur la même liste. Le
    // contrôle se fait sur la potentialité : deux saisies manuelles homonymes
    // restent possibles, et c'est voulu — deux militaires peuvent porter le
    // même nom.
    const deja = await this.prisma.ligneListe.findMany({
      where: { liste_id, potentialite_id: { in: ids } },
      select: { potentialite_id: true, nom: true, prenom: true },
    });
    if (deja.length) {
      throw new ConflictException(
        `Déjà porté(s) sur cette liste : ${deja.map((d) => `${d.nom} ${d.prenom}`).join(', ')}`,
      );
    }

    const dispo = await this.disponibilite(liste, liste.etape.ordre);
    const deborder = dto.deborder_en_attente !== false;

    let placesRestantes = dispo.places;
    let masseRestante   = dispo.masse_kg;

    const parId = new Map(viviers.map((v) => [v.id, v]));
    const aCreer: Prisma.LigneListeCreateManyInput[] = [];
    const enAttente: string[] = [];

    for (const s of dto.selections) {
      const v = parId.get(s.potentialite_id)!;
      const masse = Number(v.masse_bagages_kg);

      let nature = s.nature ?? NatureLigne.HIERARCHISEE;
      if (nature === NatureLigne.HIERARCHISEE) {
        if (placesRestantes <= 0 || masseRestante < masse) {
          if (!deborder) {
            throw new BadRequestException(
              `Quota atteint : ${dispo.places} place(s) et ${dispo.masse_kg} kg disponibles ` +
                `(facteur limitant : ${dispo.facteur_limitant === 'QUOTA' ? 'quota SCOPS' : 'capacité de l\'aéronef sur ce tronçon'}).`,
            );
          }
          nature = NatureLigne.ATTENTE;
          enAttente.push(`${v.nom} ${v.prenom}`);
        } else {
          placesRestantes -= 1;
          masseRestante   -= masse;
        }
      }

      aCreer.push({
        liste_id,
        potentialite_id:    v.id,
        nature,
        priorite:           s.priorite ?? v.priorite_proposee,
        rang:               0, // réécrit ci-dessous
        nom: v.nom, prenom: v.prenom, grade: v.grade,
        matricule: v.matricule, cni: v.cni, unite: v.unite,
        telephone: v.telephone, categorie: v.categorie,
        embarquement_ordre: liste.etape.ordre,
        debarquement_ordre: s.debarquement_ordre,
        destination:        v.destination_souhaitee ?? `Point ${s.debarquement_ordre}`,
        nb_bagages:         v.nb_bagages,
        masse_bagages_kg:   v.masse_bagages_kg,
        contact_urgence_nom:  v.contact_urgence_nom,
        contact_urgence_tel:  v.contact_urgence_tel,
        contact_urgence_qual: v.contact_urgence_qual,
        ref_autorisation:     v.ref_autorisation,
        origine:    OrigineEnregistrement.SAISIE,
        saisie_par: user.sub,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Les rangs sont attribués groupe par groupe, APRÈS lecture du maximum
      // existant. Les attribuer avant ouvrirait une fenêtre où deux saisies
      // concurrentes produiraient le même rang et violeraient la contrainte
      // d'unicité — transaction entière perdue.
      const compteurs = new Map<string, number>();
      for (const ligne of aCreer) {
        const cle = `${ligne.nature}|${ligne.priorite}`;
        if (!compteurs.has(cle)) {
          const max = await tx.ligneListe.aggregate({
            where: { liste_id, nature: ligne.nature, priorite: ligne.priorite },
            _max: { rang: true },
          });
          compteurs.set(cle, max._max.rang ?? 0);
        }
        const suivant = compteurs.get(cle)! + 1;
        compteurs.set(cle, suivant);
        ligne.rang = suivant;
      }

      await tx.ligneListe.createMany({ data: aCreer });
      await tx.potentialite.updateMany({
        where: { id: { in: ids } },
        data:  { statut: StatutPotentialite.RETENUE },
      });
      await tx.listeEmbarquement.update({
        where: { id: liste_id },
        data:  { version: { increment: 1 } },
      });
    });

    this.logger.log(
      `Liste ${liste_id} : ${aCreer.length} inscription(s) par ${user.sub}` +
        (enAttente.length ? `, dont ${enAttente.length} en liste d'attente` : ''),
    );

    return {
      inscrits: aCreer.length,
      bascules_en_attente: enAttente,
      disponibilite: await this.disponibilite(liste, liste.etape.ordre),
    };
  }

  /** Saisie directe, lorsque le demandeur ne figure pas au vivier. */
  async ajouterLigne(liste_id: string, dto: CreateLigneDto, user: JwtPayload): Promise<unknown> {
    this.exigerSaisisseur(user);
    const liste = await this.chargerListe(liste_id, user, 'ECRITURE');
    this.exigerSaisissable(liste);

    const ordreMax = liste.vol.itineraire[0]?.ordre ?? 0;
    this.verifierTrajet(liste.etape.ordre, dto.debarquement_ordre, ordreMax);

    const nature = dto.nature ?? NatureLigne.HIERARCHISEE;
    if (nature === NatureLigne.HIERARCHISEE) {
      const dispo = await this.disponibilite(liste, liste.etape.ordre);
      const masse = dto.masse_bagages_kg ?? 0;
      if (dispo.places <= 0 || dispo.masse_kg < masse) {
        throw new BadRequestException(
          `Quota atteint : ${dispo.places} place(s) et ${dispo.masse_kg} kg disponibles. ` +
            "Inscrivez cette personne en liste d'attente.",
        );
      }
    }

    return this.creerLigne(liste, dto, nature, dto.priorite ?? Priorite.P4,
      OrigineEnregistrement.SAISIE, user.sub, false);
  }

  /**
   * Retire une inscription AVANT tout visa.
   *
   * Distinct de la discrimination : ici la ligne est réellement supprimée, car
   * elle n'a encore été soumise à personne. Une fois le circuit engagé, un
   * retrait devient une DÉCISION et passe par `discriminer()`, qui la conserve.
   */
  async retirerLigne(liste_id: string, ligne_id: string, user: JwtPayload): Promise<unknown> {
    this.exigerSaisisseur(user);
    const liste = await this.chargerListe(liste_id, user, 'ECRITURE');
    this.exigerSaisissable(liste);

    const ligne = await this.prisma.ligneListe.findFirst({ where: { id: ligne_id, liste_id } });
    if (!ligne) throw new NotFoundException('Ligne introuvable sur cette liste');
    if (ligne.verrouille || estImposee(ligne.origine as unknown as OrigineEnregistrement)) {
      throw new ForbiddenException(
        "Cette inscription a été imposée par une autorité centrale : elle ne peut pas être retirée ici.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ligneListe.delete({ where: { id: ligne_id } });
      if (ligne.potentialite_id) {
        await tx.potentialite.update({
          where: { id: ligne.potentialite_id },
          data:  { statut: StatutPotentialite.DISPONIBLE },
        });
      }
      await this.renumeroter(tx, liste_id,
        ligne.nature as unknown as NatureLigne, ligne.priorite as unknown as Priorite);
      await tx.listeEmbarquement.update({
        where: { id: liste_id }, data: { version: { increment: 1 } },
      });
    });

    return { retire: true };
  }

  async ajouterFret(liste_id: string, dto: CreateFretDto, user: JwtPayload): Promise<unknown> {
    this.exigerSaisisseur(user);
    const liste = await this.chargerListe(liste_id, user, 'ECRITURE');
    this.exigerSaisissable(liste);

    const ordreMax = liste.vol.itineraire[0]?.ordre ?? 0;
    this.verifierTrajet(liste.etape.ordre, dto.debarquement_ordre, ordreMax);

    const dispo = await this.disponibilite(liste, liste.etape.ordre);
    if (dispo.masse_kg < dto.poids_kg) {
      throw new BadRequestException(
        `Masse disponible insuffisante : ${dispo.masse_kg} kg restants pour ${dto.poids_kg} kg demandés.`,
      );
    }

    const fret = await this.prisma.fretListe.create({
      data: {
        liste_id,
        designation:      dto.designation.trim(),
        type_mission_log: dto.type_mission_log,
        proprietaire:     dto.proprietaire.trim(),
        poids_kg:         dto.poids_kg,
        volume:           dto.volume ?? null,
        embarquement_ordre: liste.etape.ordre,
        debarquement_ordre: dto.debarquement_ordre,
        destination:        `Point ${dto.debarquement_ordre}`,
        expediteur_nom:      dto.expediteur_nom.trim(),
        expediteur_fonction: dto.expediteur_fonction.trim(),
        expediteur_tel:      dto.expediteur_tel.replace(/[\s.-]/g, ''),
        classe_iata:     dto.classe_iata ?? null,
        conditionnement: dto.conditionnement ?? null,
        origine:    OrigineEnregistrement.SAISIE,
        saisie_par: user.sub,
      },
    });

    await this.prisma.listeEmbarquement.update({
      where: { id: liste_id }, data: { version: { increment: 1 } },
    });
    return fret;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Discrimination — ADJ_AIR, COMRMIA, COMBASE, COMBORD
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Retire, requalifie ou déplace une ligne.
   *
   * Un retrait ne supprime rien : la ligne passe en RETIREE et conserve son
   * motif. C'est ce qui permet de répondre, six mois plus tard, à « pourquoi
   * untel n'a pas embarqué » — une suppression physique rendrait la question
   * sans réponse.
   */
  async discriminer(
    liste_id: string, ligne_id: string, dto: DiscriminerDto, user: JwtPayload,
  ): Promise<unknown> {
    const liste = await this.chargerListe(liste_id, user, 'ECRITURE');
    const etape = this.exigerSonTour(liste, user);

    if (!peutDiscriminer(etape)) {
      throw new ForbiddenException(
        "À cette étape, la liste se constitue : elle ne se discrimine pas encore.",
      );
    }

    const ligne = await this.prisma.ligneListe.findFirst({ where: { id: ligne_id, liste_id } });
    if (!ligne) throw new NotFoundException('Ligne introuvable sur cette liste');

    if (estImposee(ligne.origine as unknown as OrigineEnregistrement)) {
      throw new ForbiddenException(
        `Inscription imposée par le ${ligne.origine} : elle échappe à la discrimination.`,
      );
    }
    if (etape === EtapeListe.COMBORD && ligne.nature !== NatureLigne.HIERARCHISEE) {
      // Le commandant de bord ne voit que le manifeste. Lui laisser toucher la
      // liste d'attente reviendrait à lui confier un arbitrage qui s'est joué
      // trois étapes plus haut.
      throw new ForbiddenException(
        "Le commandant de bord ne discrimine que les passagers portés au manifeste.",
      );
    }

    const natureCible   = dto.nature   ?? (ligne.nature   as unknown as NatureLigne);
    const prioriteCible = dto.priorite ?? (ligne.priorite as unknown as Priorite);

    // Remonter quelqu'un sur la liste hiérarchisée consomme une place : le
    // quota doit être revérifié, sans quoi le repêchage d'un candidat en
    // attente produirait exactement le surplus que la directive interdit.
    if (natureCible === NatureLigne.HIERARCHISEE &&
        ligne.nature !== NatureLigne.HIERARCHISEE) {
      const dispo = await this.disponibilite(liste, liste.etape.ordre);
      if (dispo.places <= 0 || dispo.masse_kg < Number(ligne.masse_bagages_kg)) {
        throw new BadRequestException(
          `Aucune place disponible pour ce repêchage : ${dispo.places} place(s), ` +
            `${dispo.masse_kg} kg. Retirez d'abord quelqu'un de la liste hiérarchisée.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const ancienne = {
        nature:   ligne.nature   as unknown as NatureLigne,
        priorite: ligne.priorite as unknown as Priorite,
      };

      // Rang temporaire négatif : la contrainte @@unique([liste, nature,
      // priorite, rang]) interdit de poser le rang définitif avant d'avoir
      // libéré celui qu'occupe la ligne visée. Le négatif ne peut entrer en
      // collision avec aucun rang réel.
      await tx.ligneListe.update({
        where: { id: ligne_id },
        data: {
          nature: natureCible, priorite: prioriteCible, rang: -Date.now() % 1_000_000,
          discrimine_par: user.sub, discrimine_etape: etape, motif_decision: dto.motif,
        },
      });

      await this.renumeroter(tx, liste_id, ancienne.nature, ancienne.priorite);
      await this.renumeroter(tx, liste_id, natureCible, prioriteCible, {
        ligne_id, position: dto.rang,
      });

      await tx.listeEmbarquement.update({
        where: { id: liste_id }, data: { version: { increment: 1 } },
      });
    });

    this.logger.log(
      `Discrimination ${etape} sur liste ${liste_id} : ligne ${ligne_id} → ` +
        `${natureCible}/${prioriteCible} par ${user.sub}`,
    );
    return this.consulter(liste_id, user);
  }

  /** Réordonnancement complet d'un tableau de priorité. */
  async reordonner(liste_id: string, dto: ReordonnerDto, user: JwtPayload): Promise<unknown> {
    const liste = await this.chargerListe(liste_id, user, 'ECRITURE');
    const etape = this.exigerSonTour(liste, user);
    if (!peutDiscriminer(etape)) {
      throw new ForbiddenException("À cette étape, l'ordre de la liste n'est pas modifiable.");
    }

    const existantes = await this.prisma.ligneListe.findMany({
      where: { liste_id, nature: dto.nature, priorite: dto.priorite },
      select: { id: true },
    });
    const attendus = new Set(existantes.map((l) => l.id));
    const fournis  = new Set(dto.ordre);

    // Un réordonnancement PARTIEL laisserait des rangs orphelins et un tableau
    // dont l'ordre ne correspond ni à l'ancien ni au nouveau. On exige la
    // couverture complète plutôt que de deviner ce que l'appelant voulait.
    if (attendus.size !== fournis.size || [...attendus].some((id) => !fournis.has(id))) {
      throw new BadRequestException(
        `Le nouvel ordre doit couvrir exactement les ${attendus.size} ligne(s) du tableau ` +
          `${dto.nature}/${dto.priorite}.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Deux passes : tous les rangs sont d'abord poussés dans le négatif, où
      // aucune collision n'est possible, puis repositionnés. Une passe unique
      // violerait la contrainte d'unicité dès le premier échange.
      for (const [i, id] of dto.ordre.entries()) {
        await tx.ligneListe.update({ where: { id }, data: { rang: -(i + 1) } });
      }
      for (const [i, id] of dto.ordre.entries()) {
        await tx.ligneListe.update({
          where: { id },
          data: {
            rang: i + 1,
            discrimine_par: user.sub, discrimine_etape: etape, motif_decision: dto.motif,
          },
        });
      }
      await tx.listeEmbarquement.update({
        where: { id: liste_id }, data: { version: { increment: 1 } },
      });
    });

    return this.consulter(liste_id, user);
  }

  /** Retrait de fret par une autorité discriminante. */
  async retirerFret(
    liste_id: string, fret_id: string, motif: string, user: JwtPayload,
  ): Promise<unknown> {
    const liste = await this.chargerListe(liste_id, user, 'ECRITURE');
    const etape = this.exigerSonTour(liste, user);
    if (!peutDiscriminer(etape)) {
      throw new ForbiddenException("À cette étape, le fret n'est pas discriminable.");
    }

    const fret = await this.prisma.fretListe.findFirst({ where: { id: fret_id, liste_id } });
    if (!fret) throw new NotFoundException('Fret introuvable sur cette liste');
    if (fret.verrouille) {
      throw new ForbiddenException('Ce fret a été imposé par une autorité centrale.');
    }

    await this.prisma.fretListe.update({
      where: { id: fret_id },
      data:  { retire: true, discrimine_par: user.sub, motif_decision: motif },
    });
    await this.prisma.listeEmbarquement.update({
      where: { id: liste_id }, data: { version: { increment: 1 } },
    });
    return { retire: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Imposition d'urgence — CEMAA / MAGE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Impose un embarquement, hors quota et hors discrimination.
   *
   * ── Pourquoi hors quota ──
   * Une imposition d'autorité centrale répond à une urgence — évacuation
   * sanitaire, mission ordonnée dans la journée. La soumettre au quota
   * reviendrait à la faire échouer précisément quand elle est nécessaire, le
   * vol étant alors déjà plein.
   *
   * Le prix en est explicite : la ligne consomme une place RÉELLE. Le tronçon
   * peut donc passer en sur-réservation, et `occupationTroncons()` le signalera
   * par un reste négatif. C'est voulu : l'arbitrage appartient alors au
   * commandant de bord, qui discriminera au vu d'une situation qu'il voit.
   */
  async imposer(liste_id: string, dto: ImposerDto, user: JwtPayload): Promise<unknown> {
    const roles = rolesEffectifs(user);
    const attendu = dto.autorite === AutoriteCentrale.MAGE
      ? RoleUtilisateur.MAGE : RoleUtilisateur.CEMAA;
    if (!roles.includes(attendu)) {
      throw new ForbiddenException(
        `Seule l'autorité ${dto.autorite} peut imposer un embarquement en son nom.`,
      );
    }

    const liste = await this.chargerListe(liste_id, user, 'ECRITURE');
    if (liste.statut === StatutListe.CLOTUREE) {
      throw new ConflictException(
        'Le manifeste est définitif : une imposition ne peut plus y être portée.',
      );
    }

    const ordreMax = liste.vol.itineraire[0]?.ordre ?? 0;
    this.verifierTrajet(liste.etape.ordre, dto.debarquement_ordre, ordreMax);

    const origine = dto.autorite === AutoriteCentrale.MAGE
      ? OrigineEnregistrement.MAGE : OrigineEnregistrement.CEMAA;

    const ligne = await this.creerLigne(
      liste, dto, NatureLigne.HIERARCHISEE, dto.priorite ?? Priorite.P1,
      origine, user.sub, true,
    );

    this.logger.warn(
      `Imposition ${dto.autorite} sur liste ${liste_id} : ${dto.nom} ${dto.prenom} ` +
        `par ${user.sub} — ${dto.justification}`,
    );
    return ligne;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Interne
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Vérifie qu'un trajet est cohérent avec l'itinéraire.
   *
   * On débarque APRÈS avoir embarqué, et pas au-delà du dernier point. Sans ce
   * contrôle, un `debarquement_ordre` inférieur produirait un intervalle vide
   * et une ligne qui n'occupe aucun tronçon : un passager invisible du calcul
   * de charge, donc un siège vendu deux fois.
   */
  private verifierTrajet(embarquement: number, debarquement: number, ordreMax: number): void {
    if (debarquement <= embarquement) {
      throw new BadRequestException(
        `Débarquement (point ${debarquement}) antérieur ou égal à l'embarquement ` +
          `(point ${embarquement}).`,
      );
    }
    if (debarquement > ordreMax) {
      throw new BadRequestException(
        `Le point ${debarquement} n'existe pas sur cet itinéraire (${ordreMax} points).`,
      );
    }
  }

  /** Étape que l'utilisateur est habilité à franchir sur cette liste, maintenant. */
  private exigerSonTour(
    liste: { statut: StatutListe; etape_courante: EtapeListe | null },
    user: JwtPayload,
  ): EtapeListe {
    const etape = liste.etape_courante as EtapeListe | null;
    if (!etape) {
      throw new ConflictException("Cette liste n'attend aucune action.");
    }
    if (!this.estSonTour(etape, user)) {
      throw new ConflictException(
        `Ce n'est pas votre tour : la liste est entre les mains de l'étape ${etape}.`,
      );
    }
    return etape;
  }

  private async creerLigne(
    liste: { id: string; etape: { ordre: number } },
    dto: CreateLigneDto,
    nature: NatureLigne,
    priorite: Priorite,
    origine: OrigineEnregistrement,
    saisie_par: string,
    verrouille: boolean,
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const max = await tx.ligneListe.aggregate({
        where: { liste_id: liste.id, nature, priorite },
        _max: { rang: true },
      });

      const ligne = await tx.ligneListe.create({
        data: {
          liste_id: liste.id,
          nature, priorite,
          rang: (max._max.rang ?? 0) + 1,
          nom:    dto.nom.trim(),
          prenom: dto.prenom.trim(),
          grade:     dto.grade?.trim()     ?? null,
          matricule: dto.matricule?.trim() ?? null,
          cni:       dto.cni?.trim()       ?? null,
          unite:     dto.unite?.trim()     ?? null,
          telephone: dto.telephone.replace(/[\s.-]/g, ''),
          categorie: dto.categorie,
          embarquement_ordre: liste.etape.ordre,
          debarquement_ordre: dto.debarquement_ordre,
          destination:        `Point ${dto.debarquement_ordre}`,
          nb_bagages:       dto.nb_bagages ?? 0,
          masse_bagages_kg: dto.masse_bagages_kg ?? 0,
          couleur_bagages:  dto.couleur_bagages ?? null,
          contact_urgence_nom:  dto.contact_urgence_nom ?? null,
          contact_urgence_tel:  dto.contact_urgence_tel?.replace(/[\s.-]/g, '') ?? null,
          contact_urgence_qual: dto.contact_urgence_qual ?? null,
          ref_autorisation:     dto.ref_autorisation ?? null,
          origine, saisie_par, verrouille,
        },
      });

      await tx.listeEmbarquement.update({
        where: { id: liste.id }, data: { version: { increment: 1 } },
      });
      return ligne;
    });
  }

  /**
   * Renumérote un tableau (nature, priorité) en 1..n sans trou.
   *
   * `cible` permet d'insérer une ligne à une position précise. Sans trou, parce
   * qu'un tableau de priorité affiché « 1, 2, 5, 9 » fait immanquablement
   * croire à un document incomplet.
   */
  private async renumeroter(
    tx: Prisma.TransactionClient,
    liste_id: string,
    nature: NatureLigne,
    priorite: Priorite,
    cible?: { ligne_id: string; position?: number },
  ): Promise<void> {
    const lignes = await tx.ligneListe.findMany({
      where: { liste_id, nature, priorite },
      orderBy: { rang: 'asc' },
      select: { id: true },
    });

    let ordre = lignes.map((l) => l.id);

    if (cible) {
      ordre = ordre.filter((id) => id !== cible.ligne_id);
      const pos = cible.position
        ? Math.min(Math.max(1, cible.position), ordre.length + 1)
        : ordre.length + 1;
      ordre.splice(pos - 1, 0, cible.ligne_id);
    }

    // Deux passes, pour la même raison que dans `reordonner` : la contrainte
    // d'unicité interdit un échange en une seule écriture.
    for (const [i, id] of ordre.entries()) {
      await tx.ligneListe.update({ where: { id }, data: { rang: -(i + 1) } });
    }
    for (const [i, id] of ordre.entries()) {
      await tx.ligneListe.update({ where: { id }, data: { rang: i + 1 } });
    }
  }
}