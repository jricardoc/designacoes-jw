-- Integracao com o Zoom: as ocorrencias de reuniao (por UUID), os participantes, a fila de
-- sincronizacao e os eventos recebidos pelo webhook. Aditivo; IF NOT EXISTS / duplicate_object
-- para ser seguro de reaplicar.

-- CreateTable
CREATE TABLE IF NOT EXISTS "ZoomReuniao" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "accountId" TEXT,
    "hostId" TEXT,
    "hostEmail" TEXT,
    "topico" TEXT,
    "inicio" TIMESTAMP(3),
    "fim" TIMESTAMP(3),
    "duracaoMin" INTEGER,
    "fuso" TEXT,
    "resumoTitulo" TEXT,
    "resumoMarkdown" TEXT,
    "resumoBruto" JSONB,
    "resumoEditadoEm" TIMESTAMP(3),
    "resumoDocUrl" TEXT,
    "topicos" JSONB,
    "decisoes" JSONB,
    "proximosPassos" JSONB,
    "transcricao" TEXT,
    "transcricaoBruta" JSONB,
    "participantesQtd" INTEGER,
    "sincronizadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoomReuniao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ZoomParticipante" (
    "id" SERIAL NOT NULL,
    "reuniaoId" INTEGER NOT NULL,
    "zoomUserId" TEXT,
    "participanteId" TEXT,
    "nome" TEXT NOT NULL,
    "entrada" TIMESTAMP(3),
    "saida" TIMESTAMP(3),
    "duracaoSeg" INTEGER,
    "status" TEXT,
    "irmaoId" INTEGER,

    CONSTRAINT "ZoomParticipante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ZoomSincronizacao" (
    "id" SERIAL NOT NULL,
    "reuniaoId" INTEGER NOT NULL,
    "parte" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximaTentativa" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoErro" TEXT,
    "concluidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoomSincronizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ZoomEvento" (
    "id" SERIAL NOT NULL,
    "chave" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "meetingUuid" TEXT,
    "meetingId" TEXT,
    "accountId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'recebido',
    "ultimoErro" TEXT,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicadoEm" TIMESTAMP(3),

    CONSTRAINT "ZoomEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ZoomReuniao_uuid_key" ON "ZoomReuniao"("uuid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ZoomReuniao_inicio_idx" ON "ZoomReuniao"("inicio");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ZoomReuniao_meetingId_idx" ON "ZoomReuniao"("meetingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ZoomParticipante_reuniaoId_idx" ON "ZoomParticipante"("reuniaoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ZoomSincronizacao_status_proximaTentativa_idx" ON "ZoomSincronizacao"("status", "proximaTentativa");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ZoomSincronizacao_reuniaoId_parte_key" ON "ZoomSincronizacao"("reuniaoId", "parte");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ZoomEvento_chave_key" ON "ZoomEvento"("chave");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ZoomEvento_status_idx" ON "ZoomEvento"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ZoomEvento_meetingUuid_idx" ON "ZoomEvento"("meetingUuid");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ZoomParticipante" ADD CONSTRAINT "ZoomParticipante_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "ZoomReuniao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ZoomParticipante" ADD CONSTRAINT "ZoomParticipante_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ZoomSincronizacao" ADD CONSTRAINT "ZoomSincronizacao_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "ZoomReuniao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
