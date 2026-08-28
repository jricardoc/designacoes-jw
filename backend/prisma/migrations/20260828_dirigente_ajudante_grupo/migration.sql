-- Dirigente e ajudante do grupo. Aditivo: duas colunas opcionais e suas chaves
-- estrangeiras, que o `db push` aplica sem reclamar.

-- AlterTable
ALTER TABLE "GrupoCampo" ADD COLUMN     "ajudanteId" INTEGER,
ADD COLUMN     "dirigenteId" INTEGER;

-- AddForeignKey
ALTER TABLE "GrupoCampo" ADD CONSTRAINT "GrupoCampo_dirigenteId_fkey" FOREIGN KEY ("dirigenteId") REFERENCES "Irmao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoCampo" ADD CONSTRAINT "GrupoCampo_ajudanteId_fkey" FOREIGN KEY ("ajudanteId") REFERENCES "Irmao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

