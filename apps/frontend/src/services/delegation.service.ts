// apps/frontend/src/services/delegation.service.ts
//
// Désignation d'un délégataire pour la discrimination à l'étape COMBASE.
//
// Service distinct plutôt qu'ajout à `liste.service.ts` : le circuit et la
// délégation sont deux contrôleurs distincts côté serveur, et les garder
// séparés ici rend immédiat le repérage de ce qui dépend de quoi.

import { api } from '@/lib/api';

export interface OfficierDesignable {
  id: string;
  nom: string;
  prenom: string;
  grade: string;
  role: string;
}

export interface DelegationEnCours {
  delegue_a: OfficierDesignable;
  delegue_le: string | null;
  motif: string | null;
}

export interface EtatDelegation {
  etape_courante: string | null;
  candidats: OfficierDesignable[];
  /** `null` tant qu'aucune désignation n'a été posée. */
  delegation: DelegationEnCours | null;
}

export const delegationService = {
  candidats(liste_id: string) {
    return api.get<EtatDelegation>(`/listes/${liste_id}/delegation`).then((r) => r.data);
  },

  deleguer(liste_id: string, delegataire_id: string, motif: string) {
    return api
      .post<DelegationEnCours>(`/listes/${liste_id}/delegation`, { delegataire_id, motif })
      .then((r) => r.data);
  },

  revoquer(liste_id: string) {
    return api.delete<{ revoque: boolean }>(`/listes/${liste_id}/delegation`)
      .then((r) => r.data);
  },
};