// apps/pdf-service/src/pdf/liste-data.service.ts
//
// Charge une liste d'embarquement et la projette vers le contrat de rendu.
//
// ── Le point à ne pas rater : qui a droit à la liste d'attente ──
// La directive la communique à l'ADJ_AIR et, par ricochet, aux autorités
// amont. Elle ne la communique PAS au commandant de bord : le manifeste ne
// porte que les retenus. Ce filtrage est fait ici, côté serveur, et non dans
// le gabarit — les données ne doivent même pas être projetées pour quelqu'un
// qui n'y a pas droit.

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import {
  NiveauConfidentialite, RoleUtilisateur, JwtPayload, Rmia,
  EtapeListe, MentionVisa, Priorite, NatureLigne, OrigineEnregistrement,
  Perimetre, perimetreEffectif, rolesEffectifs, rmiasCouvertes,
  repartirParPriorite, ROLES_DELEGATAIRES_COMBASE,
} from '@sigea/shared-types';
import { ListeRenderData, LigneRenderData } from './liste-template';

@Injectable()
export class ListeDataService {
  constructor(private readonly prisma: PrismaService) {}

  async charger(
    liste_id: string,
    user: JwtPayload,
  ): Promise<{ data: ListeRenderData; niveau: NiveauConfidentialite }> {
    const l = await this.prisma.listeEmbarquement.findUnique({
      where: { id: liste_id },
      include: {
        etape: {
          select: { ordre: true, base_id: true, base: { select: { code_base: true, nom: true } } },
        },
        vol: {
          select: {
            numero_mission: true, immatriculation: true, date_heure: true,
            type_mission: true, flag_sensible: true, combord_id: true,
            itineraire: {
              select: { ordre: true, base: { select: { code_base: true } } },
              orderBy: { ordre: 'asc' },
            },
          },
        },
        lignes: { orderBy: [{ priorite: 'asc' }, { rang: 'asc' }] },
        visas:  { orderBy: { date_heure: 'asc' } },
      },
    });
    if (!l) throw new NotFoundException('Liste introuvable');

    const roles = rolesEffectifs(user);
    const national = perimetreEffectif(user) === Perimetre.NATIONAL;
    const deLaRmia = rmiasCouvertes(user).includes(l.rmia as Rmia);
    const deLaBase = l.etape.base_id === user.base_id &&
      roles.some((r) => r === RoleUtilisateur.COMBASE || ROLES_DELEGATAIRES_COMBASE.includes(r));
    const leCombord = roles.includes(RoleUtilisateur.COMBORD) && l.vol.combord_id === user.sub;

    if (!national && !deLaRmia && !deLaBase && !leCombord) {
      throw new NotFoundException('Liste introuvable');
    }

    // Le commandant de bord n'a jamais la liste d'attente, même s'il peut voir
    // la liste hiérarchisée dont son manifeste est issu.
    const droitAttente = !leCombord || deLaRmia || deLaBase || national;

    const projeter = (x: typeof l.lignes[number]): LigneRenderData => ({
      rang:        x.rang,
      nom:         x.nom,
      prenom:      x.prenom,
      grade:       x.grade,
      matricule:   x.matricule,
      unite:       x.unite,
      categorie:   String(x.categorie),
      telephone:   x.telephone,
      destination: x.destination,
      nb_bagages:  x.nb_bagages,
      masse_bagages_kg: Number(x.masse_bagages_kg),
      imposee: (x.origine as unknown as OrigineEnregistrement) !== OrigineEnregistrement.SAISIE,
    });

    const hierarchisees = l.lignes
      .filter((x) => (x.nature as unknown as NatureLigne) === NatureLigne.HIERARCHISEE)
      .map((x) => ({ ...projeter(x), priorite: x.priorite as unknown as Priorite }));

    const attente = l.lignes
      .filter((x) => (x.nature as unknown as NatureLigne) === NatureLigne.ATTENTE)
      .sort((a, b) => a.rang - b.rang)
      .map(projeter);

    const data: ListeRenderData = {
      id:      l.id,
      version: l.version,
      statut:  String(l.statut),
      rmia:    String(l.rmia),

      vol: {
        numero_mission:  l.vol.numero_mission,
        immatriculation: l.vol.immatriculation,
        date_heure:      l.vol.date_heure,
        type_mission:    String(l.vol.type_mission),
        itineraire: l.vol.itineraire.map((e) => ({
          ordre: e.ordre, code_base: e.base.code_base,
        })),
      },
      point: {
        ordre: l.etape.ordre,
        code_base: l.etape.base.code_base,
        nom: l.etape.base.nom,
      },

      quota_places:   l.quota_places,
      quota_masse_kg: Number(l.quota_masse_kg),

      // `repartirParPriorite` produit TOUJOURS six tableaux, même vides.
      // C'est la même fonction que celle utilisée par l'IHM : l'écran et le
      // document imprimé présentent donc rigoureusement le même ordre.
      tableaux: repartirParPriorite(hierarchisees).map((t) => ({
        priorite: t.priorite,
        libelle:  t.libelle,
        lignes:   t.lignes as LigneRenderData[],
      })),
      liste_attente: droitAttente ? attente : null,

      visas: l.visas
        .filter((v) => (v.etape as unknown as EtapeListe) !== EtapeListe.COMBORD)
        .map((v) => ({
          etape:             v.etape as unknown as EtapeListe,
          mention:           v.mention as unknown as MentionVisa,
          signataire_nom:    v.signataire_nom,
          signataire_prenom: v.signataire_prenom,
          signataire_grade:  v.signataire_grade,
          signataire_titre:  v.signataire_titre,
          date_heure:        v.date_heure,
          par_interim:       v.par_interim,
          titulaire_nom:     v.titulaire_nom,
          titulaire_grade:   v.titulaire_grade,
          delegataire_nom:   v.delegataire_nom,
          delegataire_grade: v.delegataire_grade,
          // Forme courte, comparable de visu sur un document imprimé. Elle
          // atteste du contenu exact qu'a vu CE signataire — c'est ce qui
          // permet de constater qu'une liste a changé entre deux visas.
          hash_court:        v.hash_contenu.slice(0, 16).toUpperCase(),
        })),

      // Pas de QR sur la liste : elle n'est pas un document de contrôle au sol.
      // Son authenticité se vérifie par les empreintes imprimées sous chaque
      // visa, qui sont plus parlantes ici — elles disent qui a vu quoi.
      authenticite: null,
    };

    return {
      data,
      niveau: l.vol.flag_sensible
        ? NiveauConfidentialite.SENSIBLE_CEMAA
        : NiveauConfidentialite.DIFFUSION_RESTREINTE,
    };
  }
}