// apps/frontend/src/services/potentialite.service.ts
//
// Vivier des voyageurs potentiels et pièces justificatives.
//
// Extrait de `liste.service.ts`, où le domaine commençait à peser : le vivier
// a maintenant ses filtres, ses pièces jointes et son écran propre. Pensez à
// supprimer l'export `potentialiteService` de `liste.service.ts` et à corriger
// l'import dans `hooks/useListes.ts`.

import { api } from '@/lib/api';
import type { CategoriePassager, Priorite, Rmia, NaturePiece } from '@sigea/shared-types';

export interface PieceJointe {
  id: string;
  nature: NaturePiece;
  nom_fichier: string;
  type_mime: string;
  taille_octets: number;
  sha256: string;
  createdAt: string;
}

export interface Potentialite {
  id: string;
  rmia: Rmia;
  nom: string;
  prenom: string;
  grade: string | null;
  matricule: string | null;
  cni: string | null;
  unite: string | null;
  telephone: string;
  categorie: CategoriePassager;
  priorite_proposee: Priorite;

  date_vol_souhaitee: string | null;
  base_depart_id: string | null;
  base_arrivee_id: string | null;
  base_depart?: { code_base: string; nom: string } | null;
  base_arrivee?: { code_base: string; nom: string } | null;

  motif: string | null;
  ref_autorisation: string | null;
  nb_bagages: number;
  masse_bagages_kg: string | number;
  contact_urgence_nom: string | null;
  contact_urgence_tel: string | null;
  statut: string;
  valable_jusqu_au: string | null;

  pieces?: PieceJointe[];
  _count?: { pieces: number };
}

export interface FiltrePotentialite {
  q?: string;
  statut?: string;
  categorie?: string;
  date_debut?: string;
  date_fin?: string;
  base_depart_id?: string;
  base_arrivee_id?: string;
  inclure_sans_date?: '0' | '1';
  inclure_perimees?: '0' | '1';
  page?: number;
  taille?: number;
}

export const potentialiteService = {
  lister(params: FiltrePotentialite) {
    return api
      .get<{ total: number; page: number; taille: number; elements: Potentialite[] }>(
        '/potentialites', { params },
      )
      .then((r) => r.data);
  },

  consulter(id: string) {
    return api.get<Potentialite>(`/potentialites/${id}`).then((r) => r.data);
  },

  creer(dto: Record<string, unknown>) {
    return api.post<Potentialite>('/potentialites', dto).then((r) => r.data);
  },

  modifier(id: string, dto: Record<string, unknown>) {
    return api.patch<Potentialite>(`/potentialites/${id}`, dto).then((r) => r.data);
  },

  archiver(id: string, motif: string) {
    return api.patch(`/potentialites/${id}/archiver`, { motif }).then((r) => r.data);
  },

  /**
   * Dépose une pièce.
   *
   * Le fichier est converti en base64 côté navigateur. On retire le préfixe
   * `data:...;base64,` que produit FileReader : le serveur attend la charge
   * utile seule, et le laisser ferait échouer la validation base64 avec un
   * message peu parlant.
   */
  async deposerPiece(
    potentialite_id: string, nature: NaturePiece, fichier: File,
  ): Promise<PieceJointe> {
    const contenu_base64 = await new Promise<string>((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onload = () => {
        const brut = String(lecteur.result);
        resolve(brut.slice(brut.indexOf(',') + 1));
      };
      lecteur.onerror = () => reject(new Error('Lecture du fichier impossible'));
      lecteur.readAsDataURL(fichier);
    });

    const { data } = await api.post<PieceJointe>(
      `/potentialites/${potentialite_id}/pieces`,
      {
        nature,
        nom_fichier: fichier.name,
        type_mime: fichier.type || 'application/octet-stream',
        contenu_base64,
      },
    );
    return data;
  },

  supprimerPiece(piece_id: string) {
    return api.delete(`/potentialites/pieces/${piece_id}`).then((r) => r.data);
  },

  /**
   * Télécharge une pièce.
   *
   * On passe par axios en `blob` et non par un simple lien : la route exige
   * l'en-tête d'authentification, qu'un `<a href>` ne transmet pas. L'URL
   * temporaire est révoquée aussitôt, sinon le navigateur conserve le document
   * en mémoire pour toute la durée de la session — ce sont des pièces
   * nominatives.
   */
  async ouvrirPiece(piece: PieceJointe): Promise<void> {
    const { data } = await api.get<Blob>(`/potentialites/pieces/${piece.id}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(data);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = piece.nom_fichier;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    URL.revokeObjectURL(url);
  },
};

export const LIBELLE_NATURE: Record<string, string> = {
  ORDRE_MISSION:      'Ordre de mission',
  TITRE_PERMISSION:   'Titre de permission',
  PIECE_IDENTITE:     "Pièce d'identité",
  CERTIFICAT_MEDICAL: 'Certificat médical',
  AUTORISATION:       'Autorisation',
  AUTRE:              'Autre',
};