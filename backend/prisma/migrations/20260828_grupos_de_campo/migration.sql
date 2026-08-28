-- Grupos de campo: tabela propria e chave estrangeira no publicador.
--
-- Seguro para o `db push` da producao: so ADD COLUMN, CREATE TABLE e uma UNIQUE na tabela
-- NOVA (que ele aceita — o que ele recusa e UNIQUE em tabela que ja tem linhas). Nada e
-- removido: a coluna `grupo`, de texto livre, fica orfa ate um ALTER a mao.

-- AlterTable
ALTER TABLE "Irmao" ADD COLUMN     "grupoId" INTEGER;

-- CreateTable
CREATE TABLE "GrupoCampo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrupoCampo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrupoCampo_nome_key" ON "GrupoCampo"("nome");

-- AddForeignKey
ALTER TABLE "Irmao" ADD CONSTRAINT "Irmao_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoCampo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

