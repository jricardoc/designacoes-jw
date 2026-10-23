-- Quem assistiu pelo Zoom em cada reuniao (e quem levantou a mao). Aditivo; IF NOT EXISTS
-- para ser seguro de reaplicar num banco que ja recebeu a mudanca por `prisma db push`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "PresencaZoom" (
    "id" SERIAL NOT NULL,
    "assistenciaId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "irmaoId" INTEGER,
    "pessoas" INTEGER NOT NULL DEFAULT 1,
    "levantouMao" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresencaZoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PresencaZoom_assistenciaId_nome_key" ON "PresencaZoom"("assistenciaId", "nome");
CREATE INDEX IF NOT EXISTS "PresencaZoom_irmaoId_idx" ON "PresencaZoom"("irmaoId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PresencaZoom" ADD CONSTRAINT "PresencaZoom_assistenciaId_fkey" FOREIGN KEY ("assistenciaId") REFERENCES "AssistenciaReuniao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "PresencaZoom" ADD CONSTRAINT "PresencaZoom_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
