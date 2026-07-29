-- CreateTable
CREATE TABLE "CarrinhoPonto" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#8A8071',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrinhoPonto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrinhoPublicador" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrinhoPublicador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrinhoTurno" (
    "id" SERIAL NOT NULL,
    "pontoId" INTEGER NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrinhoTurno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrinhoEscala" (
    "id" SERIAL NOT NULL,
    "turnoId" INTEGER NOT NULL,
    "publicadorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarrinhoEscala_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarrinhoPonto_nome_key" ON "CarrinhoPonto"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CarrinhoPublicador_nome_key" ON "CarrinhoPublicador"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CarrinhoTurno_pontoId_diaSemana_horaInicio_key" ON "CarrinhoTurno"("pontoId", "diaSemana", "horaInicio");

-- CreateIndex
CREATE UNIQUE INDEX "CarrinhoEscala_turnoId_publicadorId_key" ON "CarrinhoEscala"("turnoId", "publicadorId");

-- AddForeignKey
ALTER TABLE "CarrinhoTurno" ADD CONSTRAINT "CarrinhoTurno_pontoId_fkey" FOREIGN KEY ("pontoId") REFERENCES "CarrinhoPonto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrinhoEscala" ADD CONSTRAINT "CarrinhoEscala_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "CarrinhoTurno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrinhoEscala" ADD CONSTRAINT "CarrinhoEscala_publicadorId_fkey" FOREIGN KEY ("publicadorId") REFERENCES "CarrinhoPublicador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

