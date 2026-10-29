-- ============================================================================
-- SIGEA — Row-Level Security PostgreSQL
--
-- À exécuter APRÈS `prisma migrate deploy`, et seulement après avoir lu
-- l'avertissement ci-dessous.
-- ============================================================================
--
-- CE QUI CLOCHAIT DANS LA VERSION PRÉCÉDENTE
--
--   1. Les tables étaient nommées « manifestes », « passagers », « materiels »,
--      « audit_logs ». Aucune n'existe : le schéma Prisma ne pose pas de @@map
--      sur ces modèles, et PostgreSQL crée donc « Manifeste », « Passager »,
--      « Materiel », « AuditLog ». Ce fichier échouait à la première ligne.
--
--   2. `CREATE POLICY ... FOR INSERT USING (...)` est invalide : une politique
--      d'insertion se définit avec WITH CHECK. USING filtre ce qu'on LIT,
--      WITH CHECK contrôle ce qu'on ÉCRIT.
--
--   3. Le cloisonnement ne connaissait que la base. La chaîne RMIA — COMRMIA,
--      ADJ_AIR, SEC_ADJ_AIR — n'aurait rien vu du tout.
--
-- ── AVERTISSEMENT, À LIRE AVANT D'EXÉCUTER ──
--
-- Ces politiques ne fonctionnent QUE si chaque requête pose son contexte dans
-- la même transaction, via PrismaService.avecContexte(). Les activer sans cela
-- bloque TOUTES les lectures : current_setting renvoie la chaîne vide, et plus
-- aucune ligne ne satisfait la politique.
--
-- Le cloisonnement effectif de SIGEA est aujourd'hui APPLICATIF (PerimetreGuard
-- et clauses `where` dans les services). RLS en est un second rempart, destiné
-- à couvrir une requête applicative mal écrite. Ne l'activez qu'en recette
-- d'abord, et vérifiez qu'aucun écran ne se vide.
--
-- Pour revenir en arrière : voir le bloc de désactivation en fin de fichier.
-- ============================================================================

-- Fonctions d'aide : un seul endroit à corriger si la convention change.

CREATE OR REPLACE FUNCTION sigea_base_courante() RETURNS text AS $$
  SELECT COALESCE(current_setting('app.current_base_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION sigea_rmia_courante() RETURNS text AS $$
  SELECT COALESCE(current_setting('app.current_rmia', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION sigea_role_courant() RETURNS text AS $$
  SELECT COALESCE(current_setting('app.current_role', true), '');
$$ LANGUAGE sql STABLE;

-- Rôles au périmètre national : ils lisent tout.
-- Cette liste DOIT rester identique à ROLES_PERIMETRE_NATIONAL
-- (@sigea/shared-types). Une divergence produirait un écran vide pour un
-- officier pourtant habilité — défaut long à diagnostiquer.
CREATE OR REPLACE FUNCTION sigea_perimetre_national() RETURNS boolean AS $$
  SELECT sigea_role_courant() IN ('scops', 'cemaa', 'mage', 'admin');
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- Listes d'embarquement — cloisonnement RÉGIONAL
-- ============================================================================
-- C'est l'exigence explicite de la directive : les données de la RMIA X ne
-- doivent pas être manipulées par la RMIA Y.

ALTER TABLE "ListeEmbarquement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListeEmbarquement" FORCE ROW LEVEL SECURITY;
ALTER DATABASE sigea SET app.current_user_id = '';
ALTER DATABASE sigea SET app.current_rmia    = '';
DROP POLICY IF EXISTS liste_lecture ON "ListeEmbarquement";
CREATE POLICY liste_lecture ON "ListeEmbarquement"
  FOR SELECT
  USING (
    sigea_perimetre_national()
    OR rmia::text = sigea_rmia_courante()
    -- Le commandant de base de décollage et ses délégataires, ainsi que le
    -- commandant de bord, accèdent par la base du point d'embarquement.
    OR EXISTS (
      SELECT 1 FROM "etape_itineraire" e
      WHERE e.id = "ListeEmbarquement".etape_id
        AND e.base_id = sigea_base_courante()
    )
  );

DROP POLICY IF EXISTS liste_ecriture ON "ListeEmbarquement";
CREATE POLICY liste_ecriture ON "ListeEmbarquement"
  FOR UPDATE
  USING (sigea_perimetre_national() OR rmia::text = sigea_rmia_courante()
         OR EXISTS (SELECT 1 FROM "etape_itineraire" e
                    WHERE e.id = "ListeEmbarquement".etape_id
                      AND e.base_id = sigea_base_courante()))
  WITH CHECK (sigea_perimetre_national() OR rmia::text = sigea_rmia_courante()
         OR EXISTS (SELECT 1 FROM "etape_itineraire" e
                    WHERE e.id = "ListeEmbarquement".etape_id
                      AND e.base_id = sigea_base_courante()));

-- Lignes de liste : elles héritent du cloisonnement de leur liste.
-- Pas de colonne rmia dupliquée ici : deux sources de vérité finiraient par
-- diverger, et c'est la ligne — donc l'identité d'une personne — qui en
-- souffrirait.

ALTER TABLE "LigneListe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LigneListe" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ligne_isolation ON "LigneListe";
CREATE POLICY ligne_isolation ON "LigneListe"
  USING (
    sigea_perimetre_national()
    OR EXISTS (
      SELECT 1 FROM "ListeEmbarquement" l
      WHERE l.id = "LigneListe".liste_id
        AND (l.rmia::text = sigea_rmia_courante()
             OR EXISTS (SELECT 1 FROM "etape_itineraire" e
                        WHERE e.id = l.etape_id AND e.base_id = sigea_base_courante()))
    )
  );

ALTER TABLE "FretListe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FretListe" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fret_isolation ON "FretListe";
CREATE POLICY fret_isolation ON "FretListe"
  USING (
    sigea_perimetre_national()
    OR EXISTS (
      SELECT 1 FROM "ListeEmbarquement" l
      WHERE l.id = "FretListe".liste_id
        AND (l.rmia::text = sigea_rmia_courante()
             OR EXISTS (SELECT 1 FROM "etape_itineraire" e
                        WHERE e.id = l.etape_id AND e.base_id = sigea_base_courante()))
    )
  );

-- ============================================================================
-- Potentialités — vivier régional
-- ============================================================================
-- Ce sont des données nominatives de personnes qui n'ont PAS voyagé. Leur
-- cloisonnement mérite au moins autant d'attention que celui des listes.

ALTER TABLE "Potentialite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Potentialite" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS potentialite_isolation ON "Potentialite";
CREATE POLICY potentialite_isolation ON "Potentialite"
  USING (sigea_perimetre_national() OR rmia::text = sigea_rmia_courante());

-- ============================================================================
-- Manifestes et contenu — cloisonnement par BASE
-- ============================================================================

ALTER TABLE "Manifeste" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Manifeste" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manifeste_lecture ON "Manifeste";
CREATE POLICY manifeste_lecture ON "Manifeste"
  FOR SELECT
  USING (
    sigea_perimetre_national()
    OR base_id = sigea_base_courante()
    OR EXISTS (SELECT 1 FROM "ListeEmbarquement" l
               WHERE l.id = "Manifeste".liste_id
                 AND l.rmia::text = sigea_rmia_courante())
  );

DROP POLICY IF EXISTS manifeste_ecriture ON "Manifeste";
CREATE POLICY manifeste_ecriture ON "Manifeste"
  FOR UPDATE
  USING (sigea_perimetre_national() OR base_id = sigea_base_courante())
  WITH CHECK (sigea_perimetre_national() OR base_id = sigea_base_courante());

DROP POLICY IF EXISTS manifeste_insertion ON "Manifeste";
CREATE POLICY manifeste_insertion ON "Manifeste"
  FOR INSERT
  -- WITH CHECK, et non USING : une politique d'insertion contrôle ce qui est
  -- écrit, pas ce qui est lu. L'ancienne version utilisait USING et était
  -- rejetée par PostgreSQL.
  WITH CHECK (sigea_perimetre_national() OR base_id = sigea_base_courante());

ALTER TABLE "Passager" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Passager" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS passager_isolation ON "Passager";
CREATE POLICY passager_isolation ON "Passager"
  USING (sigea_perimetre_national() OR base_id = sigea_base_courante());

ALTER TABLE "Materiel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Materiel" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS materiel_isolation ON "Materiel";
CREATE POLICY materiel_isolation ON "Materiel"
  USING (sigea_perimetre_national() OR base_id = sigea_base_courante());

-- ============================================================================
-- Journalisation des tentatives hors périmètre
-- ============================================================================

CREATE OR REPLACE FUNCTION log_tentative_hors_perimetre()
RETURNS TRIGGER AS $$
BEGIN
  -- Contexte absent : on ne journalise PAS. Un seed, une migration ou un
  -- travail de maintenance tournent sans contexte, et inonder la table d'audit
  -- de faux positifs la rendrait inexploitable le jour où elle sert.
  IF sigea_base_courante() = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.base_id <> sigea_base_courante() AND NOT sigea_perimetre_national() THEN
    INSERT INTO "AuditLog" (id, user_id, base_id, role, action, resource, content_hash, timestamp)
    VALUES (
      gen_random_uuid()::text,
      COALESCE(current_setting('app.current_user_id', true), 'inconnu'),
      sigea_base_courante(),
      sigea_role_courant(),
      'TENTATIVE_HORS_PERIMETRE',
      TG_TABLE_NAME,
      encode(sha256(row_to_json(NEW)::text::bytea), 'hex'),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_manifeste_hors_perimetre ON "Manifeste";
CREATE TRIGGER trg_manifeste_hors_perimetre
  BEFORE INSERT OR UPDATE ON "Manifeste"
  FOR EACH ROW EXECUTE FUNCTION log_tentative_hors_perimetre();

-- ============================================================================
-- Désactivation d'urgence
-- ============================================================================
-- À garder sous la main : si un écran se vide en recette, cette séquence rétablit
-- le comportement antérieur sans perdre une ligne. Le cloisonnement applicatif,
-- lui, reste en place.
--
--   ALTER TABLE "ListeEmbarquement" DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "LigneListe"        DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "FretListe"         DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "Potentialite"      DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "Manifeste"         DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "Passager"          DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "Materiel"          DISABLE ROW LEVEL SECURITY;
-- ============================================================================