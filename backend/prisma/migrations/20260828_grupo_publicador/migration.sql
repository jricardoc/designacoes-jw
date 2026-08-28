-- Grupo de campo do publicador. Aditivo: coluna nova e opcional, que o `db push` da
-- producao aplica sem reclamar (ver o comentario em CarrinhoEscala sobre o que ele recusa).

-- AlterTable
ALTER TABLE "Irmao" ADD COLUMN     "grupo" TEXT;

