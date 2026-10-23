-- App do Ministerio: tipo de cada visita, compartilhar os planos com os companheiros, planos de
-- saida (Agenda) e viagens (quilometragem). Aditivo; IF NOT EXISTS / duplicate_object.

-- AlterTable
ALTER TABLE "PioneiroPerfil" ADD COLUMN IF NOT EXISTS "compartilharPlanos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PioneiroPerfil" ADD COLUMN IF NOT EXISTS "calendarioToken" TEXT;

-- AlterTable
ALTER TABLE "RevisitaVisita" ADD COLUMN IF NOT EXISTS "tipo" TEXT NOT NULL DEFAULT 'conversa';

-- CreateTable
CREATE TABLE IF NOT EXISTS "PioneiroPlano" (
    "id" SERIAL NOT NULL,
    "irmaoId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "hora" TEXT NOT NULL,
    "duracaoMin" INTEGER NOT NULL DEFAULT 120,
    "local" TEXT,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PioneiroPlano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PioneiroViagem" (
    "id" SERIAL NOT NULL,
    "irmaoId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "km" DOUBLE PRECISION NOT NULL,
    "custo" DOUBLE PRECISION,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PioneiroViagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PioneiroPlano_data_idx" ON "PioneiroPlano"("data");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PioneiroPlano_irmaoId_idx" ON "PioneiroPlano"("irmaoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PioneiroViagem_irmaoId_data_idx" ON "PioneiroViagem"("irmaoId", "data");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PioneiroPlano" ADD CONSTRAINT "PioneiroPlano_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PioneiroViagem" ADD CONSTRAINT "PioneiroViagem_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PioneiroPerfil_calendarioToken_key" ON "PioneiroPerfil"("calendarioToken");
