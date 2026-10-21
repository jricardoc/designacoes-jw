-- Links de instalar o app (Android e iPhone), guardados pelo webhook do EAS a cada build.
-- IF NOT EXISTS: aditivo e seguro de reaplicar, inclusive num banco que ja recebeu a mudanca
-- por `prisma db push`.

-- AlterTable
ALTER TABLE "Config" ADD COLUMN IF NOT EXISTS "linksDownload" JSONB;
