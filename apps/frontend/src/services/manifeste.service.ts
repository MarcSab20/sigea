import { api } from '@/lib/api';
import {
  estEnLigne, empiler, nouvelIdentifiantLocal, estIdentifiantLocal, lister as listerFile,
} from '@/offline/outbox';
import * as brouillons from '@/offline/brouillons';

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

/**
 * Erreur levée quand une action exige la connexion.
 *
 * Type distinct d'une erreur réseau ordinaire : l'interface doit dire « cette
 * action n'est pas possible hors ligne » et non « la requête a échoué,
 * réessayez » — le second message ferait réessayer indéfiniment.
 */
export class ActionEnLigneRequise extends Error {
  constructor(action: string) {
    super(
      `${action} exige une connexion. Cette action engage le circuit de validation : ` +
        'elle ne peut pas être différée.',
    );
    this.name = 'ActionEnLigneRequise';
  }
}

export const manifesteApi = {
  /**
   * Liste serveur, complétée des brouillons saisis hors ligne.
   *
   * Les brouillons locaux sont placés en tête : ce sont les plus récents, et
   * ce sont ceux qui appellent une action de l'opérateur.
   */
  list: async (): Promise<Manifeste[]> => {
    const locaux = brouillons.lister();
    if (!estEnLigne()) return locaux;
    try {
      const { data } = await api.get<Manifeste[]>('/manifestes');
      return [...locaux, ...data];
    } catch (e) {
      // Le navigateur se croit en ligne mais la requête a échoué (portail
      // captif, serveur injoignable). Afficher au moins les brouillons vaut
      // mieux qu'un écran vide.
      if (locaux.length) return locaux;
      throw e;
    }
  },

  get: async (id: string): Promise<Manifeste> => {
    const local = brouillons.lire(id);
    if (local) return local;
    if (estIdentifiantLocal(id)) {
      throw new Error("Ce brouillon local n'existe plus : il a été transmis ou abandonné.");
    }
    return api.get<Manifeste>(`/manifestes/${id}`).then(r => r.data);
  },

  /**
   * Création. Hors ligne, un identifiant local est attribué et l'opération
   * empilée ; l'objet renvoyé permet à l'interface de continuer normalement.
   */
  create: async (dto: CreateManifesteDto): Promise<Manifeste> => {
    if (estEnLigne()) return api.post<Manifeste>('/manifestes', dto).then(r => r.data);

    const id = nouvelIdentifiantLocal();
    const maintenant = new Date().toISOString();
    const brouillon: brouillons.BrouillonLocal = {
      _local: true,
      id,
      vol_id: dto.vol_id,
      base_id: '',
      statut: 'BROUILLON',
      etape_vol: dto.etape_vol ?? '',
      version: 1,
      flag_sensible: false,
      cree_par: '',
      createdAt: maintenant,
      updatedAt: maintenant,
      passagers: [],
      materiels: [],
      _count: { passagers: 0, materiels: 0 },
    };
    brouillons.creer(brouillon);

    await empiler({
      type: 'MANIFESTE_CREER',
      methode: 'POST',
      url: '/manifestes',
      corps: dto,
      id_local: id,
      libelle: 'Création d\'un manifeste',
    });

    return brouillon;
  },

  /**
   * Soumission — JAMAIS différée.
   *
   * Soumettre fait entrer le manifeste dans le circuit de validation et
   * déclenche des notifications. Empiler cette action reviendrait à faire
   * croire à l'opérateur que le dossier avance alors qu'il dort dans une file.
   */
  soumettre: (id: string): Promise<Manifeste> => {
    if (!estEnLigne()) throw new ActionEnLigneRequise('La soumission d\'un manifeste');
    if (estIdentifiantLocal(id)) {
      throw new ActionEnLigneRequise(
        'La soumission de ce manifeste, qui n\'a pas encore été transmis au serveur,',
      );
    }
    return api.patch<Manifeste>(`/manifestes/${id}/soumettre`).then(r => r.data);
  },

  addPassager: async (manifesteId: string, p: Passager): Promise<Passager> => {
    // Un manifeste encore local n'existe pas côté serveur : même en ligne,
    // l'ajout doit être empilé derrière sa création, sans quoi l'URL partirait
    // avec un identifiant « local-… ».
    if (estEnLigne() && !estIdentifiantLocal(manifesteId)) {
      return api.post<Passager>(`/manifestes/${manifesteId}/passagers`, p).then(r => r.data);
    }

    brouillons.ajouterPassager(manifesteId, p);
    await empiler({
      type: 'PASSAGER_AJOUTER',
      methode: 'POST',
      url: `/manifestes/${manifesteId}/passagers`,
      corps: p,
      libelle: `Passager ${p.nom} ${p.prenom}`,
    });
    return p;
  },

  addMateriel: async (manifesteId: string, m: Materiel): Promise<Materiel> => {
    if (estEnLigne() && !estIdentifiantLocal(manifesteId)) {
      return api.post<Materiel>(`/manifestes/${manifesteId}/materiels`, m).then(r => r.data);
    }

    brouillons.ajouterMateriel(manifesteId, m);
    await empiler({
      type: 'MATERIEL_AJOUTER',
      methode: 'POST',
      url: `/manifestes/${manifesteId}/materiels`,
      corps: m,
      libelle: `Matériel ${m.designation}`,
    });
    return m;
  },
};

/**
 * Purge les brouillons locaux dont toutes les opérations ont été transmises.
 *
 * Appelé par le bandeau de synchronisation après chaque rejeu.
 */
export async function purgerBrouillonsTransmis(): Promise<number> {
  const enAttente = new Set(
    (await listerFile())
      .map(o => o.id_local ?? o.url.match(/\/manifestes\/(local-[^/]+)/)?.[1])
      .filter((v): v is string => Boolean(v)),
  );
  return brouillons.purger(enAttente);
}

export const volApi = {
  list: (): Promise<Vol[]> =>
    api.get<Vol[]>('/vols').then(r => r.data),
};

export const referentielApi = {
  bases: () => api.get('/referentiel/bases').then(r => r.data),
  aeronefs: () => api.get('/referentiel/aeronefs').then(r => r.data),
  personnels: () => api.get('/referentiel/personnels').then(r => r.data),
};