/*
  Warnings:

  - You are about to drop the column `otp_secret` on the `Utilisateur` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Utilisateur" DROP COLUMN "otp_secret",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "last_login_ip" TEXT,
ADD COLUMN     "mfa_enrolled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motif_verrouillage" TEXT,
ADD COLUMN     "notif_connexion" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notif_par_email" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verrouille_securite" BOOLEAN NOT NULL DEFAULT false;

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

-- CreateIndex
CREATE UNIQUE INDEX "otp_secrets_user_id_key" ON "otp_secrets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_tokens_user_id_key" ON "challenge_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_tokens_token_key" ON "challenge_tokens"("token");

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

-- AddForeignKey
ALTER TABLE "otp_secrets" ADD CONSTRAINT "otp_secrets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_tokens" ADD CONSTRAINT "challenge_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "known_devices" ADD CONSTRAINT "known_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_notifications" ADD CONSTRAINT "security_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_reset_requests" ADD CONSTRAINT "mfa_reset_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
