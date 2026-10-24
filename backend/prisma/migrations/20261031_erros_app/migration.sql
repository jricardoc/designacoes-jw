-- Erros do app: o que quebrou no celular de alguem, para o admin ver em Ajustes. So tabela nova;
-- IF NOT EXISTS para poder rodar de novo.

-- CreateTable
CREATE TABLE IF NOT EXISTS "ErroApp" (
    "id" SERIAL NOT NULL,
    "assinatura" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "pilha" TEXT,
    "tela" TEXT,
    "fatal" BOOLEAN NOT NULL DEFAULT false,
    "plataforma" TEXT,
    "versaoApp" TEXT,
    "updateId" TEXT,
    "canal" TEXT,
    "vezes" INTEGER NOT NULL DEFAULT 1,
    "usuarioId" INTEGER,
    "primeiraEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErroApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ErroApp_assinatura_key" ON "ErroApp"("assinatura");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ErroApp_ultimaEm_idx" ON "ErroApp"("ultimaEm");
