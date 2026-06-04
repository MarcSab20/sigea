ALTER TABLE "Utilisateur" DROP COLUMN IF EXISTS otp_secret;
ALTER TABLE "Utilisateur" ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

CREATE TABLE IF NOT EXISTS otp_secrets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE REFERENCES "Utilisateur"(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE REFERENCES "Utilisateur"(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);