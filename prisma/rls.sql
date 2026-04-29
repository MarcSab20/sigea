-- ============================================================
-- SIGEA — Row-Level Security PostgreSQL
-- À exécuter après la migration Prisma
-- ============================================================

-- Manifestes
ALTER TABLE "manifestes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "manifestes" FORCE ROW LEVEL SECURITY;

CREATE POLICY manifeste_isolation ON "manifestes"
  USING (
    base_id::text = current_setting('app.current_base_id', true)
    OR current_setting('app.current_role', true) = 'cemaa'
  );

CREATE POLICY manifeste_write ON "manifestes"
  FOR INSERT
  USING (base_id::text = current_setting('app.current_base_id', true));

-- Passagers
ALTER TABLE "passagers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "passagers" FORCE ROW LEVEL SECURITY;

CREATE POLICY passager_isolation ON "passagers"
  USING (
    base_id::text = current_setting('app.current_base_id', true)
    OR current_setting('app.current_role', true) = 'cemaa'
  );

-- Materiels
ALTER TABLE "materiels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "materiels" FORCE ROW LEVEL SECURITY;

CREATE POLICY materiel_isolation ON "materiels"
  USING (
    base_id::text = current_setting('app.current_base_id', true)
    OR current_setting('app.current_role', true) = 'cemaa'
  );

-- Journalisation des tentatives cross-base (fonction trigger)
CREATE OR REPLACE FUNCTION log_cross_base_attempt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.base_id::text != current_setting('app.current_base_id', true)
     AND current_setting('app.current_role', true) != 'cemaa' THEN
    INSERT INTO "audit_logs" (user_id, base_id, role, action, resource, content_hash, timestamp)
    VALUES (
      current_setting('app.current_user_id', true),
      current_setting('app.current_base_id', true),
      current_setting('app.current_role', true),
      'CROSS_BASE_ATTEMPT_BLOCKED',
      TG_TABLE_NAME,
      encode(sha256(row_to_json(NEW)::text::bytea), 'hex'),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
