-- ═══════════════════════════════════════════════════════════════════════════
-- SIGEA — Historisation du contenu signé
-- PostgreSQL 16
--
-- Migration ADDITIVE : aucune table existante n'est modifiée, aucune colonne
-- supprimée, aucun enum altéré. Elle peut être appliquée sur une base en
-- service sans interruption.
--
-- Seul §3 écrit dans des données existantes, et uniquement en INSERT dans la
-- nouvelle table.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Table ──────────────────────────────────────────────────────────────

CREATE TABLE "ManifesteSnapshot" (
    "id"              TEXT NOT NULL,
    "manifeste_id"    TEXT NOT NULL,
    "etape"           TEXT NOT NULL,
    "version_contenu" INTEGER NOT NULL,
    "version_format"  INTEGER NOT NULL DEFAULT 1,
    "hash"            TEXT NOT NULL,
    "payload"         TEXT NOT NULL,
    "validateur_id"   TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManifesteSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManifesteSnapshot_manifeste_id_etape_key"
    ON "ManifesteSnapshot"("manifeste_id", "etape");
CREATE INDEX "ManifesteSnapshot_manifeste_id_createdAt_idx"
    ON "ManifesteSnapshot"("manifeste_id", "createdAt");
CREATE INDEX "ManifesteSnapshot_hash_idx"
    ON "ManifesteSnapshot"("hash");

ALTER TABLE "ManifesteSnapshot"
    ADD CONSTRAINT "ManifesteSnapshot_manifeste_id_fkey"
    FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── 2. Immuabilité ────────────────────────────────────────────────────────
-- Garantie au niveau du SGBD, et non seulement de l'applicatif : un instantané
-- qu'un UPDATE pourrait réécrire n'a aucune valeur probante. Un accès direct à
-- la base — script de maintenance, correction manuelle en urgence — ne doit pas
-- pouvoir altérer l'historique sans que cela se voie.

CREATE OR REPLACE FUNCTION sigea_snapshot_immuable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'ManifesteSnapshot est immuable : % interdit (manifeste=%, etape=%)',
        TG_OP, OLD."manifeste_id", OLD."etape";
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ManifesteSnapshot_no_update"
    BEFORE UPDATE ON "ManifesteSnapshot"
    FOR EACH ROW EXECUTE FUNCTION sigea_snapshot_immuable();

-- Le DELETE direct est bloqué, mais la suppression en cascade d'un manifeste
-- doit rester possible. `pg_trigger_depth() = 0` distingue les deux : une
-- cascade s'exécute à une profondeur non nulle.
CREATE OR REPLACE FUNCTION sigea_snapshot_no_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() = 0 THEN
        RAISE EXCEPTION
            'ManifesteSnapshot est immuable : DELETE direct interdit (manifeste=%)',
            OLD."manifeste_id";
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ManifesteSnapshot_no_delete"
    BEFORE DELETE ON "ManifesteSnapshot"
    FOR EACH ROW EXECUTE FUNCTION sigea_snapshot_no_delete();


-- ─── 3. Manifestes antérieurs ──────────────────────────────────────────────
-- Les manifestes déjà signés n'ont aucun instantané et n'en auront jamais :
-- leur contenu d'origine n'a pas été conservé. On pose un marqueur explicite
-- plutôt que de laisser un trou silencieux.
--
-- Le hash sentinelle 'non-verifiable' est reconnu par AuthenticiteService :
-- ces manifestes sont imprimés SANS QR, avec la mention « document non
-- authentifiable ». L'endpoint de vérification ne répondra jamais
-- « authentique » sur eux. C'est le comportement correct : affirmer
-- l'authenticité d'un document dont on n'a pas l'empreinte serait un mensonge
-- inscrit dans le système.

INSERT INTO "ManifesteSnapshot"
    ("id", "manifeste_id", "etape", "version_contenu", "version_format",
     "hash", "payload", "validateur_id", "createdAt")
SELECT
    gen_random_uuid()::text,
    m."id",
    'PRE_HISTORISATION',
    m."version",
    0,
    'non-verifiable',
    'Manifeste signé avant la mise en place de l''historisation. '
        || 'Aucune empreinte de référence n''existe pour cet état.',
    NULL,
    m."updatedAt"
FROM "Manifeste" m
WHERE m."statut" IN ('EN_VALIDATION', 'VALIDE');


-- ─── 4. Contrôle post-migration ────────────────────────────────────────────
-- Doit renvoyer une erreur (c'est le résultat attendu) :
--
--   UPDATE "ManifesteSnapshot" SET "hash" = 'x' WHERE true;
--   -- ERROR: ManifesteSnapshot est immuable : UPDATE interdit
--
-- Nombre de manifestes marqués non vérifiables :
--
--   SELECT count(*) FROM "ManifesteSnapshot" WHERE "hash" = 'non-verifiable';
