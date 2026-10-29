// apps/pdf-service/src/pdf/manifeste-data.service.ts
//
// Charge un manifeste et le PROJETTE vers le contrat de rendu. Le gabarit ne
// connaît pas Prisma ; ce service est l'unique point de couplage entre le
// schéma et le rendu.
//
// ── Les deux filtrages qui se font ICI, et nulle part ailleurs ──
//   1. Les passagers et matériels RETIRÉS par le commandant de bord ne sont pas
//      projetés. Le manifeste est le document d'embarquement, pas le journal de
//      la décision.
//   2. Le périmètre de lecture. Un 404 — et non un 403 — sanctionne le
//      hors-périmètre : confirmer l'existence d'un manifeste qu'on n'a pas le
//      droit de lire renseignerait déjà sur un mouvement aérien.
//
// Les faire ici plutôt que dans le gabarit garantit qu'aucun futur gabarit ne
// pourra les oublier.

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@sigea/shared-database';
import {
  NiveauConfidentialite, RoleUtilisateur, JwtPayload, Rmia,
  EtapeListe, MentionVisa, Priorite, OrigineEnregistrement,
  Perimetre, perimetreEffectif, rolesEffectifs, rmiasCouvertes,
  ROLES_DELEGATAIRES_COMBASE,
} from '@sigea/shared-types';
import { ManifesteRenderData } from './manifeste-template';
import { AuthenticiteService } from '../verification/authenticite.service';

@Injectable()
export class ManifesteDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authenticite: AuthenticiteService,
  ) {}

  private filtre(user: JwtPayload): Prisma.ManifesteWhereInput {
    const roles = rolesEffectifs(user);
    if (perimetreEffectif(user) === Perimetre.NATIONAL) return {};

    const clauses: Prisma.ManifesteWhereInput[] = [];
    const rmias = rmiasCouvertes(user);
    if (rmias.length) clauses.push({ liste: { rmia: { in: rmias as Rmia[] } } });
    if (roles.some((r) => r === RoleUtilisateur.COMBASE || ROLES_DELEGATAIRES_COMBASE.includes(r))) {
      clauses.push({ base_id: user.base_id });
    }
    if (roles.includes(RoleUtilisateur.COMBORD)) {
      clauses.push({ vol: { combord_id: user.sub } });
    }
    return clauses.length ? { OR: clauses } : { id: '' };
  }

  async charger(
    manifeste_id: string,
    user: JwtPayload,
  ): Promise<{ data: ManifesteRenderData; niveau: NiveauConfidentialite }> {
    const m = await this.prisma.manifeste.findFirst({
      where: { AND: [{ id: manifeste_id }, this.filtre(user)] },
      include: {
        base:  { select: { code_base: true, nom: true, numero: true } },
        etape: { select: { ordre: true } },
        vol: {
          select: {
            numero_mission: true, immatriculation: true, date_heure: true, type_mission: true,
            itineraire: {
              select: { ordre: true, base: { select: { code_base: true } } },
              orderBy: { ordre: 'asc' },
            },
          },
        },
        passagers: {
          where:   { retire: false },
          orderBy: [{ priorite: 'asc' }, { rang: 'asc' }],
        },
        materiels: { where: { retire: false }, orderBy: { designation: 'asc' } },
        equipages: { orderBy: [{ nom: 'asc' }, { prenom: 'asc' }] },
        liste: {
          select: {
            visas: {
              where:  { etape: EtapeListe.COMBORD },
              take:   1,
            },
          },
        },
      },
    });

    if (!m) {
      throw new NotFoundException(
        `Manifeste ${manifeste_id} introuvable ou hors de votre périmètre`,
      );
    }

    const visa = m.liste?.visas?.[0] ?? null;

    // Bandeau d'imposition : compté sur les lignes réellement portées, pas sur
    // les consignes. Une consigne peut exister sans qu'aucun nom n'ait été
    // imposé ; ce qui doit alerter le lecteur, c'est la présence d'un nom.
    const imposes = m.passagers.filter(
      (p) => (p.origine as unknown as OrigineEnregistrement) !== OrigineEnregistrement.SAISIE,
    );

    const data: ManifesteRenderData = {
      id:      m.id,
      numero:  m.numero_manifeste,
      statut:  String(m.statut),
      version: m.version,
      flag_sensible: m.flag_sensible,
      imposition: imposes.length
        ? { autorite: String(imposes[0].origine), nb: imposes.length }
        : null,

      base:  m.base,
      point: { ordre: m.etape?.ordre ?? 0 },
      vol: m.vol
        ? {
            numero_mission:  m.vol.numero_mission,
            immatriculation: m.vol.immatriculation,
            date_heure:      m.vol.date_heure,
            type_mission:    String(m.vol.type_mission),
            itineraire: m.vol.itineraire.map((e) => ({
              ordre: e.ordre, code_base: e.base.code_base,
            })),
          }
        : null,

      // Prisma renvoie les champs optionnels en `string | null` ; le contrat de
      // rendu attend `string | undefined`. La conversion est explicite pour que
      // `null` ne s'imprime jamais tel quel.
      passagers: m.passagers.map((p) => ({
        priorite:    String(p.priorite as unknown as Priorite),
        rang:        p.rang,
        nom:         p.nom,
        prenom:      p.prenom,
        grade:       p.grade ?? undefined,
        categorie:   String(p.categorie),
        unite:       p.unite ?? undefined,
        destination: p.destination,
        nb_bagages:  p.nb_bagages,
        masse_bagages_kg: Number(p.masse_bagages_kg),
        imposee: (p.origine as unknown as OrigineEnregistrement) !== OrigineEnregistrement.SAISIE,
      })),
      materiels: m.materiels.map((x) => ({
        designation:  x.designation,
        proprietaire: x.proprietaire,
        poids_kg:     Number(x.poids_kg),
        destination:  x.destination,
        classe_iata:  x.classe_iata,
      })),
      equipages: m.equipages.map((e) => ({
        nom: e.nom, prenom: e.prenom, grade: e.grade, fonction: String(e.fonction),
      })),

      totaux: {
        passagers: m.passagers.length,
        masse_bagages_kg: Number(
          m.passagers.reduce((s, p) => s + Number(p.masse_bagages_kg), 0).toFixed(2),
        ),
        masse_fret_kg: Number(
          m.materiels.reduce((s, x) => s + Number(x.poids_kg), 0).toFixed(2),
        ),
      },

      visa: visa
        ? {
            mention:           visa.mention as unknown as MentionVisa,
            signataire_nom:    visa.signataire_nom,
            signataire_prenom: visa.signataire_prenom,
            signataire_grade:  visa.signataire_grade,
            signataire_titre:  visa.signataire_titre,
            immatriculation:   m.vol?.immatriculation ?? null,
            date_heure:        visa.date_heure,
            par_interim:       visa.par_interim,
            titulaire_nom:     visa.titulaire_nom,
            titulaire_grade:   visa.titulaire_grade,
          }
        : null,

      authenticite: await this.authenticite.cartouche(manifeste_id),
    };

    return { data, niveau: this.niveau(m.flag_sensible, String(m.statut)) };
  }

  /**
   * Niveau de confidentialité, qui commande le filigrane.
   *
   * Un manifeste encore à l'état EMIS porte « DIFFUSION RESTREINTE » même s'il
   * n'est pas sensible : il n'est pas définitif, et un tirage intermédiaire ne
   * doit pas circuler comme s'il l'était.
   */
  private niveau(sensible: boolean, statut: string): NiveauConfidentialite {
    if (sensible) return NiveauConfidentialite.SENSIBLE_CEMAA;
    if (statut !== 'DEFINITIF') return NiveauConfidentialite.DIFFUSION_RESTREINTE;
    return NiveauConfidentialite.NON_CLASSIFIE;
  }
}