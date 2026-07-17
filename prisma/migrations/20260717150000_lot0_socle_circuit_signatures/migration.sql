-- ═══════════════════════════════════════════════════════════════════════════
-- SIGEA — Lot 0 : socle du circuit de validation et des tampons de signature
-- PostgreSQL 16
--
-- ATTENTION — deux backfills portent des valeurs sentinelles sur les lignes
-- existantes (Base.numero, Vol.combord_*). Voir §2 et §4. Sur une base de
-- production non vide, relire ces blocs AVANT d'appliquer.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Enum EtapeValidation : ajout de CHEF_ESCALE ────────────────────────
-- ALTER TYPE ... ADD VALUE est autorisé dans une transaction depuis PG 12,
-- à condition de ne pas UTILISER la nouvelle valeur dans la même transaction.
-- Aucun INSERT/UPDATE ci-dessous ne l'emploie : c'est donc sûr.
ALTER TYPE "EtapeValidation" ADD VALUE IF NOT EXISTS 'CHEF_ESCALE' BEFORE 'COMESO';

-- ─── 2. Nouveaux enums ─────────────────────────────────────────────────────
CREATE TYPE "MentionSignature" AS ENUM ('VU', 'ACCORD');
CREATE TYPE "StatutVol" AS ENUM ('PLANIFIE', 'EN_COURS', 'CLOTURE', 'ANNULE');

-- ─── 3. Base.numero ────────────────────────────────────────────────────────
-- Ajout nullable → backfill → NOT NULL, pour ne pas casser les lignes en place.
ALTER TABLE "Base" ADD COLUMN "numero" TEXT;

-- Backfill : extrait la partie numérique de code_base ("BA101" → "101").
-- Le fallback sur code_base couvre un code non conforme au motif.
UPDATE "Base"
SET "numero" = COALESCE(NULLIF(regexp_replace("code_base", '\D', '', 'g'), ''), "code_base")
WHERE "numero" IS NULL;

ALTER TABLE "Base" ALTER COLUMN "numero" SET NOT NULL;

-- ─── 4. Vol : commandant de bord + statut typé ─────────────────────────────
-- Les vols déjà en base n'ont pas de COMBORD : sentinelle explicite plutôt
-- qu'une chaîne vide, pour que l'anomalie soit visible à l'écran et non muette.
ALTER TABLE "Vol" ADD COLUMN "combord_grade"  TEXT;
ALTER TABLE "Vol" ADD COLUMN "combord_nom"    TEXT;
ALTER TABLE "Vol" ADD COLUMN "combord_prenom" TEXT;

UPDATE "Vol" SET
  "combord_grade"  = COALESCE("combord_grade",  'A_COMPLETER'),
  "combord_nom"    = COALESCE("combord_nom",    'A_COMPLETER'),
  "combord_prenom" = COALESCE("combord_prenom", 'A_COMPLETER');

ALTER TABLE "Vol" ALTER COLUMN "combord_grade"  SET NOT NULL;
ALTER TABLE "Vol" ALTER COLUMN "combord_nom"    SET NOT NULL;
ALTER TABLE "Vol" ALTER COLUMN "combord_prenom" SET NOT NULL;

-- statut : TEXT → StatutVol. Toute valeur inconnue retombe sur PLANIFIE.
ALTER TABLE "Vol" ALTER COLUMN "statut" DROP DEFAULT;
ALTER TABLE "Vol"
  ALTER COLUMN "statut" TYPE "StatutVol"
  USING (
    CASE UPPER("statut")
      WHEN 'PLANIFIE' THEN 'PLANIFIE'
      WHEN 'EN_COURS' THEN 'EN_COURS'
      WHEN 'CLOTURE'  THEN 'CLOTURE'
      WHEN 'ANNULE'   THEN 'ANNULE'
      ELSE 'PLANIFIE'
    END
  )::"StatutVol";
ALTER TABLE "Vol" ALTER COLUMN "statut" SET DEFAULT 'PLANIFIE';

CREATE INDEX "Vol_date_heure_idx" ON "Vol"("date_heure");
CREATE INDEX "Vol_statut_idx"     ON "Vol"("statut");

-- ─── 5. EscaleVol : remplace l'ancien `escales_json` (jamais matérialisé) ───
CREATE TABLE "EscaleVol" (
    "id"                TEXT NOT NULL,
    "vol_id"            TEXT NOT NULL,
    "base_id"           TEXT NOT NULL,
    "ordre"             INTEGER NOT NULL,
    "capacite_places"   INTEGER NOT NULL,
    "capacite_cargo_kg" DECIMAL(10,2) NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EscaleVol_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EscaleVol_vol_id_ordre_key"   ON "EscaleVol"("vol_id", "ordre");
CREATE UNIQUE INDEX "EscaleVol_vol_id_base_id_key" ON "EscaleVol"("vol_id", "base_id");
CREATE INDEX        "EscaleVol_base_id_idx"        ON "EscaleVol"("base_id");

ALTER TABLE "EscaleVol" ADD CONSTRAINT "EscaleVol_vol_id_fkey"
  FOREIGN KEY ("vol_id") REFERENCES "Vol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EscaleVol" ADD CONSTRAINT "EscaleVol_base_id_fkey"
  FOREIGN KEY ("base_id") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 6. ValidationEtape : empreinte du tampon figée à la signature ─────────
ALTER TABLE "ValidationEtape" ADD COLUMN "mention"          "MentionSignature";
ALTER TABLE "ValidationEtape" ADD COLUMN "tampon_ligne1"    TEXT;
ALTER TABLE "ValidationEtape" ADD COLUMN "tampon_ligne2"    TEXT;
ALTER TABLE "ValidationEtape" ADD COLUMN "signataire_nom"   TEXT;
ALTER TABLE "ValidationEtape" ADD COLUMN "signataire_grade" TEXT;

CREATE INDEX "ValidationEtape_statut_idx" ON "ValidationEtape"("statut");

-- Cascade : supprimer un manifeste ne doit pas laisser d'étapes orphelines.
ALTER TABLE "ValidationEtape" DROP CONSTRAINT "ValidationEtape_manifeste_id_fkey";
ALTER TABLE "ValidationEtape" ADD CONSTRAINT "ValidationEtape_manifeste_id_fkey"
  FOREIGN KEY ("manifeste_id") REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 7. Manifeste : étape courante + indication consignes CEMAA ────────────
ALTER TABLE "Manifeste" ADD COLUMN "etape_courante" "EtapeValidation";
ALTER TABLE "Manifeste" ADD COLUMN "consignes_cemaa_appliquees" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Manifeste" ADD COLUMN "consignes_cemaa_date"       TIMESTAMP(3);
ALTER TABLE "Manifeste" ADD COLUMN "consignes_cemaa_nb"         INTEGER NOT NULL DEFAULT 0;

-- ─── 8. ConsigneCemaa : traçabilité + index par escale ─────────────────────
ALTER TABLE "ConsigneCemaa" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "ConsigneCemaa" SET "updatedAt" = COALESCE("updatedAt", "date", CURRENT_TIMESTAMP);
ALTER TABLE "ConsigneCemaa" ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE INDEX "ConsigneCemaa_vol_id_escale_base_id_idx"
  ON "ConsigneCemaa"("vol_id", "escale_base_id");

ALTER TABLE "ConsigneCemaa" DROP CONSTRAINT "ConsigneCemaa_vol_id_fkey";
ALTER TABLE "ConsigneCemaa" ADD CONSTRAINT "ConsigneCemaa_vol_id_fkey"
  FOREIGN KEY ("vol_id") REFERENCES "Vol"("id") ON DELETE CASCADE ON UPDATE CASCADE;