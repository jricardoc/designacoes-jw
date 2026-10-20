-- Territorios: poligonos do My Maps, saidas, marcacoes por GPS, designacoes e avisos.
-- Idempotente (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS), como a migration anterior.

-- CreateTable
CREATE TABLE IF NOT EXISTS "Territorio" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "area" TEXT,
    "apelidos" TEXT,
    "observacoes" TEXT,
    "cor" TEXT,
    "mymapsMid" TEXT,
    "mymapsCamada" TEXT,
    "cicloDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "naoIniciado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Quadra" (
    "id" SERIAL NOT NULL,
    "territorioId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT,
    "pontos" JSONB NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quadra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RegistroSaida" (
    "id" SERIAL NOT NULL,
    "clientKey" TEXT NOT NULL,
    "territorioId" INTEGER NOT NULL,
    "quadraId" INTEGER,
    "autorId" INTEGER,
    "dia" TEXT NOT NULL,
    "concluiu" BOOLEAN NOT NULL DEFAULT false,
    "ondeParou" TEXT,
    "casaTrabalhada" TEXT,
    "proximoInicio" TEXT,
    "pendente" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroSaida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Marcacao" (
    "id" SERIAL NOT NULL,
    "clientKey" TEXT NOT NULL,
    "territorioId" INTEGER NOT NULL,
    "quadraId" INTEGER,
    "autorId" INTEGER,
    "tipo" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "precisao" DOUBLE PRECISION,
    "texto" TEXT,
    "marcadaEm" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "reconfirmadaEm" TIMESTAMP(3),
    "reconfirmadaPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marcacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DesignacaoTerritorio" (
    "id" SERIAL NOT NULL,
    "territorioId" INTEGER NOT NULL,
    "irmaoId" INTEGER NOT NULL,
    "dia" TEXT NOT NULL,
    "concluidoEm" TEXT,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignacaoTerritorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AvisoTerritorio" (
    "id" SERIAL NOT NULL,
    "territorioId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvisoTerritorio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Territorio_numero_key" ON "Territorio"("numero");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Territorio_mymapsMid_mymapsCamada_idx" ON "Territorio"("mymapsMid", "mymapsCamada");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RegistroSaida_clientKey_key" ON "RegistroSaida"("clientKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RegistroSaida_territorioId_dia_idx" ON "RegistroSaida"("territorioId", "dia");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Marcacao_clientKey_key" ON "Marcacao"("clientKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Marcacao_territorioId_ativo_idx" ON "Marcacao"("territorioId", "ativo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DesignacaoTerritorio_dia_idx" ON "DesignacaoTerritorio"("dia");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DesignacaoTerritorio_territorioId_idx" ON "DesignacaoTerritorio"("territorioId");

-- AddForeignKey
ALTER TABLE "Quadra" DROP CONSTRAINT IF EXISTS "Quadra_territorioId_fkey";
ALTER TABLE "Quadra" ADD CONSTRAINT "Quadra_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "Territorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroSaida" DROP CONSTRAINT IF EXISTS "RegistroSaida_territorioId_fkey";
ALTER TABLE "RegistroSaida" ADD CONSTRAINT "RegistroSaida_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "Territorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroSaida" DROP CONSTRAINT IF EXISTS "RegistroSaida_quadraId_fkey";
ALTER TABLE "RegistroSaida" ADD CONSTRAINT "RegistroSaida_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES "Quadra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroSaida" DROP CONSTRAINT IF EXISTS "RegistroSaida_autorId_fkey";
ALTER TABLE "RegistroSaida" ADD CONSTRAINT "RegistroSaida_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marcacao" DROP CONSTRAINT IF EXISTS "Marcacao_territorioId_fkey";
ALTER TABLE "Marcacao" ADD CONSTRAINT "Marcacao_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "Territorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marcacao" DROP CONSTRAINT IF EXISTS "Marcacao_quadraId_fkey";
ALTER TABLE "Marcacao" ADD CONSTRAINT "Marcacao_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES "Quadra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marcacao" DROP CONSTRAINT IF EXISTS "Marcacao_autorId_fkey";
ALTER TABLE "Marcacao" ADD CONSTRAINT "Marcacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignacaoTerritorio" DROP CONSTRAINT IF EXISTS "DesignacaoTerritorio_territorioId_fkey";
ALTER TABLE "DesignacaoTerritorio" ADD CONSTRAINT "DesignacaoTerritorio_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "Territorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignacaoTerritorio" DROP CONSTRAINT IF EXISTS "DesignacaoTerritorio_irmaoId_fkey";
ALTER TABLE "DesignacaoTerritorio" ADD CONSTRAINT "DesignacaoTerritorio_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisoTerritorio" DROP CONSTRAINT IF EXISTS "AvisoTerritorio_territorioId_fkey";
ALTER TABLE "AvisoTerritorio" ADD CONSTRAINT "AvisoTerritorio_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "Territorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

