-- Confirmacao das partes de estudante + inicio da unificacao das pessoas.
--
-- Tudo ADITIVO de proposito. O unico ALTER que nao acrescenta e o DROP NOT NULL de
-- CarrinhoEscala.publicadorId, que e um alargamento: linhas existentes continuam validas.
--
-- Nada e removido aqui. CarrinhoPublicador e publicadorId so saem depois que
-- `npm run unificar:pessoas` rodar em producao e o resultado for conferido.
--
-- Sem a UNIQUE de (turnoId, irmaoId) de proposito: a producao aplica o schema com
-- `prisma db push`, que recusa criar constraint UNIQUE e derruba o boot em loop. Ver o
-- comentario em CarrinhoEscala no schema.prisma.

-- AlterTable
ALTER TABLE "Irmao" ADD COLUMN     "genero" TEXT,
ADD COLUMN     "telefone" TEXT;

-- AlterTable
ALTER TABLE "CarrinhoEscala" ADD COLUMN     "irmaoId" INTEGER,
ALTER COLUMN "publicadorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ConfirmacaoDesignacao" (
    "id" SERIAL NOT NULL,
    "data" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "confirmou" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfirmacaoDesignacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfirmacaoDesignacao_data_campo_nome_key" ON "ConfirmacaoDesignacao"("data", "campo", "nome");

-- AddForeignKey
ALTER TABLE "CarrinhoEscala" ADD CONSTRAINT "CarrinhoEscala_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

