-- ═══════════════════════════════════════════════════════════════════════════
-- SIGVEA — Lot 4, étape 1/2 : valeurs d'énumérations
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI CE FICHIER EST SÉPARÉ DE LA MIGRATION SUIVANTE
--
-- PostgreSQL autorise « ALTER TYPE … ADD VALUE » à l'intérieur d'une
-- transaction depuis la version 12, MAIS interdit d'UTILISER la valeur ajoutée
-- dans cette même transaction (erreur : « unsafe use of new value ... of enum
-- type »). Prisma exécute chaque fichier de migration dans UNE transaction.
--
-- Or la migration suivante utilise 'comea', 'mage' et 'MAGE' :
--   • dans le prédicat d'un index partiel sur Interim ;
--   • dans le trigger de cohérence escadron/rôle ;
--   • dans les DEFAULT de ConsigneCemaa.autorite.
--
-- Les mettre dans le même fichier produirait un échec systématique au déploiement.
-- Deux fichiers = deux transactions = aucun problème.
--
-- Ordre de passage impératif :
--   1. 20260825090000_lot4_valeurs_enums      (ce fichier)
--   2. 20260825090100_lot4_escadrons_interim_archives
--
-- ⚠ NE JAMAIS fusionner ces deux fichiers, même « pour simplifier ».
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Rôles ──────────────────────────────────────────────────────────────────
-- comea : commandant des escadrons aériens. Planifie les vols, n'appose
--         AUCUN tampon (absent de ROLE_TO_ETAPE côté applicatif).
-- mage  : major général de l'armée de l'air. Autorité centrale, comme le CEMAA.
--
-- Position dans l'ordre de l'enum : sans clause BEFORE/AFTER, la valeur est
-- ajoutée en fin. L'ordre de l'enum PostgreSQL n'a ici aucune portée métier
-- (aucun ORDER BY ni comparaison < > sur RoleUtilisateur dans le code), on
-- laisse donc l'ajout en queue — c'est aussi la forme la plus sûre en reprise.
ALTER TYPE "RoleUtilisateur" ADD VALUE IF NOT EXISTS 'comea';
ALTER TYPE "RoleUtilisateur" ADD VALUE IF NOT EXISTS 'mage';

-- ── Étapes de validation ───────────────────────────────────────────────────
-- MAGE_SENSIBLE est ajoutée UNIQUEMENT pour rester alignée sur le schéma
-- Prisma. Elle n'est PLUS JAMAIS produite : le circuit est désormais identique
-- pour tous les vols, et le contrôle des consignes d'autorité vit sur la
-- consigne (StatutConsigne), pas dans la séquence des étapes.
-- Elle figure dans ETAPES_HISTORIQUES (@sigea/shared-types) au même titre que
-- CEMAA_SENSIBLE, afin que les manifestes déjà signés restent lisibles.
ALTER TYPE "EtapeValidation" ADD VALUE IF NOT EXISTS 'MAGE_SENSIBLE';

-- ── Origine d'un enregistrement ────────────────────────────────────────────
-- Une ligne de passager ou de matériel imposée par le MAGE doit être
-- distinguable de celle imposée par le CEMAA : les deux autorités sont
-- cloisonnées, y compris dans la traçabilité.
ALTER TYPE "OrigineEnregistrement" ADD VALUE IF NOT EXISTS 'MAGE';


-- ═══════════════════════════════════════════════════════════════════════════
-- SIGVEA — Lot 4, étape 2/2 : structures
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Prérequis : 20260825090000_lot4_valeurs_enums doit être passée AVANT
-- (voir l'en-tête de ce fichier pour la raison).
--
-- Couvre :
--   • escadrons aériens et rattachement du COMEA           (besoins 3 et 4)
--   • intérim et mouvements de personnel                    (besoin 6)
--   • suivi d'exécution des consignes CEMAA / MAGE          (vols sensibles)
--   • archivage PDF des manifestes clos                     (besoin 9)
--   • index de recherche pour le module Exploitation        (besoin 8)
--   • journal des recherches nominatives (CNI, matricule)   (besoin 8)
--
-- Écrite pour être REJOUABLE : chaque objet est protégé par IF NOT EXISTS ou
-- par un bloc DO. Une migration qui échoue à mi-parcours doit pouvoir être
-- relancée sans intervention manuelle en base — condition pratiquement
-- indispensable sur un système hébergé en salle serveur sans accès distant.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Nouveaux types
-- ───────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "AutoriteCentrale" AS ENUM ('CEMAA', 'MAGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StatutConsigne" AS ENUM ('EMISE', 'REALISEE', 'NON_REALISEE', 'ANNULEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TypeMouvement" AS ENUM ('MUTATION', 'DEPART', 'SUSPENSION', 'REINTEGRATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StatutArchive" AS ENUM ('DISPONIBLE', 'ABSENT', 'CORROMPU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Escadrons
-- ───────────────────────────────────────────────────────────────────────────
--
-- `code` est unique DANS une base, pas globalement : la BA 101 et la BA 201
-- peuvent l'une et l'autre héberger un escadron portant un numéro proche, et
-- une contrainte globale interdirait des situations parfaitement régulières.

CREATE TABLE IF NOT EXISTS "Escadron" (
    "id"        TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "nom"       TEXT NOT NULL,
    "type"      TEXT,
    "base_id"   TEXT NOT NULL,
    "actif"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Escadron_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Escadron_base_id_code_key" ON "Escadron"("base_id", "code");
CREATE INDEX        IF NOT EXISTS "Escadron_base_id_actif_idx" ON "Escadron"("base_id", "actif");

DO $$ BEGIN
  ALTER TABLE "Escadron"
    ADD CONSTRAINT "Escadron_base_id_fkey" FOREIGN KEY ("base_id")
    REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rattachement d'un utilisateur à un escadron. NULL pour tous les rôles sauf
-- le COMEA. ON DELETE SET NULL et non CASCADE : désactiver un escadron ne doit
-- jamais supprimer le compte de son commandant.
ALTER TABLE "Utilisateur" ADD COLUMN IF NOT EXISTS "escadron_id" TEXT;

CREATE INDEX IF NOT EXISTS "Utilisateur_escadron_id_idx" ON "Utilisateur"("escadron_id");
CREATE INDEX IF NOT EXISTS "Utilisateur_base_id_role_idx" ON "Utilisateur"("base_id", "role");

DO $$ BEGIN
  ALTER TABLE "Utilisateur"
    ADD CONSTRAINT "Utilisateur_escadron_id_fkey" FOREIGN KEY ("escadron_id")
    REFERENCES "Escadron"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Cohérence escadron ⇄ base ⇄ rôle, garantie par le SGBD ─────────────────
--
-- La règle « on ne présente à un COMEA que les escadrons de SA base » est
-- déjà tenue deux fois côté applicatif : l'IHM filtre la liste, AdminService
-- .resolveEscadron() la revérifie. Ce trigger est le troisième rempart, et le
-- seul qui résiste à une écriture directe en base ou à un script d'import.
--
-- Il refuse :
--   • un escadron rattaché à une autre base que celle de l'utilisateur ;
--   • un escadron porté par un rôle autre que COMEA.
-- Il n'impose PAS la présence d'un escadron pour un COMEA : cette règle-là
-- reste applicative, car elle doit produire un message métier, pas une
-- exception SQL, et parce qu'elle empêcherait toute reprise de données.
CREATE OR REPLACE FUNCTION trg_utilisateur_escadron_base()
RETURNS TRIGGER AS $$
DECLARE
  base_escadron TEXT;
BEGIN
  IF NEW.escadron_id IS NULL THEN
    RETURN NEW;
  END IF;

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_utilisateur_escadron_base ON "Utilisateur";
CREATE TRIGGER trg_utilisateur_escadron_base
  BEFORE INSERT OR UPDATE OF escadron_id, role, base_id ON "Utilisateur"
  FOR EACH ROW EXECUTE FUNCTION trg_utilisateur_escadron_base();

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Intérim
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Interim" (
    "id"               TEXT NOT NULL,
    "titulaire_id"     TEXT NOT NULL,
    "suppleant_id"     TEXT NOT NULL,
    "role_delegue"     "RoleUtilisateur" NOT NULL,
    "base_id"          TEXT NOT NULL,
    "escadron_id"      TEXT,
    "motif"            TEXT,
    "date_debut"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_fin"         TIMESTAMP(3),
    "actif"            BOOLEAN NOT NULL DEFAULT true,
    "cree_par"         TEXT NOT NULL,
    "revoque_par"      TEXT,
    "revoque_le"       TIMESTAMP(3),
    "motif_revocation" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interim_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Interim_suppleant_id_actif_idx" ON "Interim"("suppleant_id", "actif");
CREATE INDEX IF NOT EXISTS "Interim_titulaire_id_actif_idx" ON "Interim"("titulaire_id", "actif");
CREATE INDEX IF NOT EXISTS "Interim_base_id_actif_idx"      ON "Interim"("base_id", "actif");

DO $$ BEGIN
  ALTER TABLE "Interim"
    ADD CONSTRAINT "Interim_titulaire_id_fkey" FOREIGN KEY ("titulaire_id")
    REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Interim"
    ADD CONSTRAINT "Interim_suppleant_id_fkey" FOREIGN KEY ("suppleant_id")
    REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Index uniques PARTIELS : la règle « un poste, un suppléant » ───────────
--
-- InterimService.creer() attrape le code Prisma P2002 et renvoie un 409 avec
-- un message métier. Sans ces deux index, ce P2002 ne serait JAMAIS levé : le
-- code de rattrapage existe aujourd'hui dans le service mais ne s'exécute
-- jamais, et rien n'empêche d'ouvrir deux délégations concurrentes sur le
-- même poste — deux tampons « P/I » distincts sur le même circuit.
--
-- Partiels (WHERE actif) et non pleins : une fois révoquée, une délégation
-- doit pouvoir coexister avec une nouvelle sur le même poste. L'historique
-- est conservé, la contrainte ne porte que sur le présent.
CREATE UNIQUE INDEX IF NOT EXISTS "Interim_poste_actif_key"
  ON "Interim"("titulaire_id", "role_delegue") WHERE "actif";

CREATE UNIQUE INDEX IF NOT EXISTS "Interim_suppleant_role_actif_key"
  ON "Interim"("suppleant_id", "role_delegue") WHERE "actif";

-- Un agent ne peut pas assurer son propre intérim. Contrôlé côté service ;
-- doublé ici parce qu'une écriture directe contournerait le service.
DO $$ BEGIN
  ALTER TABLE "Interim"
    ADD CONSTRAINT "Interim_titulaire_distinct_suppleant"
    CHECK ("titulaire_id" <> "suppleant_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bornes temporelles cohérentes.
DO $$ BEGIN
  ALTER TABLE "Interim"
    ADD CONSTRAINT "Interim_bornes_coherentes"
    CHECK ("date_fin" IS NULL OR "date_fin" > "date_debut");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Traçabilité de l'intérim sur le tampon ────────────────────────────────
--
-- Ces colonnes portent le besoin 6 : « si cet utilisateur intervient dans le
-- circuit de validation, la mention intérim doit se voir sur le tampon ».
-- Elles sont figées à la signature, comme le reste du tampon : révoquer la
-- délégation ne doit pas réécrire un document déjà signé.
ALTER TABLE "ValidationEtape" ADD COLUMN IF NOT EXISTS "par_interim"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ValidationEtape" ADD COLUMN IF NOT EXISTS "interim_id"      TEXT;
ALTER TABLE "ValidationEtape" ADD COLUMN IF NOT EXISTS "titulaire_nom"   TEXT;
ALTER TABLE "ValidationEtape" ADD COLUMN IF NOT EXISTS "titulaire_grade" TEXT;

-- ON DELETE SET NULL : on ne supprime pas une délégation (le service ne
-- l'expose pas), mais si cela arrivait, la signature doit survivre à sa
-- délégation. Le nom du titulaire, lui, reste inscrit dans la ligne.
DO $$ BEGIN
  ALTER TABLE "ValidationEtape"
    ADD CONSTRAINT "ValidationEtape_interim_id_fkey" FOREIGN KEY ("interim_id")
    REFERENCES "Interim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Mouvements de personnel
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "MouvementPersonnel" (
    "id"             TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "type"           "TypeMouvement" NOT NULL,
    "base_avant"     TEXT,
    "base_apres"     TEXT,
    "role_avant"     "RoleUtilisateur",
    "role_apres"     "RoleUtilisateur",
    "escadron_avant" TEXT,
    "escadron_apres" TEXT,
    "successeur_id"  TEXT,
    "date_effet"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motif"          TEXT,
    "reference"      TEXT,
    "decide_par"     TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MouvementPersonnel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MouvementPersonnel_utilisateur_id_date_effet_idx"
  ON "MouvementPersonnel"("utilisateur_id", "date_effet");
CREATE INDEX IF NOT EXISTS "MouvementPersonnel_type_date_effet_idx"
  ON "MouvementPersonnel"("type", "date_effet");

DO $$ BEGIN
  ALTER TABLE "MouvementPersonnel"
    ADD CONSTRAINT "MouvementPersonnel_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id")
    REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MouvementPersonnel"
    ADD CONSTRAINT "MouvementPersonnel_successeur_id_fkey" FOREIGN KEY ("successeur_id")
    REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Consignes d'autorité centrale : émetteur et suivi d'exécution
-- ───────────────────────────────────────────────────────────────────────────
--
-- C'est la traduction en base de la règle des vols sensibles : le circuit de
-- signature est le MÊME que pour un vol ordinaire, mais l'autorité qui a émis
-- la consigne (CEMAA ou MAGE) doit attester de son exécution. Ce n'est pas un
-- visa — aucun tampon n'est apposé à ce titre —, c'est un accusé d'exécution.
--
-- Le DEFAULT 'CEMAA' rend la reprise des consignes existantes correcte sans
-- script : avant ce lot, seul le CEMAA émettait des consignes.

ALTER TABLE "ConsigneCemaa"
  ADD COLUMN IF NOT EXISTS "autorite" "AutoriteCentrale" NOT NULL DEFAULT 'CEMAA';

ALTER TABLE "ConsigneCemaa"
  ADD COLUMN IF NOT EXISTS "statut_realisation" "StatutConsigne" NOT NULL DEFAULT 'EMISE';

ALTER TABLE "ConsigneCemaa" ADD COLUMN IF NOT EXISTS "confirme_par"            TEXT;
ALTER TABLE "ConsigneCemaa" ADD COLUMN IF NOT EXISTS "confirme_le"             TIMESTAMP(3);
ALTER TABLE "ConsigneCemaa" ADD COLUMN IF NOT EXISTS "observation_realisation" TEXT;

-- `updatedAt` a été ajoutée nullable par la migration lot0. Prisma la déclare
-- NOT NULL : on comble les valeurs manquantes puis on pose la contrainte,
-- faute de quoi le client Prisma lèvera une erreur de désérialisation à la
-- première lecture d'une consigne ancienne.
UPDATE "ConsigneCemaa" SET "updatedAt" = "date" WHERE "updatedAt" IS NULL;

DO $$ BEGIN
  ALTER TABLE "ConsigneCemaa" ALTER COLUMN "updatedAt" SET NOT NULL;
  ALTER TABLE "ConsigneCemaa" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN others THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ConsigneCemaa_autorite_vol_id_idx"
  ON "ConsigneCemaa"("autorite", "vol_id");

-- Index servant la requête bloquante de la state machine, exécutée à chaque
-- tentative de signature COMBASE : « existe-t-il une consigne non confirmée
-- sur ce vol ? ». Partiel, pour ne porter que les consignes qui bloquent.
CREATE INDEX IF NOT EXISTS "ConsigneCemaa_vol_bloquantes_idx"
  ON "ConsigneCemaa"("vol_id", "escale_base_id")
  WHERE "statut_realisation" IN ('EMISE', 'NON_REALISEE');

-- Symétrie CEMAA / MAGE sur le manifeste : le bandeau imprimé doit pouvoir
-- distinguer les consignes des deux autorités, qui sont cloisonnées.
ALTER TABLE "Manifeste" ADD COLUMN IF NOT EXISTS "consignes_mage_appliquees" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Manifeste" ADD COLUMN IF NOT EXISTS "consignes_mage_date"       TIMESTAMP(3);
ALTER TABLE "Manifeste" ADD COLUMN IF NOT EXISTS "consignes_mage_nb"         INTEGER NOT NULL DEFAULT 0;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Archivage PDF des manifestes clos
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ArchiveManifeste" (
    "id"                     TEXT NOT NULL,
    "manifeste_id"           TEXT NOT NULL,
    "base_id"                TEXT NOT NULL,
    "vol_id"                 TEXT NOT NULL,
    "numero_mission"         TEXT NOT NULL,
    "etape_vol"              TEXT NOT NULL,
    "chemin"                 TEXT NOT NULL,
    "taille_octets"          INTEGER NOT NULL,
    "sha256_pdf"             TEXT NOT NULL,
    "hash_contenu"           TEXT NOT NULL,
    "version_contenu"        INTEGER NOT NULL,
    "statut"                 "StatutArchive" NOT NULL DEFAULT 'DISPONIBLE',
    "date_cloture"           TIMESTAMP(3) NOT NULL,
    "genere_le"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nb_telechargements"     INTEGER NOT NULL DEFAULT 0,
    "dernier_telechargement" TIMESTAMP(3),
    "derniere_verification"  TIMESTAMP(3),
    CONSTRAINT "ArchiveManifeste_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ArchiveManifeste_manifeste_id_key"
  ON "ArchiveManifeste"("manifeste_id");
CREATE INDEX IF NOT EXISTS "ArchiveManifeste_base_id_date_cloture_idx"
  ON "ArchiveManifeste"("base_id", "date_cloture");
CREATE INDEX IF NOT EXISTS "ArchiveManifeste_vol_id_idx" ON "ArchiveManifeste"("vol_id");
CREATE INDEX IF NOT EXISTS "ArchiveManifeste_statut_idx" ON "ArchiveManifeste"("statut");

DO $$ BEGIN
  ALTER TABLE "ArchiveManifeste"
    ADD CONSTRAINT "ArchiveManifeste_manifeste_id_fkey" FOREIGN KEY ("manifeste_id")
    REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Immuabilité de l'archive ──────────────────────────────────────────────
--
-- Une archive atteste de ce qui a été signé. Seuls quatre champs de suivi
-- peuvent bouger après création : le compteur de téléchargements, sa date, la
-- date de dernière vérification, et le statut (une archive peut devenir ABSENT
-- ou CORROMPU si le contrôle d'empreinte échoue).
--
-- Tout le reste — chemin, empreintes, version, date de clôture — est figé.
-- Sans ce trigger, un UPDATE malencontreux (ou volontaire) sur `sha256_pdf`
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

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Module Exploitation : index de croisement
-- ───────────────────────────────────────────────────────────────────────────
--
-- Sans ces index, chaque écran d'exploitation (« passagers les plus
-- fréquents », « COMBORD les plus sollicités », recherche par CNI…) déclenche
-- un Seq Scan sur Passager et Vol. Acceptable sur un jeu de démonstration,
-- ruineux au bout de deux ans d'exploitation réelle.

-- ── Colonnes présentes dans schema.prisma mais jamais migrées ─────────────
--
-- Deux colonnes ont été ajoutées au schéma Prisma sans migration
-- correspondante. Le client généré les connaît, la base ne les a jamais eues.
-- Symptôme observé au premier déploiement de ce lot :
--     ERROR 42703: column "cni" does not exist
-- levé par la création de l'index ci-dessous, et non par la colonne elle-même.
--
-- On les crée ici plutôt que dans une migration séparée : elles sont la
-- condition d'existence des index d'exploitation qui suivent, et les séparer
-- exposerait au même échec si l'ordre venait à changer.
--
-- ⚠ `cni` conditionne la recherche nominative du besoin 8. Sans elle, la
--   fonctionnalité ne pouvait pas fonctionner, migration ou pas.
ALTER TABLE "Passager"    ADD COLUMN IF NOT EXISTS "cni" TEXT;
ALTER TABLE "Utilisateur" ADD COLUMN IF NOT EXISTS "nb_echecs_connexion" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Passager_cni_idx"                 ON "Passager"("cni");
CREATE INDEX IF NOT EXISTS "Passager_matricule_idx"           ON "Passager"("matricule");
CREATE INDEX IF NOT EXISTS "Passager_categorie_idx"           ON "Passager"("categorie");
CREATE INDEX IF NOT EXISTS "Passager_contact_urgence_tel_idx" ON "Passager"("contact_urgence_tel");
CREATE INDEX IF NOT EXISTS "Passager_base_id_idx"             ON "Passager"("base_id");

CREATE INDEX IF NOT EXISTS "Materiel_designation_idx"      ON "Materiel"("designation");
CREATE INDEX IF NOT EXISTS "Materiel_type_mission_log_idx" ON "Materiel"("type_mission_log");

CREATE INDEX IF NOT EXISTS "Vol_base_depart_id_base_arrivee_id_date_heure_idx"
  ON "Vol"("base_depart_id", "base_arrivee_id", "date_heure");
CREATE INDEX IF NOT EXISTS "Vol_combord_nom_combord_prenom_idx"
  ON "Vol"("combord_nom", "combord_prenom");

-- ── Journal des recherches nominatives ────────────────────────────────────
--
-- Toute recherche par CNI, matricule, nom ou téléphone est journalisée, avec
-- son motif. C'est la contrepartie indispensable du besoin 8 : un module qui
-- permet de retrouver tous les déplacements d'une personne à partir de son
-- numéro de CNI est un outil de renseignement, et il doit lui-même être
-- surveillé. Distinct d'AuditLog, qui trace les appels HTTP sans leur objet.
CREATE TABLE IF NOT EXISTS "RechercheNominative" (
    "id"           TEXT NOT NULL,
    "user_id"      TEXT NOT NULL,
    "role"         TEXT NOT NULL,
    "base_id"      TEXT NOT NULL,
    "type_critere" TEXT NOT NULL,
    "critere"      TEXT NOT NULL,
    "nb_resultats" INTEGER NOT NULL DEFAULT 0,
    "motif"        TEXT,
    "ip"           TEXT,
    "timestamp"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RechercheNominative_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RechercheNominative_user_id_timestamp_idx"
  ON "RechercheNominative"("user_id", "timestamp");
CREATE INDEX IF NOT EXISTS "RechercheNominative_timestamp_idx"
  ON "RechercheNominative"("timestamp");

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Reprise de données
-- ───────────────────────────────────────────────────────────────────────────
--
-- Les manifestes déjà en circuit avant ce lot portent des visas dépourvus des
-- colonnes d'intérim. Le DEFAULT false les a déjà renseignés ; rien d'autre
-- n'est à reprendre : aucune délégation n'existait avant ce lot, par
-- construction.
--
-- ⚠ RESTE À FAIRE HORS MIGRATION, par l'administrateur, dans cet ordre :
--   1. créer les escadrons de chaque base (POST /api/referentiel/escadrons) ;
--   2. créer ou basculer les comptes COMEA en leur affectant un escadron ;
--   3. retirer aux COMBASE l'habitude de planifier — le serveur le refuse
--      désormais (403), mais prévenir vaut mieux que dépanner.
--
-- Aucune bascule automatique de rôle n'est faite ici : décider qu'un COMBASE
-- devient COMEA est une décision d'emploi, pas une opération de migration.