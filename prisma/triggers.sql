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