-- CreateTable
CREATE TABLE "AssistenciaReuniao" (
    "id" SERIAL NOT NULL,
    "data" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "presencial" INTEGER NOT NULL DEFAULT 0,
    "zoom" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistenciaReuniao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistenciaReuniao_data_tipo_key" ON "AssistenciaReuniao"("data", "tipo");
