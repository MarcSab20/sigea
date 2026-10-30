-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('combase', 'comea', 'scops', 'comrmia', 'adj_air', 'sec_adj_air', 'comsecbase', 'comgmo', 'combord', 'cemaa', 'mage', 'admin');

-- CreateEnum
CREATE TYPE "Rmia" AS ENUM ('RMIA_1', 'RMIA_2', 'RMIA_3', 'RMIA_4', 'RMIA_5');

-- CreateEnum
CREATE TYPE "StatutVol" AS ENUM ('PLANIFIE', 'DIFFUSE', 'EN_COURS', 'CLOTURE', 'ANNULE');

-- CreateEnum
CREATE TYPE "EtapeListe" AS ENUM ('SEC_ADJ_AIR', 'ADJ_AIR', 'COMRMIA', 'COMBASE', 'COMBORD');

-- CreateEnum
CREATE TYPE "StatutListe" AS ENUM ('OUVERTE', 'EN_VALIDATION', 'ARRETEE', 'CLOTUREE', 'REJETEE');

-- CreateEnum
CREATE TYPE "NatureLigne" AS ENUM ('HIERARCHISEE', 'ATTENTE', 'RETIREE');

-- CreateEnum
CREATE TYPE "Priorite" AS ENUM ('P1', 'P2', 'P3', 'P4', 'P5', 'P6');

-- CreateEnum
CREATE TYPE "StatutPotentialite" AS ENUM ('DISPONIBLE', 'RETENUE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "MentionVisa" AS ENUM ('VU', 'SIGNATURE', 'ACCORD', 'VISA');

-- CreateEnum
CREATE TYPE "StatutManifeste" AS ENUM ('EMIS', 'DEFINITIF', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutMessage" AS ENUM ('EN_ATTENTE', 'ENVOYE', 'ECHEC');

-- CreateEnum
CREATE TYPE "OrigineEnregistrement" AS ENUM ('SAISIE', 'CEMAA', 'MAGE');

-- CreateEnum
CREATE TYPE "AutoriteCentrale" AS ENUM ('CEMAA', 'MAGE');

-- CreateEnum
CREATE TYPE "CategoriePassager" AS ENUM ('TROUPES', 'TROUPES_PARA', 'CHEF_MIL', 'MISSION', 'PERMISSION', 'EVASAN', 'VIP', 'CIVIL', 'OP_SENSIBLE');

-- CreateEnum
CREATE TYPE "TypeMission" AS ENUM ('PROJECTION', 'PARA', 'LIAISON', 'LOGISTIQUE', 'EVASAN', 'VIP', 'OP_SENSIBLE');

-- CreateEnum
CREATE TYPE "TypeConsigne" AS ENUM ('PERSONNEL', 'MATERIEL');

-- CreateEnum
CREATE TYPE "TypeMissionLogistique" AS ENUM ('AA', 'IA', 'INTERMINISTERIEL', 'INDIVIDUEL', 'SENSIBLE_CEMAA');

-- CreateEnum
CREATE TYPE "FonctionEquipage" AS ENUM ('COMBORD', 'COPILOTE', 'MECANICIEN', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('MUTATION', 'DEPART', 'SUSPENSION', 'REINTEGRATION');

-- CreateEnum
CREATE TYPE "StatutConsigne" AS ENUM ('EMISE', 'REALISEE', 'NON_REALISEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutArchive" AS ENUM ('DISPONIBLE', 'ABSENT', 'CORROMPU');

-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('VOL_DIFFUSE', 'LISTE_A_TRAITER', 'LISTE_VISEE', 'LISTE_REJETEE', 'LISTE_ARRETEE', 'MANIFESTE_DEFINITIF', 'CONSIGNE_AUTORITE', 'ALERTE');

-- CreateTable
CREATE TABLE "Base" (
    "id" TEXT NOT NULL,
    "code_base" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "rmia" "Rmia" NOT NULL,
    "admin_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escadron" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT,
    "base_id" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escadron_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aeronef" (
    "id" TEXT NOT NULL,
    "immatriculation" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacite_places" INTEGER NOT NULL,
    "capacite_cargo_kg" DECIMAL(10,2) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aeronef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "Unite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL,
    "base_id" TEXT NOT NULL,
    "rmia" "Rmia",
    "escadron_id" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "telephone" TEXT,
    "mfa_enrolled" BOOLEAN NOT NULL DEFAULT false,
    "verrouille_securite" BOOLEAN NOT NULL DEFAULT false,
    "motif_verrouillage" TEXT,
    "nb_echecs_connexion" INTEGER NOT NULL DEFAULT 0,
    "last_login" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "last_login_at" TIMESTAMP(3),
    "notif_connexion" BOOLEAN NOT NULL DEFAULT true,
    "notif_par_email" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_secrets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "refresh_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vol" (
    "id" TEXT NOT NULL,
    "numero_mission" TEXT NOT NULL,
    "immatriculation" TEXT NOT NULL,
    "date_heure" TIMESTAMP(3) NOT NULL,
    "base_depart_id" TEXT NOT NULL,
    "base_arrivee_id" TEXT NOT NULL,
    "type_mission" "TypeMission" NOT NULL,
    "flag_sensible" BOOLEAN NOT NULL DEFAULT false,
    "capacite_places" INTEGER NOT NULL,
    "capacite_cargo_kg" DECIMAL(10,2) NOT NULL,
    "combord_id" TEXT NOT NULL,
    "combord_grade" TEXT NOT NULL,
    "combord_nom" TEXT NOT NULL,
    "combord_prenom" TEXT NOT NULL,
    "cree_par" TEXT NOT NULL,
    "escadron_id" TEXT,
    "statut" "StatutVol" NOT NULL DEFAULT 'PLANIFIE',
    "diffuse_par" TEXT,
    "diffuse_le" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etape_itineraire" (
    "id" TEXT NOT NULL,
    "vol_id" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "base_id" TEXT NOT NULL,
    "rmia" "Rmia" NOT NULL,
    "quota_places" INTEGER,
    "quota_masse_kg" DECIMAL(10,2),
    "quota_alloue_par" TEXT,
    "quota_alloue_le" TIMESTAMP(3),
    "heure_arrivee" TIMESTAMP(3),
    "heure_depart" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etape_itineraire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Potentialite" (
    "id" TEXT NOT NULL,
    "rmia" "Rmia" NOT NULL,
    "base_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "grade" TEXT,
    "matricule" TEXT,
    "cni" TEXT,
    "unite" TEXT,
    "telephone" TEXT NOT NULL,
    "categorie" "CategoriePassager" NOT NULL,
    "priorite_proposee" "Priorite" NOT NULL DEFAULT 'P4',
    "destination_souhaitee" TEXT,
    "motif" TEXT,
    "ref_autorisation" TEXT,
    "nb_bagages" INTEGER NOT NULL DEFAULT 0,
    "masse_bagages_kg" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "contact_urgence_nom" TEXT,
    "contact_urgence_tel" TEXT,
    "contact_urgence_qual" TEXT,
    "statut" "StatutPotentialite" NOT NULL DEFAULT 'DISPONIBLE',
    "enregistre_par" TEXT NOT NULL,
    "valable_jusqu_au" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Potentialite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeEmbarquement" (
    "id" TEXT NOT NULL,
    "vol_id" TEXT NOT NULL,
    "etape_id" TEXT NOT NULL,
    "rmia" "Rmia" NOT NULL,
    "statut" "StatutListe" NOT NULL DEFAULT 'OUVERTE',
    "etape_courante" "EtapeListe" DEFAULT 'SEC_ADJ_AIR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "quota_places" INTEGER NOT NULL,
    "quota_masse_kg" DECIMAL(10,2) NOT NULL,
    "motif_rejet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeEmbarquement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneListe" (
    "id" TEXT NOT NULL,
    "liste_id" TEXT NOT NULL,
    "potentialite_id" TEXT,
    "nature" "NatureLigne" NOT NULL DEFAULT 'HIERARCHISEE',
    "priorite" "Priorite" NOT NULL DEFAULT 'P4',
    "rang" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "grade" TEXT,
    "matricule" TEXT,
    "cni" TEXT,
    "unite" TEXT,
    "telephone" TEXT NOT NULL,
    "categorie" "CategoriePassager" NOT NULL,
    "embarquement_ordre" INTEGER NOT NULL,
    "debarquement_ordre" INTEGER NOT NULL,
    "destination" TEXT NOT NULL,
    "nb_bagages" INTEGER NOT NULL DEFAULT 0,
    "masse_bagages_kg" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "couleur_bagages" TEXT,
    "contact_urgence_nom" TEXT,
    "contact_urgence_tel" TEXT,
    "contact_urgence_qual" TEXT,
    "ref_autorisation" TEXT,
    "origine" "OrigineEnregistrement" NOT NULL DEFAULT 'SAISIE',
    "saisie_par" TEXT NOT NULL,
    "discrimine_par" TEXT,
    "discrimine_etape" "EtapeListe",
    "motif_decision" TEXT,
    "verrouille" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigneListe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FretListe" (
    "id" TEXT NOT NULL,
    "liste_id" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "type_mission_log" "TypeMissionLogistique" NOT NULL,
    "proprietaire" TEXT NOT NULL,
    "poids_kg" DECIMAL(10,2) NOT NULL,
    "volume" DECIMAL(10,3),
    "embarquement_ordre" INTEGER NOT NULL,
    "debarquement_ordre" INTEGER NOT NULL,
    "destination" TEXT NOT NULL,
    "expediteur_nom" TEXT NOT NULL,
    "expediteur_fonction" TEXT NOT NULL,
    "expediteur_tel" TEXT NOT NULL,
    "classe_iata" TEXT,
    "conditionnement" TEXT,
    "retire" BOOLEAN NOT NULL DEFAULT false,
    "discrimine_par" TEXT,
    "motif_decision" TEXT,
    "origine" "OrigineEnregistrement" NOT NULL DEFAULT 'SAISIE',
    "saisie_par" TEXT NOT NULL,
    "verrouille" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FretListe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaListe" (
    "id" TEXT NOT NULL,
    "liste_id" TEXT NOT NULL,
    "etape" "EtapeListe" NOT NULL,
    "mention" "MentionVisa" NOT NULL,
    "signataire_id" TEXT,
    "signataire_nom" TEXT NOT NULL,
    "signataire_prenom" TEXT NOT NULL,
    "signataire_grade" TEXT NOT NULL,
    "signataire_titre" TEXT NOT NULL,
    "delegataire_id" TEXT,
    "delegataire_nom" TEXT,
    "delegataire_grade" TEXT,
    "note_delegation" TEXT,
    "par_interim" BOOLEAN NOT NULL DEFAULT false,
    "interim_id" TEXT,
    "titulaire_nom" TEXT,
    "titulaire_grade" TEXT,
    "hash_contenu" TEXT NOT NULL,
    "version_contenu" INTEGER NOT NULL,
    "commentaire" TEXT,
    "date_heure" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisaListe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeSnapshot" (
    "id" TEXT NOT NULL,
    "liste_id" TEXT NOT NULL,
    "etape" TEXT NOT NULL,
    "version_contenu" INTEGER NOT NULL,
    "version_format" INTEGER NOT NULL DEFAULT 1,
    "hash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "signataire_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageVoyageur" (
    "id" TEXT NOT NULL,
    "liste_id" TEXT NOT NULL,
    "ligne_id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "contenu" VARCHAR(640) NOT NULL,
    "statut" "StatutMessage" NOT NULL DEFAULT 'EN_ATTENTE',
    "operateur_ref" TEXT,
    "nb_tentatives" INTEGER NOT NULL DEFAULT 0,
    "derniere_erreur" TEXT,
    "envoye_le" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageVoyageur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manifeste" (
    "id" TEXT NOT NULL,
    "vol_id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "liste_id" TEXT NOT NULL,
    "etape_id" TEXT NOT NULL,
    "numero_manifeste" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "statut" "StatutManifeste" NOT NULL DEFAULT 'EMIS',
    "flag_sensible" BOOLEAN NOT NULL DEFAULT false,
    "emis_par" TEXT NOT NULL,
    "emis_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "definitif_le" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manifeste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passager" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "ligne_liste_id" TEXT NOT NULL,
    "priorite" "Priorite" NOT NULL,
    "rang" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "grade" TEXT,
    "categorie" "CategoriePassager" NOT NULL,
    "matricule" TEXT,
    "cni" TEXT,
    "unite" TEXT,
    "telephone" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "debarquement_ordre" INTEGER NOT NULL,
    "nb_bagages" INTEGER NOT NULL,
    "masse_bagages_kg" DECIMAL(7,2) NOT NULL,
    "couleur_bagages" TEXT,
    "contact_urgence_nom" TEXT,
    "contact_urgence_tel" TEXT,
    "contact_urgence_qual" TEXT,
    "ref_autorisation" TEXT,
    "origine" "OrigineEnregistrement" NOT NULL DEFAULT 'SAISIE',
    "retire" BOOLEAN NOT NULL DEFAULT false,
    "motif_retrait" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Materiel" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "fret_liste_id" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "type_mission_log" "TypeMissionLogistique" NOT NULL,
    "proprietaire" TEXT NOT NULL,
    "poids_kg" DECIMAL(10,2) NOT NULL,
    "volume" DECIMAL(10,3),
    "destination" TEXT NOT NULL,
    "debarquement_ordre" INTEGER NOT NULL,
    "expediteur_nom" TEXT NOT NULL,
    "expediteur_fonction" TEXT NOT NULL,
    "expediteur_tel" TEXT NOT NULL,
    "classe_iata" TEXT,
    "conditionnement" TEXT,
    "origine" "OrigineEnregistrement" NOT NULL DEFAULT 'SAISIE',
    "retire" BOOLEAN NOT NULL DEFAULT false,
    "motif_retrait" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Materiel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipage" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "fonction" "FonctionEquipage" NOT NULL,

    CONSTRAINT "Equipage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManifesteSnapshot" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "etape" TEXT NOT NULL,
    "version_contenu" INTEGER NOT NULL,
    "version_format" INTEGER NOT NULL DEFAULT 1,
    "hash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "signataire_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManifesteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsigneAutorite" (
    "id" TEXT NOT NULL,
    "vol_id" TEXT NOT NULL,
    "etape_id" TEXT,
    "type" "TypeConsigne" NOT NULL,
    "autorite" "AutoriteCentrale" NOT NULL DEFAULT 'CEMAA',
    "contenu_chiffre" TEXT NOT NULL,
    "places_bloquees" INTEGER NOT NULL DEFAULT 0,
    "masse_bloquee_kg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "emise_par" TEXT NOT NULL,
    "statut_realisation" "StatutConsigne" NOT NULL DEFAULT 'EMISE',
    "confirme_par" TEXT,
    "confirme_le" TIMESTAMP(3),
    "observation_realisation" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsigneAutorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interim" (
    "id" TEXT NOT NULL,
    "titulaire_id" TEXT NOT NULL,
    "suppleant_id" TEXT NOT NULL,
    "role_delegue" "RoleUtilisateur" NOT NULL,
    "base_id" TEXT NOT NULL,
    "rmia" "Rmia",
    "escadron_id" TEXT,
    "motif" TEXT,
    "date_debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_fin" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_par" TEXT NOT NULL,
    "revoque_par" TEXT,
    "revoque_le" TIMESTAMP(3),
    "motif_revocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementPersonnel" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "type" "TypeMouvement" NOT NULL,
    "base_avant" TEXT,
    "base_apres" TEXT,
    "role_avant" "RoleUtilisateur",
    "role_apres" "RoleUtilisateur",
    "escadron_avant" TEXT,
    "escadron_apres" TEXT,
    "rmia_avant" "Rmia",
    "rmia_apres" "Rmia",
    "successeur_id" TEXT,
    "date_effet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motif" TEXT,
    "reference" TEXT,
    "decide_par" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementPersonnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RechercheNominative" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "type_critere" TEXT NOT NULL,
    "critere" TEXT NOT NULL,
    "nb_resultats" INTEGER NOT NULL DEFAULT 0,
    "motif" TEXT,
    "ip" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RechercheNominative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "method" TEXT,
    "path" TEXT,
    "ip" TEXT,
    "content_hash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "known_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "derniere_vue" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "known_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "niveau" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "ip" TEXT,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_reset_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "motif" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "traite_par" TEXT,
    "traite_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_reset_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "destinataire_id" TEXT,
    "rmia" "Rmia",
    "type" "TypeNotification" NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "manifeste_id" TEXT,
    "vol_id" TEXT,
    "liste_id" TEXT,
    "etape" TEXT,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "lu_le" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveManifeste" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "vol_id" TEXT NOT NULL,
    "numero_mission" TEXT NOT NULL,
    "chemin" TEXT NOT NULL,
    "taille_octets" INTEGER NOT NULL,
    "sha256_pdf" TEXT NOT NULL,
    "hash_contenu" TEXT NOT NULL,
    "version_contenu" INTEGER NOT NULL,
    "statut" "StatutArchive" NOT NULL DEFAULT 'DISPONIBLE',
    "date_cloture" TIMESTAMP(3) NOT NULL,
    "genere_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nb_telechargements" INTEGER NOT NULL DEFAULT 0,
    "dernier_telechargement" TIMESTAMP(3),
    "derniere_verification" TIMESTAMP(3),

    CONSTRAINT "ArchiveManifeste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumeroControle" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "code_chiffre" TEXT NOT NULL,
    "suffixe" TEXT NOT NULL,
    "genere_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nb_verifications" INTEGER NOT NULL DEFAULT 0,
    "derniere_verification" TIMESTAMP(3),

    CONSTRAINT "NumeroControle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Base_code_base_key" ON "Base"("code_base");

-- CreateIndex
CREATE INDEX "Base_rmia_idx" ON "Base"("rmia");

-- CreateIndex
CREATE INDEX "Escadron_base_id_actif_idx" ON "Escadron"("base_id", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "Escadron_base_id_code_key" ON "Escadron"("base_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Aeronef_immatriculation_key" ON "Aeronef"("immatriculation");

-- CreateIndex
CREATE UNIQUE INDEX "Unite_code_key" ON "Unite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_login_key" ON "Utilisateur"("login");

-- CreateIndex
CREATE INDEX "Utilisateur_base_id_role_idx" ON "Utilisateur"("base_id", "role");

-- CreateIndex
CREATE INDEX "Utilisateur_rmia_role_idx" ON "Utilisateur"("rmia", "role");

-- CreateIndex
CREATE INDEX "Utilisateur_escadron_id_idx" ON "Utilisateur"("escadron_id");

-- CreateIndex
CREATE UNIQUE INDEX "otp_secrets_user_id_key" ON "otp_secrets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_tokens_user_id_key" ON "challenge_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_tokens_token_key" ON "challenge_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Vol_numero_mission_key" ON "Vol"("numero_mission");

-- CreateIndex
CREATE INDEX "Vol_statut_date_heure_idx" ON "Vol"("statut", "date_heure");

-- CreateIndex
CREATE INDEX "Vol_base_depart_id_date_heure_idx" ON "Vol"("base_depart_id", "date_heure");

-- CreateIndex
CREATE INDEX "Vol_cree_par_idx" ON "Vol"("cree_par");

-- CreateIndex
CREATE INDEX "Vol_combord_id_statut_idx" ON "Vol"("combord_id", "statut");

-- CreateIndex
CREATE INDEX "etape_itineraire_base_id_idx" ON "etape_itineraire"("base_id");

-- CreateIndex
CREATE INDEX "etape_itineraire_rmia_vol_id_idx" ON "etape_itineraire"("rmia", "vol_id");

-- CreateIndex
CREATE UNIQUE INDEX "etape_itineraire_vol_id_ordre_key" ON "etape_itineraire"("vol_id", "ordre");

-- CreateIndex
CREATE INDEX "Potentialite_rmia_statut_idx" ON "Potentialite"("rmia", "statut");

-- CreateIndex
CREATE INDEX "Potentialite_base_id_statut_idx" ON "Potentialite"("base_id", "statut");

-- CreateIndex
CREATE INDEX "Potentialite_nom_prenom_idx" ON "Potentialite"("nom", "prenom");

-- CreateIndex
CREATE INDEX "Potentialite_matricule_idx" ON "Potentialite"("matricule");

-- CreateIndex
CREATE INDEX "Potentialite_cni_idx" ON "Potentialite"("cni");

-- CreateIndex
CREATE INDEX "ListeEmbarquement_rmia_statut_idx" ON "ListeEmbarquement"("rmia", "statut");

-- CreateIndex
CREATE INDEX "ListeEmbarquement_etape_courante_idx" ON "ListeEmbarquement"("etape_courante");

-- CreateIndex
CREATE UNIQUE INDEX "ListeEmbarquement_vol_id_etape_id_key" ON "ListeEmbarquement"("vol_id", "etape_id");

-- CreateIndex
CREATE INDEX "LigneListe_liste_id_nature_priorite_rang_idx" ON "LigneListe"("liste_id", "nature", "priorite", "rang");

-- CreateIndex
CREATE INDEX "LigneListe_liste_id_embarquement_ordre_debarquement_ordre_idx" ON "LigneListe"("liste_id", "embarquement_ordre", "debarquement_ordre");

-- CreateIndex
CREATE INDEX "LigneListe_potentialite_id_idx" ON "LigneListe"("potentialite_id");

-- CreateIndex
CREATE UNIQUE INDEX "LigneListe_liste_id_nature_priorite_rang_key" ON "LigneListe"("liste_id", "nature", "priorite", "rang");

-- CreateIndex
CREATE INDEX "FretListe_liste_id_retire_idx" ON "FretListe"("liste_id", "retire");

-- CreateIndex
CREATE INDEX "FretListe_liste_id_embarquement_ordre_debarquement_ordre_idx" ON "FretListe"("liste_id", "embarquement_ordre", "debarquement_ordre");

-- CreateIndex
CREATE INDEX "VisaListe_liste_id_date_heure_idx" ON "VisaListe"("liste_id", "date_heure");

-- CreateIndex
CREATE INDEX "VisaListe_signataire_id_idx" ON "VisaListe"("signataire_id");

-- CreateIndex
CREATE UNIQUE INDEX "VisaListe_liste_id_etape_key" ON "VisaListe"("liste_id", "etape");

-- CreateIndex
CREATE INDEX "ListeSnapshot_liste_id_createdAt_idx" ON "ListeSnapshot"("liste_id", "createdAt");

-- CreateIndex
CREATE INDEX "ListeSnapshot_hash_idx" ON "ListeSnapshot"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "ListeSnapshot_liste_id_etape_key" ON "ListeSnapshot"("liste_id", "etape");

-- CreateIndex
CREATE INDEX "MessageVoyageur_statut_createdAt_idx" ON "MessageVoyageur"("statut", "createdAt");

-- CreateIndex
CREATE INDEX "MessageVoyageur_liste_id_idx" ON "MessageVoyageur"("liste_id");

-- CreateIndex
CREATE INDEX "MessageVoyageur_ligne_id_idx" ON "MessageVoyageur"("ligne_id");

-- CreateIndex
CREATE UNIQUE INDEX "Manifeste_liste_id_key" ON "Manifeste"("liste_id");

-- CreateIndex
CREATE UNIQUE INDEX "Manifeste_numero_manifeste_key" ON "Manifeste"("numero_manifeste");

-- CreateIndex
CREATE INDEX "Manifeste_base_id_statut_idx" ON "Manifeste"("base_id", "statut");

-- CreateIndex
CREATE INDEX "Manifeste_vol_id_idx" ON "Manifeste"("vol_id");

-- CreateIndex
CREATE INDEX "Passager_manifeste_id_retire_idx" ON "Passager"("manifeste_id", "retire");

-- CreateIndex
CREATE INDEX "Passager_ligne_liste_id_idx" ON "Passager"("ligne_liste_id");

-- CreateIndex
CREATE INDEX "Passager_cni_idx" ON "Passager"("cni");

-- CreateIndex
CREATE INDEX "Passager_matricule_idx" ON "Passager"("matricule");

-- CreateIndex
CREATE INDEX "Materiel_manifeste_id_retire_idx" ON "Materiel"("manifeste_id", "retire");

-- CreateIndex
CREATE INDEX "Materiel_fret_liste_id_idx" ON "Materiel"("fret_liste_id");

-- CreateIndex
CREATE INDEX "ManifesteSnapshot_manifeste_id_createdAt_idx" ON "ManifesteSnapshot"("manifeste_id", "createdAt");

-- CreateIndex
CREATE INDEX "ManifesteSnapshot_hash_idx" ON "ManifesteSnapshot"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "ManifesteSnapshot_manifeste_id_etape_key" ON "ManifesteSnapshot"("manifeste_id", "etape");

-- CreateIndex
CREATE INDEX "ConsigneAutorite_vol_id_statut_realisation_idx" ON "ConsigneAutorite"("vol_id", "statut_realisation");

-- CreateIndex
CREATE INDEX "ConsigneAutorite_vol_id_etape_id_idx" ON "ConsigneAutorite"("vol_id", "etape_id");

-- CreateIndex
CREATE INDEX "ConsigneAutorite_autorite_vol_id_idx" ON "ConsigneAutorite"("autorite", "vol_id");

-- CreateIndex
CREATE INDEX "Interim_suppleant_id_actif_idx" ON "Interim"("suppleant_id", "actif");

-- CreateIndex
CREATE INDEX "Interim_titulaire_id_actif_idx" ON "Interim"("titulaire_id", "actif");

-- CreateIndex
CREATE INDEX "Interim_base_id_actif_idx" ON "Interim"("base_id", "actif");

-- CreateIndex
CREATE INDEX "Interim_rmia_actif_idx" ON "Interim"("rmia", "actif");

-- CreateIndex
CREATE INDEX "MouvementPersonnel_utilisateur_id_date_effet_idx" ON "MouvementPersonnel"("utilisateur_id", "date_effet");

-- CreateIndex
CREATE INDEX "MouvementPersonnel_type_date_effet_idx" ON "MouvementPersonnel"("type", "date_effet");

-- CreateIndex
CREATE INDEX "RechercheNominative_user_id_timestamp_idx" ON "RechercheNominative"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "RechercheNominative_timestamp_idx" ON "RechercheNominative"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_timestamp_idx" ON "AuditLog"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "backup_codes_user_id_used_idx" ON "backup_codes"("user_id", "used");

-- CreateIndex
CREATE UNIQUE INDEX "known_devices_user_id_fingerprint_key" ON "known_devices"("user_id", "fingerprint");

-- CreateIndex
CREATE INDEX "security_notifications_user_id_lu_idx" ON "security_notifications"("user_id", "lu");

-- CreateIndex
CREATE INDEX "security_notifications_niveau_idx" ON "security_notifications"("niveau");

-- CreateIndex
CREATE INDEX "mfa_reset_requests_statut_idx" ON "mfa_reset_requests"("statut");

-- CreateIndex
CREATE INDEX "Notification_base_id_createdAt_idx" ON "Notification"("base_id", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_rmia_createdAt_idx" ON "Notification"("rmia", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_destinataire_id_lu_idx" ON "Notification"("destinataire_id", "lu");

-- CreateIndex
CREATE INDEX "Notification_liste_id_idx" ON "Notification"("liste_id");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveManifeste_manifeste_id_key" ON "ArchiveManifeste"("manifeste_id");

-- CreateIndex
CREATE INDEX "ArchiveManifeste_base_id_date_cloture_idx" ON "ArchiveManifeste"("base_id", "date_cloture");

-- CreateIndex
CREATE INDEX "ArchiveManifeste_vol_id_idx" ON "ArchiveManifeste"("vol_id");

-- CreateIndex
CREATE INDEX "ArchiveManifeste_statut_idx" ON "ArchiveManifeste"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "NumeroControle_manifeste_id_key" ON "NumeroControle"("manifeste_id");

-- CreateIndex
CREATE UNIQUE INDEX "NumeroControle_code_hash_key" ON "NumeroControle"("code_hash");

-- AddForeignKey
ALTER TABLE "Base" ADD CONSTRAINT "Base_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escadron" ADD CONSTRAINT "Escadron_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_escadron_id_fkey" FOREIGN KEY ("escadron_id") REFERENCES "Escadron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_secrets" ADD CONSTRAINT "otp_secrets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_tokens" ADD CONSTRAINT "challenge_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vol" ADD CONSTRAINT "Vol_immatriculation_fkey" FOREIGN KEY ("immatriculation") REFERENCES "Aeronef"("immatriculation") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vol" ADD CONSTRAINT "Vol_base_depart_id_fkey" FOREIGN KEY ("base_depart_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vol" ADD CONSTRAINT "Vol_base_arrivee_id_fkey" FOREIGN KEY ("base_arrivee_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vol" ADD CONSTRAINT "Vol_combord_id_fkey" FOREIGN KEY ("combord_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vol" ADD CONSTRAINT "Vol_escadron_id_fkey" FOREIGN KEY ("escadron_id") REFERENCES "Escadron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etape_itineraire" ADD CONSTRAINT "etape_itineraire_vol_id_fkey" FOREIGN KEY ("vol_id") REFERENCES "Vol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etape_itineraire" ADD CONSTRAINT "etape_itineraire_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Potentialite" ADD CONSTRAINT "Potentialite_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeEmbarquement" ADD CONSTRAINT "ListeEmbarquement_vol_id_fkey" FOREIGN KEY ("vol_id") REFERENCES "Vol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeEmbarquement" ADD CONSTRAINT "ListeEmbarquement_etape_id_fkey" FOREIGN KEY ("etape_id") REFERENCES "etape_itineraire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneListe" ADD CONSTRAINT "LigneListe_liste_id_fkey" FOREIGN KEY ("liste_id") REFERENCES "ListeEmbarquement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneListe" ADD CONSTRAINT "LigneListe_potentialite_id_fkey" FOREIGN KEY ("potentialite_id") REFERENCES "Potentialite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FretListe" ADD CONSTRAINT "FretListe_liste_id_fkey" FOREIGN KEY ("liste_id") REFERENCES "ListeEmbarquement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaListe" ADD CONSTRAINT "VisaListe_liste_id_fkey" FOREIGN KEY ("liste_id") REFERENCES "ListeEmbarquement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaListe" ADD CONSTRAINT "VisaListe_signataire_id_fkey" FOREIGN KEY ("signataire_id") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaListe" ADD CONSTRAINT "VisaListe_delegataire_id_fkey" FOREIGN KEY ("delegataire_id") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaListe" ADD CONSTRAINT "VisaListe_interim_id_fkey" FOREIGN KEY ("interim_id") REFERENCES "Interim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeSnapshot" ADD CONSTRAINT "ListeSnapshot_liste_id_fkey" FOREIGN KEY ("liste_id") REFERENCES "ListeEmbarquement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageVoyageur" ADD CONSTRAINT "MessageVoyageur_liste_id_fkey" FOREIGN KEY ("liste_id") REFERENCES "ListeEmbarquement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manifeste" ADD CONSTRAINT "Manifeste_vol_id_fkey" FOREIGN KEY ("vol_id") REFERENCES "Vol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manifeste" ADD CONSTRAINT "Manifeste_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manifeste" ADD CONSTRAINT "Manifeste_liste_id_fkey" FOREIGN KEY ("liste_id") REFERENCES "ListeEmbarquement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manifeste" ADD CONSTRAINT "Manifeste_etape_id_fkey" FOREIGN KEY ("etape_id") REFERENCES "etape_itineraire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passager" ADD CONSTRAINT "Passager_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Materiel" ADD CONSTRAINT "Materiel_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipage" ADD CONSTRAINT "Equipage_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifesteSnapshot" ADD CONSTRAINT "ManifesteSnapshot_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsigneAutorite" ADD CONSTRAINT "ConsigneAutorite_vol_id_fkey" FOREIGN KEY ("vol_id") REFERENCES "Vol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interim" ADD CONSTRAINT "Interim_titulaire_id_fkey" FOREIGN KEY ("titulaire_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interim" ADD CONSTRAINT "Interim_suppleant_id_fkey" FOREIGN KEY ("suppleant_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementPersonnel" ADD CONSTRAINT "MouvementPersonnel_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementPersonnel" ADD CONSTRAINT "MouvementPersonnel_successeur_id_fkey" FOREIGN KEY ("successeur_id") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "known_devices" ADD CONSTRAINT "known_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_notifications" ADD CONSTRAINT "security_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_reset_requests" ADD CONSTRAINT "mfa_reset_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "Base"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_destinataire_id_fkey" FOREIGN KEY ("destinataire_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveManifeste" ADD CONSTRAINT "ArchiveManifeste_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumeroControle" ADD CONSTRAINT "NumeroControle_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- ============================================================================
-- SIGEA — Déclencheurs de protection
--
-- À APPENDRE à la fin de la migration initiale générée par Prisma.
--
-- Ces objets ne figurent pas dans schema.prisma : Prisma ne modélise ni les
-- fonctions, ni les déclencheurs. Ils vivaient jusqu'ici dans les migrations
-- historiques ; refaire une migration initiale à partir de zéro les aurait
-- purement et simplement perdus, sans aucun message d'erreur.
--
-- C'est le piège de l'opération : la base aurait paru correcte, les
-- applications auraient fonctionné, et l'on n'aurait découvert la disparition
-- qu'au premier UPDATE malveillant sur une empreinte — c'est-à-dire trop tard.
--
-- Trois d'entre eux sont repris à l'identique des anciennes migrations. Deux
-- sont NOUVEAUX, et couvrent des tables que le nouveau modèle introduit :
-- ListeSnapshot et VisaListe.
-- ============================================================================

-- ─── 1. Immuabilité des instantanés ─────────────────────────────────────────
--
-- Un instantané répond à la question « sur quoi cette signature a-t-elle
-- porté ». Un historique qu'un UPDATE peut réécrire n'a aucune valeur
-- probante. Un accès direct à la base — maintenance, correction manuelle en
-- urgence — ne doit pas pouvoir l'altérer sans que cela se voie.

CREATE OR REPLACE FUNCTION sigea_snapshot_immuable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        '%: instantané immuable, % interdit (etape=%)',
        TG_TABLE_NAME, TG_OP, OLD."etape";
END;
$$ LANGUAGE plpgsql;

-- Le DELETE direct est bloqué, mais la suppression EN CASCADE d'un manifeste
-- ou d'une liste doit rester possible. `pg_trigger_depth() = 0` distingue les
-- deux : une cascade s'exécute à une profondeur non nulle.
CREATE OR REPLACE FUNCTION sigea_snapshot_no_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() = 0 THEN
        RAISE EXCEPTION
            '%: instantané immuable, DELETE direct interdit (etape=%)',
            TG_TABLE_NAME, OLD."etape";
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ManifesteSnapshot_no_update" ON "ManifesteSnapshot";
CREATE TRIGGER "ManifesteSnapshot_no_update"
    BEFORE UPDATE ON "ManifesteSnapshot"
    FOR EACH ROW EXECUTE FUNCTION sigea_snapshot_immuable();

DROP TRIGGER IF EXISTS "ManifesteSnapshot_no_delete" ON "ManifesteSnapshot";
CREATE TRIGGER "ManifesteSnapshot_no_delete"
    BEFORE DELETE ON "ManifesteSnapshot"
    FOR EACH ROW EXECUTE FUNCTION sigea_snapshot_no_delete();

-- NOUVEAU : la même protection sur les instantanés de LISTE.
-- C'est désormais la liste qui circule et qui est signée quatre fois ; ses
-- instantanés sont donc au moins aussi probants que ceux du manifeste.
DROP TRIGGER IF EXISTS "ListeSnapshot_no_update" ON "ListeSnapshot";
CREATE TRIGGER "ListeSnapshot_no_update"
    BEFORE UPDATE ON "ListeSnapshot"
    FOR EACH ROW EXECUTE FUNCTION sigea_snapshot_immuable();

DROP TRIGGER IF EXISTS "ListeSnapshot_no_delete" ON "ListeSnapshot";
CREATE TRIGGER "ListeSnapshot_no_delete"
    BEFORE DELETE ON "ListeSnapshot"
    FOR EACH ROW EXECUTE FUNCTION sigea_snapshot_no_delete();

-- ─── 2. Immuabilité du contenu visé d'un visa ───────────────────────────────
--
-- NOUVEAU. Un visa peut être CRÉÉ, et SUPPRIMÉ lors d'un renvoi en arrière —
-- la machine à états purge les visas aval, c'est légitime. Mais l'empreinte du
-- contenu visé et l'identité du signataire ne doivent jamais être réécrites
-- sur un visa existant : ce serait exactement la falsification que l'empreinte
-- sert à rendre détectable.
--
-- Le commentaire reste modifiable : c'est une annotation, pas un élément probant.

CREATE OR REPLACE FUNCTION sigea_visa_immuable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."hash_contenu"     IS DISTINCT FROM OLD."hash_contenu"
  OR NEW."version_contenu"  IS DISTINCT FROM OLD."version_contenu"
  OR NEW."etape"            IS DISTINCT FROM OLD."etape"
  OR NEW."mention"          IS DISTINCT FROM OLD."mention"
  OR NEW."signataire_nom"   IS DISTINCT FROM OLD."signataire_nom"
  OR NEW."signataire_grade" IS DISTINCT FROM OLD."signataire_grade"
  OR NEW."signataire_titre" IS DISTINCT FROM OLD."signataire_titre"
  OR NEW."date_heure"       IS DISTINCT FROM OLD."date_heure" THEN
    RAISE EXCEPTION
      'VisaListe : un visa apposé ne se réécrit pas (liste=%, etape=%)',
      OLD."liste_id", OLD."etape"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_visa_immuable ON "VisaListe";
CREATE TRIGGER trg_visa_immuable
  BEFORE UPDATE ON "VisaListe"
  FOR EACH ROW EXECUTE FUNCTION sigea_visa_immuable();

-- ─── 3. Cohérence escadron ⇄ base ⇄ rôle ────────────────────────────────────
--
-- Repris de l'existant, ÉTENDU au cloisonnement régional.
--
-- La règle d'origine : seul un COMEA se rattache à un escadron, et cet escadron
-- doit relever de sa base. Les deux règles ajoutées sont de même nature :
-- un compte de la chaîne RMIA SANS RMIA ne voit rien, et un compte hors chaîne
-- AVEC une RMIA se verrait accorder un périmètre qui ne lui revient pas.
--
-- Au niveau base plutôt qu'applicatif parce qu'une reprise de données, un
-- import ou une correction manuelle contournent le service — et c'est
-- précisément dans ces moments-là que l'erreur se glisse.

CREATE OR REPLACE FUNCTION trg_utilisateur_coherence()
RETURNS TRIGGER AS $$
DECLARE
  base_escadron TEXT;
BEGIN
  -- Escadron
  IF NEW.escadron_id IS NOT NULL THEN
    IF NEW.role <> 'comea' THEN
      RAISE EXCEPTION
        'Rattachement à un escadron réservé au rôle COMEA (rôle fourni : %)', NEW.role
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT base_id INTO base_escadron FROM "Escadron" WHERE id = NEW.escadron_id;

    IF base_escadron IS NULL THEN
      RAISE EXCEPTION 'Escadron % introuvable', NEW.escadron_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF base_escadron <> NEW.base_id THEN
      RAISE EXCEPTION
        'Escadron % rattaché à la base %, incompatible avec la base % de l''utilisateur',
        NEW.escadron_id, base_escadron, NEW.base_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- RMIA : obligatoire pour la chaîne régionale, interdite ailleurs.
  IF NEW.role IN ('comrmia', 'adj_air', 'sec_adj_air') AND NEW.rmia IS NULL THEN
    RAISE EXCEPTION
      'Le rôle % exige une RMIA de rattachement : sans elle, le titulaire ne voit aucune liste',
      NEW.role
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.role NOT IN ('comrmia', 'adj_air', 'sec_adj_air') AND NEW.rmia IS NOT NULL THEN
    RAISE EXCEPTION
      'Le rôle % ne se rattache pas à une RMIA (valeur fournie : %)', NEW.role, NEW.rmia
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_utilisateur_escadron_base ON "Utilisateur";
DROP TRIGGER IF EXISTS trg_utilisateur_coherence ON "Utilisateur";
CREATE TRIGGER trg_utilisateur_coherence
  BEFORE INSERT OR UPDATE OF escadron_id, role, base_id, rmia ON "Utilisateur"
  FOR EACH ROW EXECUTE FUNCTION trg_utilisateur_coherence();

-- ─── 4. Cohérence région ⇄ RMIA d'une base ──────────────────────────────────
--
-- NOUVEAU. Une base mal rattachée ne produit aucune erreur visible : elle rend
-- simplement ses listes invisibles de la région censée les traiter. Le défaut
-- se découvrirait le jour d'un vol, pas à la saisie.
--
-- Le découpage est figé ici comme il l'est dans @sigea/shared-types. Il n'a pas
-- à être configurable : c'est une donnée d'organisation, pas un paramètre.

-- Suppression des diacritiques sans dépendre de l'extension `unaccent`, qui
-- n'est pas garantie présente. `translate` suffit pour les quelques caractères
-- accentués des noms de régions camerounaises.
CREATE OR REPLACE FUNCTION unaccent_immuable(txt TEXT)
RETURNS TEXT AS $$
  SELECT translate(
    txt,
    'àáâãäåèéêëìíîïòóôõöùúûüçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇ',
    'aaaaaaeeeeiiiiooooouuuucAAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION trg_base_rmia_coherente()
RETURNS TRIGGER AS $$
DECLARE
  r TEXT;
  attendue TEXT;
BEGIN
  -- Normalisation : minuscules, sans diacritiques, séparateurs unifiés.
  -- « Extrême-Nord », « EXTREME NORD » et « Extreme Nord » désignent la même
  -- région et arrivent effectivement sous ces trois formes.
  r := lower(regexp_replace(unaccent_immuable(NEW.region), '[[:space:]_-]+', '-', 'g'));

  attendue := CASE
    WHEN r IN ('centre', 'sud', 'est')        THEN 'RMIA_1'
    WHEN r IN ('littoral', 'sud-ouest')       THEN 'RMIA_2'
    WHEN r IN ('nord', 'adamaoua')            THEN 'RMIA_3'
    WHEN r = 'extreme-nord'                   THEN 'RMIA_4'
    WHEN r IN ('ouest', 'nord-ouest')         THEN 'RMIA_5'
    ELSE NULL
  END;

  IF attendue IS NULL THEN
    RAISE EXCEPTION
      'Base % : région « % » hors du découpage RMIA', NEW.code_base, NEW.region
      USING ERRCODE = 'check_violation';
  END IF;

  IF attendue <> NEW.rmia::text THEN
    RAISE EXCEPTION
      'Base % : la région « % » relève de %, pas de %',
      NEW.code_base, NEW.region, attendue, NEW.rmia
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_base_rmia_coherente ON "Base";
CREATE TRIGGER trg_base_rmia_coherente
  BEFORE INSERT OR UPDATE OF region, rmia ON "Base"
  FOR EACH ROW EXECUTE FUNCTION trg_base_rmia_coherente();

-- ─── 5. Immuabilité de l'archive ────────────────────────────────────────────
--
-- Repris à l'identique. Seuls les compteurs de téléchargement et les dates de
-- vérification bougent. Sans ce déclencheur, un UPDATE sur `sha256_pdf`
-- suffirait à faire passer un PDF substitué pour l'original.

CREATE OR REPLACE FUNCTION trg_archive_immuable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."manifeste_id"    IS DISTINCT FROM OLD."manifeste_id"
  OR NEW."chemin"          IS DISTINCT FROM OLD."chemin"
  OR NEW."sha256_pdf"      IS DISTINCT FROM OLD."sha256_pdf"
  OR NEW."hash_contenu"    IS DISTINCT FROM OLD."hash_contenu"
  OR NEW."version_contenu" IS DISTINCT FROM OLD."version_contenu"
  OR NEW."date_cloture"    IS DISTINCT FROM OLD."date_cloture"
  OR NEW."taille_octets"   IS DISTINCT FROM OLD."taille_octets" THEN
    RAISE EXCEPTION
      'ArchiveManifeste : champ probant non modifiable (archive %)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_archive_immuable ON "ArchiveManifeste";
CREATE TRIGGER trg_archive_immuable
  BEFORE UPDATE ON "ArchiveManifeste"
  FOR EACH ROW EXECUTE FUNCTION trg_archive_immuable();

-- ─── 6. Immuabilité du numéro de contrôle ───────────────────────────────────
--
-- Repris à l'identique. Seuls les deux compteurs de vérification peuvent
-- bouger. Réécrire le numéro, son empreinte ou son chiffré permettrait de
-- l'aligner après coup sur un document substitué, ce qui viderait le
-- dispositif de son sens.

CREATE OR REPLACE FUNCTION trg_numero_controle_immuable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."manifeste_id" IS DISTINCT FROM OLD."manifeste_id"
  OR NEW."code_hash"    IS DISTINCT FROM OLD."code_hash"
  OR NEW."code_chiffre" IS DISTINCT FROM OLD."code_chiffre"
  OR NEW."suffixe"      IS DISTINCT FROM OLD."suffixe"
  OR NEW."genere_le"    IS DISTINCT FROM OLD."genere_le" THEN
    RAISE EXCEPTION
      'NumeroControle : le numéro est figé à l''émission (manifeste %)', OLD."manifeste_id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_numero_controle_immuable ON "NumeroControle";
CREATE TRIGGER trg_numero_controle_immuable
  BEFORE UPDATE ON "NumeroControle"
  FOR EACH ROW EXECUTE FUNCTION trg_numero_controle_immuable();
