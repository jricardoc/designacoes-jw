-- Estudo pessoal: o programa de leitura de cada um, os trechos lidos, a lista do que estudar, as
-- sessoes de estudo e a rotina com aviso. So tabelas novas; IF NOT EXISTS / duplicate_object.

-- CreateTable
CREATE TABLE IF NOT EXISTS "EstudoPerfil" (
    "usuarioId" INTEGER NOT NULL,
    "plano" TEXT NOT NULL DEFAULT 'jw',
    "opcao" TEXT NOT NULL DEFAULT 'tudo',
    "inicio" TEXT,
    "ritmo" INTEGER NOT NULL DEFAULT 1,
    "planoB" TEXT,
    "planoBEm" TEXT,
    "sessaoInicio" TIMESTAMP(3),
    "sessaoAssuntoId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstudoPerfil_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LeituraFeita" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "plano" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeituraFeita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EstudoAssunto" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'assunto',
    "link" TEXT,
    "nota" TEXT,
    "estudadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstudoAssunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EstudoSessao" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "dia" TEXT NOT NULL,
    "minutos" INTEGER NOT NULL,
    "assuntoId" INTEGER,
    "titulo" TEXT,
    "resumo" TEXT,
    "aplicacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstudoSessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EstudoRotina" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "dias" INTEGER[],
    "hora" TEXT NOT NULL,
    "avisoMin" INTEGER,
    "avisadoEm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstudoRotina_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LeituraFeita_usuarioId_plano_item_key" ON "LeituraFeita"("usuarioId", "plano", "item");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeituraFeita_usuarioId_dia_idx" ON "LeituraFeita"("usuarioId", "dia");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EstudoAssunto_usuarioId_idx" ON "EstudoAssunto"("usuarioId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EstudoSessao_usuarioId_dia_idx" ON "EstudoSessao"("usuarioId", "dia");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EstudoRotina_usuarioId_idx" ON "EstudoRotina"("usuarioId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "EstudoPerfil" ADD CONSTRAINT "EstudoPerfil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "LeituraFeita" ADD CONSTRAINT "LeituraFeita_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "EstudoAssunto" ADD CONSTRAINT "EstudoAssunto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "EstudoSessao" ADD CONSTRAINT "EstudoSessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "EstudoRotina" ADD CONSTRAINT "EstudoRotina_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
