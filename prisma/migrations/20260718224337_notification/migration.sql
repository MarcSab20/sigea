-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('MANIFESTE_SOUMIS', 'ETAPE_VALIDEE', 'ETAPE_REJETEE', 'MANIFESTE_COMPLETE', 'CONSIGNE_CEMAA', 'ALERTE');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "destinataire_id" TEXT,
    "type" "TypeNotification" NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "manifeste_id" TEXT,
    "vol_id" TEXT,
    "etape" TEXT,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "lu_le" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_base_id_createdAt_idx" ON "Notification"("base_id", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_destinataire_id_lu_idx" ON "Notification"("destinataire_id", "lu");

-- CreateIndex
CREATE INDEX "Notification_manifeste_id_idx" ON "Notification"("manifeste_id");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "Base"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_destinataire_id_fkey" FOREIGN KEY ("destinataire_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
