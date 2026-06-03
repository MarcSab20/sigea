import { api } from '@/lib/api';

export interface Vol {
  id: string; numero_mission: string; immatriculation: string;
  date_heure: string; base_depart_id: string; base_arrivee_id: string;
  type_mission: string; flag_sensible: boolean;
  capacite_places: number; capacite_cargo_kg: number; statut: string;
}

export interface Manifeste {
  id: string; vol_id: string; base_id: string; statut: string;
  etape_vol: string; version: number; flag_sensible: boolean;
  cree_par: string; createdAt: string; updatedAt: string;
  vol?: Vol;
  passagers?: Passager[];
  materiels?: Materiel[];
  validations?: ValidationEtape[];
  _count?: { passagers: number; materiels: number };
}

export interface Passager {
  id?: string; manifeste_id?: string; base_id?: string;
  nom: string; prenom: string; grade?: string; categorie: string;
  matricule?: string; unite?: string; destination: string;
  nb_bagages: number; masse_bagages_kg: number; couleur_bagages?: string;
  contact_urgence_nom: string; contact_urgence_tel: string;
  contact_urgence_qual?: string; ref_autorisation?: string;
  origine?: string; verrouille?: boolean; sensible?: boolean;
}

export interface Materiel {
  id?: string; manifeste_id?: string; designation: string;
  type_mission_log: string; proprietaire: string; poids_kg: number;
  volume?: number; destination: string; expediteur_nom: string;
  expediteur_fonction: string; expediteur_tel: string;
  origine?: string; verrouille?: boolean; sensible?: boolean;
}

export interface ValidationEtape {
  id: string; etape: string; statut: string;
  validateur_id?: string; commentaire?: string; date_heure: string;
}

export interface CreateManifesteDto {
  vol_id: string; etape_vol?: string; manifeste_maitre_id?: string;
}

export const manifesteApi = {
  list: (): Promise<Manifeste[]> =>
    api.get<Manifeste[]>('/manifestes').then(r => r.data),

  get: (id: string): Promise<Manifeste> =>
    api.get<Manifeste>(`/manifestes/${id}`).then(r => r.data),

  create: (dto: CreateManifesteDto): Promise<Manifeste> =>
    api.post<Manifeste>('/manifestes', dto).then(r => r.data),

  soumettre: (id: string): Promise<Manifeste> =>
    api.patch<Manifeste>(`/manifestes/${id}/soumettre`).then(r => r.data),

  addPassager: (manifesteId: string, p: Passager): Promise<Passager> =>
    api.post<Passager>(`/manifestes/${manifesteId}/passagers`, p).then(r => r.data),

  addMateriel: (manifesteId: string, m: Materiel): Promise<Materiel> =>
    api.post<Materiel>(`/manifestes/${manifesteId}/materiels`, m).then(r => r.data),
};

export const volApi = {
  list: (): Promise<Vol[]> =>
    api.get<Vol[]>('/vols').then(r => r.data),
};

export const referentielApi = {
  bases: () => api.get('/referentiel/bases').then(r => r.data),
  aeronefs: () => api.get('/referentiel/aeronefs').then(r => r.data),
  personnels: () => api.get('/referentiel/personnels').then(r => r.data),
};