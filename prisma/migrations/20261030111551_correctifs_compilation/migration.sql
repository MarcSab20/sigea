/*
  Warnings:

  - You are about to drop the `ConsigneAutorite` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `numero_manifeste` to the `ArchiveManifeste` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ConsigneAutorite" DROP CONSTRAINT "ConsigneAutorite_vol_id_fkey";

-- AlterTable
ALTER TABLE "ArchiveManifeste" ADD COLUMN     "numero_manifeste" TEXT NOT NULL;

-- DropTable
DROP TABLE "ConsigneAutorite";

-- CreateTable
CREATE TABLE "ConsigneCemaa" (
    "id" TEXT NOT NULL,
    "vol_id" TEXT NOT NULL,
    "escale_base_id" TEXT,
    "type" "TypeConsigne" NOT NULL,
    "autorite" "AutoriteCentrale" NOT NULL DEFAULT 'CEMAA',
    "contenu_chiffre" TEXT NOT NULL,
    "places_bloquees" INTEGER NOT NULL DEFAULT 0,
    "masse_bloquee_kg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valide_par_cemaa" TEXT NOT NULL,
    "statut_realisation" "StatutConsigne" NOT NULL DEFAULT 'EMISE',
    "confirme_par" TEXT,
    "confirme_le" TIMESTAMP(3),
    "observation_realisation" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsigneCemaa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsigneCemaa_vol_id_statut_realisation_idx" ON "ConsigneCemaa"("vol_id", "statut_realisation");

-- CreateIndex
CREATE INDEX "ConsigneCemaa_vol_id_escale_base_id_idx" ON "ConsigneCemaa"("vol_id", "escale_base_id");

-- CreateIndex
CREATE INDEX "ConsigneCemaa_autorite_vol_id_idx" ON "ConsigneCemaa"("autorite", "vol_id");

-- AddForeignKey
ALTER TABLE "ConsigneCemaa" ADD CONSTRAINT "ConsigneCemaa_vol_id_fkey" FOREIGN KEY ("vol_id") REFERENCES "Vol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
