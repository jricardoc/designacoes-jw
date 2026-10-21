-- Cor das areas e limite do territorio da congregacao, no mapa geral.
-- IF NOT EXISTS: aditivo e seguro de reaplicar, inclusive num banco que ja recebeu a mudanca
-- por `prisma db push`.

-- AlterTable
ALTER TABLE "Config" ADD COLUMN IF NOT EXISTS "coresAreas" JSONB;
ALTER TABLE "Config" ADD COLUMN IF NOT EXISTS "limiteTerritorio" JSONB;
