-- Horario das reunioes: sem ele nao existe instante de onde subtrair "3 horas antes".
-- Aditivo e com DEFAULT, entao as linhas existentes de Config ja nascem preenchidas.
ALTER TABLE "Config" ADD COLUMN IF NOT EXISTS "horaMeioSemana" TEXT NOT NULL DEFAULT '19:30';
ALTER TABLE "Config" ADD COLUMN IF NOT EXISTS "horaFimDeSemana" TEXT NOT NULL DEFAULT '09:00';

-- CreateTable
CREATE TABLE IF NOT EXISTS "PreferenciaNotificacao" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipos" TEXT[],
    "antecedencias" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenciaNotificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PreferenciaNotificacao_usuarioId_key" ON "PreferenciaNotificacao"("usuarioId");

-- AddForeignKey
ALTER TABLE "PreferenciaNotificacao" DROP CONSTRAINT IF EXISTS "PreferenciaNotificacao_usuarioId_fkey";
ALTER TABLE "PreferenciaNotificacao" ADD CONSTRAINT "PreferenciaNotificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A trava de idempotencia passa a ser por regra: o irmao pode pedir "1 semana antes" E
-- "1 dia antes" do mesmo dia, e a chave antiga deixaria so o primeiro passar.
-- As linhas ja gravadas viram '1d', que era a unica regra que existia.
ALTER TABLE "LembreteEnviado" ADD COLUMN IF NOT EXISTS "regra" TEXT NOT NULL DEFAULT '1d';
-- As duas formas: a migration versionada criou a chave antiga como INDEX, mas o `db push`
-- do EasyPanel pode te-la criado como CONSTRAINT. Derrubar so uma das duas deixaria a antiga
-- de pe e o irmao receberia apenas o primeiro lembrete do dia.
ALTER TABLE "LembreteEnviado" DROP CONSTRAINT IF EXISTS "LembreteEnviado_usuarioId_dataISO_key";
DROP INDEX IF EXISTS "LembreteEnviado_usuarioId_dataISO_key";
CREATE UNIQUE INDEX IF NOT EXISTS "LembreteEnviado_usuarioId_dataISO_regra_key" ON "LembreteEnviado"("usuarioId", "dataISO", "regra");
