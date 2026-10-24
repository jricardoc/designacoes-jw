-- Revisitas e visitas anotadas sem internet: o celular manda um clientKey, e o reenvio da fila nao
-- duplica. Colunas novas e nulas, com indice comum: o `db push` da producao recusa UNIQUE em tabela
-- que ja existe. IF NOT EXISTS para poder rodar de novo.

-- AlterTable
ALTER TABLE "Revisita" ADD COLUMN IF NOT EXISTS "clientKey" TEXT;

-- AlterTable
ALTER TABLE "RevisitaVisita" ADD COLUMN IF NOT EXISTS "clientKey" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Revisita_clientKey_idx" ON "Revisita"("clientKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RevisitaVisita_clientKey_idx" ON "RevisitaVisita"("clientKey");
