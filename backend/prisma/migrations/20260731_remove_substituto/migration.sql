-- DropColumn
-- O papel de substituto deixou de existir: cada turno da escala tem um unico
-- dirigente. A coluna e descartada de proposito, sem backup e sem migrar os
-- nomes para lugar nenhum — nao existe mais campo que os receba.
ALTER TABLE "EscalaDirigente" DROP COLUMN "substituto";
