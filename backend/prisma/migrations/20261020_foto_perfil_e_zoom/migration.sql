-- Foto de perfil e dados do Zoom na configuracao.
-- IF NOT EXISTS: aditivo e seguro de reaplicar, inclusive num banco que ja recebeu a mudanca
-- por `prisma db push`.

-- AlterTable
ALTER TABLE "Config" ADD COLUMN IF NOT EXISTS "zoom" JSONB;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "fotoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotoUsuario" (
    "usuarioId" INTEGER NOT NULL,
    "imagem" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotoUsuario_pkey" PRIMARY KEY ("usuarioId")
);

-- AddForeignKey
ALTER TABLE "FotoUsuario" DROP CONSTRAINT IF EXISTS "FotoUsuario_usuarioId_fkey";
ALTER TABLE "FotoUsuario" ADD CONSTRAINT "FotoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
