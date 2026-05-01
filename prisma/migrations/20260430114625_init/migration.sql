-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('chef_escale', 'comeso', 'comgmo', 'combord', 'combase', 'cemaa', 'admin');

-- CreateEnum
CREATE TYPE "StatutManifeste" AS ENUM ('BROUILLON', 'SOUMIS', 'EN_VALIDATION', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "EtapeValidation" AS ENUM ('COMESO', 'COMGMO', 'COMBORD', 'CEMAA_SENSIBLE', 'COMBASE');

-- CreateEnum
CREATE TYPE "StatutValidation" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE');

-- CreateEnum
CREATE TYPE "CategoriePassager" AS ENUM ('TROUPES', 'TROUPES_PARA', 'CHEF_MIL', 'MISSION', 'PERMISSION', 'EVASAN', 'VIP', 'CIVIL', 'OP_SENSIBLE');

-- CreateEnum
CREATE TYPE "TypeMission" AS ENUM ('PROJECTION', 'PARA', 'LIAISON', 'LOGISTIQUE', 'EVASAN', 'VIP', 'OP_SENSIBLE');

-- CreateEnum
CREATE TYPE "TypeConsigne" AS ENUM ('PERSONNEL', 'MATERIEL');

-- CreateEnum
CREATE TYPE "OrigineEnregistrement" AS ENUM ('SAISIE', 'CEMAA');

-- CreateEnum
CREATE TYPE "TypeMissionLogistique" AS ENUM ('AA', 'IA', 'INTERMINISTERIEL', 'INDIVIDUEL', 'SENSIBLE_CEMAA');

-- CreateEnum
CREATE TYPE "FonctionEquipage" AS ENUM ('COMBORD', 'COPILOTE', 'MECANICIEN', 'AUTRE');

-- CreateTable
CREATE TABLE "Base" (
    "id" TEXT NOT NULL,
    "code_base" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "admin_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "otp_secret" TEXT,
    "role" "RoleUtilisateur" NOT NULL,
    "base_id" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
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
    "statut" TEXT NOT NULL DEFAULT 'PLANIFIE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsigneCemaa" (
    "id" TEXT NOT NULL,
    "vol_id" TEXT NOT NULL,
    "escale_base_id" TEXT,
    "type" "TypeConsigne" NOT NULL,
    "contenu_chiffre" TEXT NOT NULL,
    "places_bloquees" INTEGER NOT NULL DEFAULT 0,
    "masse_bloquee_kg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valide_par_cemaa" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsigneCemaa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manifeste" (
    "id" TEXT NOT NULL,
    "vol_id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "manifeste_maitre_id" TEXT,
    "etape_vol" TEXT NOT NULL DEFAULT 'A',
    "version" INTEGER NOT NULL DEFAULT 1,
    "statut" "StatutManifeste" NOT NULL DEFAULT 'BROUILLON',
    "flag_sensible" BOOLEAN NOT NULL DEFAULT false,
    "cree_par" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manifeste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passager" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "grade" TEXT,
    "categorie" "CategoriePassager" NOT NULL,
    "matricule" TEXT,
    "unite" TEXT,
    "destination" TEXT NOT NULL,
    "nb_bagages" INTEGER NOT NULL,
    "masse_bagages_kg" DECIMAL(7,2) NOT NULL,
    "couleur_bagages" TEXT,
    "contact_urgence_nom" TEXT NOT NULL,
    "contact_urgence_tel" TEXT NOT NULL,
    "contact_urgence_qual" TEXT,
    "ref_autorisation" TEXT,
    "origine" "OrigineEnregistrement" NOT NULL DEFAULT 'SAISIE',
    "verrouille" BOOLEAN NOT NULL DEFAULT false,
    "sensible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Materiel" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "type_mission_log" "TypeMissionLogistique" NOT NULL,
    "proprietaire" TEXT NOT NULL,
    "poids_kg" DECIMAL(10,2) NOT NULL,
    "volume" DECIMAL(10,3),
    "destination" TEXT NOT NULL,
    "expediteur_nom" TEXT NOT NULL,
    "expediteur_fonction" TEXT NOT NULL,
    "expediteur_tel" TEXT NOT NULL,
    "origine" "OrigineEnregistrement" NOT NULL DEFAULT 'SAISIE',
    "verrouille" BOOLEAN NOT NULL DEFAULT false,
    "sensible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Materiel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarchandiseDangereuse" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "classe_iata" TEXT NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "poids_kg" DECIMAL(10,2) NOT NULL,
    "volume" DECIMAL(10,3),
    "conditionnement" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "proprietaire" TEXT NOT NULL,
    "proprietaire_tel" TEXT NOT NULL,

    CONSTRAINT "MarchandiseDangereuse_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "ValidationEtape" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "etape" "EtapeValidation" NOT NULL,
    "validateur_id" TEXT,
    "date_heure" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentaire" TEXT,
    "statut" "StatutValidation" NOT NULL DEFAULT 'EN_ATTENTE',

    CONSTRAINT "ValidationEtape_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlerteEscale" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "type_alerte" TEXT NOT NULL,
    "destinataires" TEXT[],
    "message" TEXT NOT NULL,
    "date_emission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lu_par" TEXT[],

    CONSTRAINT "AlerteEscale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompteRenduCemaa" (
    "id" TEXT NOT NULL,
    "manifeste_id" TEXT NOT NULL,
    "date_envoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdf_chiffre" TEXT NOT NULL,
    "accuse_reception_cemaa" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompteRenduCemaa_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "Base_code_base_key" ON "Base"("code_base");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_login_key" ON "Utilisateur"("login");

-- CreateIndex
CREATE INDEX "Utilisateur_base_id_role_idx" ON "Utilisateur"("base_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Aeronef_immatriculation_key" ON "Aeronef"("immatriculation");

-- CreateIndex
CREATE UNIQUE INDEX "Unite_code_key" ON "Unite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vol_numero_mission_key" ON "Vol"("numero_mission");

-- CreateIndex
CREATE INDEX "ConsigneCemaa_vol_id_idx" ON "ConsigneCemaa"("vol_id");

-- CreateIndex
CREATE INDEX "Manifeste_base_id_statut_idx" ON "Manifeste"("base_id", "statut");

-- CreateIndex
CREATE INDEX "Manifeste_vol_id_base_id_idx" ON "Manifeste"("vol_id", "base_id");

-- CreateIndex
CREATE INDEX "Passager_manifeste_id_idx" ON "Passager"("manifeste_id");

-- CreateIndex
CREATE INDEX "Passager_base_id_idx" ON "Passager"("base_id");

-- CreateIndex
CREATE INDEX "Materiel_manifeste_id_idx" ON "Materiel"("manifeste_id");

-- CreateIndex
CREATE INDEX "MarchandiseDangereuse_manifeste_id_idx" ON "MarchandiseDangereuse"("manifeste_id");

-- CreateIndex
CREATE INDEX "ValidationEtape_manifeste_id_etape_idx" ON "ValidationEtape"("manifeste_id", "etape");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationEtape_manifeste_id_etape_key" ON "ValidationEtape"("manifeste_id", "etape");

-- CreateIndex
CREATE UNIQUE INDEX "CompteRenduCemaa_manifeste_id_key" ON "CompteRenduCemaa"("manifeste_id");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_timestamp_idx" ON "AuditLog"("user_id", "timestamp");

-- AddForeignKey
ALTER TABLE "Base" ADD CONSTRAINT "Base_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vol" ADD CONSTRAINT "Vol_immatriculation_fkey" FOREIGN KEY ("immatriculation") REFERENCES "Aeronef"("immatriculation") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vol" ADD CONSTRAINT "Vol_base_depart_id_fkey" FOREIGN KEY ("base_depart_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vol" ADD CONSTRAINT "Vol_base_arrivee_id_fkey" FOREIGN KEY ("base_arrivee_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsigneCemaa" ADD CONSTRAINT "ConsigneCemaa_vol_id_fkey" FOREIGN KEY ("vol_id") REFERENCES "Vol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manifeste" ADD CONSTRAINT "Manifeste_vol_id_fkey" FOREIGN KEY ("vol_id") REFERENCES "Vol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manifeste" ADD CONSTRAINT "Manifeste_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manifeste" ADD CONSTRAINT "Manifeste_manifeste_maitre_id_fkey" FOREIGN KEY ("manifeste_maitre_id") REFERENCES "Manifeste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passager" ADD CONSTRAINT "Passager_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Materiel" ADD CONSTRAINT "Materiel_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarchandiseDangereuse" ADD CONSTRAINT "MarchandiseDangereuse_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipage" ADD CONSTRAINT "Equipage_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationEtape" ADD CONSTRAINT "ValidationEtape_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationEtape" ADD CONSTRAINT "ValidationEtape_validateur_id_fkey" FOREIGN KEY ("validateur_id") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlerteEscale" ADD CONSTRAINT "AlerteEscale_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteRenduCemaa" ADD CONSTRAINT "CompteRenduCemaa_manifeste_id_fkey" FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
