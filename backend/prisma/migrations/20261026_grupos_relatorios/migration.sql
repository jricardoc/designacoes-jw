-- Grupos de campo com local, pioneiro regular no cadastro e o relatorio de servico de campo.
-- Aditivo; IF NOT EXISTS / duplicate_object para ser seguro de reaplicar num banco que ja
-- recebeu a mudanca por `prisma db push`.

-- AlterTable
ALTER TABLE "GrupoCampo" ADD COLUMN IF NOT EXISTS "local" TEXT;
ALTER TABLE "Irmao" ADD COLUMN IF NOT EXISTS "pioneiro" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RelatorioCampo" (
    "id" SERIAL NOT NULL,
    "irmaoId" INTEGER NOT NULL,
    "mes" TEXT NOT NULL,
    "participou" BOOLEAN NOT NULL DEFAULT false,
    "estudos" INTEGER NOT NULL DEFAULT 0,
    "horas" INTEGER,
    "pioneiroAuxiliar" BOOLEAN NOT NULL DEFAULT false,
    "pioneiroRegular" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "grupoId" INTEGER,
    "registradoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatorioCampo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RelatorioGrupoMes" (
    "id" SERIAL NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "mes" TEXT NOT NULL,
    "concluidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioGrupoMes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RelatorioCampo_mes_idx" ON "RelatorioCampo"("mes");
CREATE UNIQUE INDEX IF NOT EXISTS "RelatorioCampo_irmaoId_mes_key" ON "RelatorioCampo"("irmaoId", "mes");
CREATE UNIQUE INDEX IF NOT EXISTS "RelatorioGrupoMes_grupoId_mes_key" ON "RelatorioGrupoMes"("grupoId", "mes");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "RelatorioCampo" ADD CONSTRAINT "RelatorioCampo_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "RelatorioGrupoMes" ADD CONSTRAINT "RelatorioGrupoMes_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoCampo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- O secretario da congregacao (ve todos os grupos e recebe o aviso de cada grupo concluido).
ALTER TABLE "Config" ADD COLUMN IF NOT EXISTS "secretarioIrmaoId" INTEGER;
