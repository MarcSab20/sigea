// apps/frontend/src/services/referentiel.service.ts
// Récupère les vraies données depuis le referentiel-service

import { api } from '@/lib/api';

export interface BaseDB {
  id: string;
  code_base: string;
  nom: string;
  region: string;
}

export interface AeronefDB {
  id: string;
  immatriculation: string;
  type: string;
  capacite_places: number;
  capacite_cargo_kg: number | string;
  actif: boolean;
}

export const referentielService = {
  bases: (): Promise<BaseDB[]> =>
    api.get<BaseDB[]>('/referentiel/bases').then(r => r.data),

  aeronefs: (): Promise<AeronefDB[]> =>
    api.get<AeronefDB[]>('/referentiel/aeronefs').then(r => r.data),
};

// Données statiques FAC en fallback si le service est indisponible
export const BASES_FAC_STATIC = [
  { code_base: 'BA101', nom: 'Base Aérienne 101 — Yaoundé',    region: 'Centre' },
  { code_base: 'BA102', nom: 'Base Aérienne 102 — Douala',     region: 'Littoral' },
  { code_base: 'BA201', nom: 'Base Aérienne 201 — Garoua',     region: 'Nord' },
  { code_base: 'BA301', nom: 'Base Aérienne 301 — Maroua',     region: 'Extrême-Nord' },
  { code_base: 'BA302', nom: 'Base Aérienne 302 — Ngaoundéré', region: 'Adamaoua' },
  { code_base: 'BA401', nom: 'Base Aérienne 401 — Bafoussam',  region: 'Ouest' },
  { code_base: 'BA501', nom: 'Base Aérienne 501 — Bertoua',    region: 'Est' },
];

export const AERONEFS_FAC_STATIC = [
  { immatriculation: 'TJ-AAF', type: 'C-130 Hercule', capacite_places: 92,  capacite_cargo_kg: 19000 },
  { immatriculation: 'TJ-ABB', type: 'Agusta',        capacite_places: 12,  capacite_cargo_kg: 1500  },
  { immatriculation: 'TJ-ACC', type: 'CESSNA 2B',     capacite_places: 8,   capacite_cargo_kg: 800   },
  { immatriculation: 'TJ-AZZ', type: 'Z9',            capacite_places: 10,  capacite_cargo_kg: 1200  },
  { immatriculation: 'TJ-AMI', type: 'MI-17',         capacite_places: 24,  capacite_cargo_kg: 4000  },
];