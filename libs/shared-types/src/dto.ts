// DTOs partagés réutilisés dans plusieurs services
export interface CreatePassagerDto {
  nom:                  string;
  prenom:               string;
  grade?:               string;
  categorie:            string;
  matricule?:           string;
  unite?:               string;
  destination:          string;
  nb_bagages:           number;
  masse_bagages_kg:     number;
  couleur_bagages?:     string;
  contact_urgence_nom:  string;
  contact_urgence_tel:  string;
  ref_autorisation?:    string;
}

export interface CreateMaterielDto {
  designation:          string;
  type_mission_log:     string;
  proprietaire:         string;
  poids_kg:             number;
  volume?:              number;
  destination:          string;
  expediteur_nom:       string;
  expediteur_fonction:  string;
  expediteur_tel:       string;
}
