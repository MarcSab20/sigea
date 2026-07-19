// apps/pdf-service/src/pdf/manifeste-data.service.ts
//
// Charge un manifeste depuis la base et le PROJETTE vers le contrat de rendu
// (ManifesteRenderData). Le template ne connaît pas Prisma ; ce service est
// l'unique point de couplage entre le schéma et le rendu.

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { NiveauConfidentialite, RoleUtilisateur, JwtPayload } from '@sigea/shared-types';
import { ManifesteRenderData, TamponData } from './manifeste-template';

@Injectable()
export class ManifesteDataService {
  constructor(private readonly prisma: PrismaService) {}

  async charger(
    manifeste_id: string,
    user: JwtPayload,
  ): Promise<{ data: ManifesteRenderData; niveau: NiveauConfidentialite }> {
    // Cloisonnement : hors CEMAA (lecture globale), un utilisateur ne peut
    // imprimer que les manifestes de sa base. Le COMBORD est une exception :
    // il signe des manifestes qui ne sont pas de "sa" base d'affectation,
    // mais son périmètre est déjà contrôlé en amont par le circuit — on le
    // laisse imprimer ce qu'il a le droit de voir via le vol.
    const cloisonnement =
      user.role === RoleUtilisateur.CEMAA || user.role === RoleUtilisateur.COMBORD
        ? {}
        : { base_id: user.base_id };

    const m = await this.prisma.manifeste.findFirst({
      where: { id: manifeste_id, ...cloisonnement },
      include: {
        base: { select: { code_base: true, nom: true, numero: true } },
        vol: {
          select: {
            numero_mission: true, immatriculation: true, date_heure: true, type_mission: true,
            base_depart:  { select: { code_base: true } },
            base_arrivee: { select: { code_base: true } },
          },
        },
        passagers:    { select: { nom: true, prenom: true, grade: true, categorie: true, unite: true } },
        materiels:    { select: { designation: true, poids_kg: true } },
        // MarchandiseDangereuse : les champs réels sont nature / classe_iata /
        // description, pas designation/classe_onu.
        marchandises: { select: { nature: true, description: true, classe_iata: true, poids_kg: true } },
        equipages:    { select: { nom: true, prenom: true, fonction: true } },
        validations: {
          select: {
            etape: true, statut: true, mention: true,
            tampon_ligne1: true, tampon_ligne2: true,
            signataire_nom: true, signataire_grade: true, date_heure: true,
          },
        },
      },
    });

    if (!m) {
      throw new NotFoundException(
        `Manifeste ${manifeste_id} introuvable ou hors de votre périmètre`,
      );
    }

    // Un manifeste en brouillon n'a pas à être imprimé comme document officiel :
    // il n'a encore aucun visa. On l'autorise malgré tout en interne, mais on
    // bloque un accès purement externe (CEMAA en lecture seule ne doit pas
    // exporter un brouillon d'une autre base).
    if (m.statut === 'BROUILLON' && user.role === RoleUtilisateur.CEMAA) {
      throw new ForbiddenException('Un manifeste en brouillon ne peut pas être exporté');
    }

    const data: ManifesteRenderData = {
      id:            m.id,
      numero:        m.id.slice(0, 8).toUpperCase(),
      statut:        m.statut,
      etape_courante: m.etape_courante,
      flag_sensible: m.flag_sensible,
      consignes_cemaa_appliquees: m.consignes_cemaa_appliquees,
      consignes_cemaa_date: m.consignes_cemaa_date,
      base: m.base,
      vol: m.vol
        ? {
            numero_mission:  m.vol.numero_mission,
            immatriculation: m.vol.immatriculation,
            date_heure:      m.vol.date_heure,
            type_mission:    m.vol.type_mission,
            base_depart:     m.vol.base_depart,
            base_arrivee:    m.vol.base_arrivee,
          }
        : null,
      // Prisma renvoie grade/unite en `string | null` ; le contrat de rendu
      // attend `string | undefined`. On convertit null → undefined.
      passagers: m.passagers.map((p) => ({
        nom:       p.nom,
        prenom:    p.prenom,
        grade:     p.grade ?? undefined,
        categorie: String(p.categorie),
        unite:     p.unite ?? undefined,
      })),
      materiels: m.materiels.map((x) => ({
        designation: x.designation,
        quantite: 1,
        poids_kg: x.poids_kg?.toString(),
      })),
      // Le contrat de rendu attend { designation, classe_onu, poids_kg } :
      // on mappe nature → designation et classe_iata → classe_onu.
      marchandises: m.marchandises.map((x) => ({
        designation: x.nature || x.description,
        classe_onu:  x.classe_iata,
        poids_kg:    x.poids_kg?.toString(),
      })),
      equipages: m.equipages.map((x) => ({
        nom: x.nom,
        prenom: x.prenom,
        fonction: String(x.fonction),
      })),
      // Les enums Prisma (EtapeValidation, MentionSignature, StatutValidation)
      // sont des types NOMINAUX distincts de ceux de @sigea/shared-types, même
      // à valeurs identiques. On projette explicitement via `as` sur les types
      // du contrat de rendu (TamponData) pour franchir cette frontière.
      validations: m.validations.map((v) => ({
        etape:            v.etape as unknown as TamponData['etape'],
        statut:           v.statut as unknown as TamponData['statut'],
        mention:          (v.mention as unknown as TamponData['mention']) ?? null,
        tampon_ligne1:    v.tampon_ligne1,
        tampon_ligne2:    v.tampon_ligne2,
        signataire_nom:   v.signataire_nom,
        signataire_grade: v.signataire_grade,
        date_heure:       v.date_heure,
      })),
    };

    // Niveau de confidentialité dérivé de la sensibilité du vol. Le schéma ne
    // stocke pas de niveau explicite ; flag_sensible est le seul signal fiable.
    const niveau = m.flag_sensible
      ? NiveauConfidentialite.SENSIBLE_CEMAA
      : NiveauConfidentialite.DIFFUSION_RESTREINTE;

    return { data, niveau };
  }
}