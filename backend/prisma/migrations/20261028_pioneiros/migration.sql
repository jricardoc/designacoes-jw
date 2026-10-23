-- Area de pioneiros: meta e cronometro, horas, revisitas (e estudos) e as visitas de cada uma.
-- Aditivo; IF NOT EXISTS / duplicate_object para ser seguro de reaplicar.

-- CreateTable
CREATE TABLE IF NOT EXISTS "PioneiroPerfil" (
    "irmaoId" INTEGER NOT NULL,
    "metaMensal" INTEGER NOT NULL DEFAULT 50,
    "cronometroInicio" TIMESTAMP(3),
    "cronometroSeg" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PioneiroPerfil_pkey" PRIMARY KEY ("irmaoId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PioneiroHoras" (
    "id" SERIAL NOT NULL,
    "irmaoId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "minutos" INTEGER NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PioneiroHoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Revisita" (
    "id" SERIAL NOT NULL,
    "irmaoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "telefone" TEXT,
    "observacao" TEXT,
    "estudo" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "proximaVisita" TIMESTAMP(3),
    "lembreteEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Revisita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RevisitaVisita" (
    "id" SERIAL NOT NULL,
    "revisitaId" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisitaVisita_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PioneiroHoras_irmaoId_data_idx" ON "PioneiroHoras"("irmaoId", "data");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Revisita_irmaoId_idx" ON "Revisita"("irmaoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Revisita_proximaVisita_idx" ON "Revisita"("proximaVisita");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RevisitaVisita_revisitaId_idx" ON "RevisitaVisita"("revisitaId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PioneiroPerfil" ADD CONSTRAINT "PioneiroPerfil_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PioneiroHoras" ADD CONSTRAINT "PioneiroHoras_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Revisita" ADD CONSTRAINT "Revisita_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "RevisitaVisita" ADD CONSTRAINT "RevisitaVisita_revisitaId_fkey" FOREIGN KEY ("revisitaId") REFERENCES "Revisita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
