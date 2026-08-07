-- CreateTable
CREATE TABLE "NotificacaoEnviada" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacaoEnviada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificacaoEnviada_usuarioId_createdAt_idx" ON "NotificacaoEnviada"("usuarioId", "createdAt");

-- AddForeignKey
ALTER TABLE "NotificacaoEnviada" ADD CONSTRAINT "NotificacaoEnviada_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

