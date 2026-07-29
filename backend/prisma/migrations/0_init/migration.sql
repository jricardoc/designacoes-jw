-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Quadro" (
    "id" SERIAL NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quadro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designacao" (
    "id" SERIAL NOT NULL,
    "quadroId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "irmao1" TEXT NOT NULL,
    "irmao2" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Historico" (
    "id" SERIAL NOT NULL,
    "quadroId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "acao" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "campo" TEXT,
    "valorAntigo" TEXT,
    "valorNovo" TEXT,
    "designacaoInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "subtitulo" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nickname" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "irmaoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Irmao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "funcoes" TEXT[],
    "nivelAudioVideo" TEXT NOT NULL DEFAULT 'experiente',
    "privilegio" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Irmao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indisponibilidade" (
    "id" SERIAL NOT NULL,
    "irmaoId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Indisponibilidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reuniao" (
    "id" SERIAL NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reuniao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemanaReuniao" (
    "id" SERIAL NOT NULL,
    "reuniaoId" INTEGER NOT NULL,
    "faixaData" TEXT NOT NULL,
    "dataReuniao" TEXT,
    "leituraSemanal" TEXT,
    "presidente" TEXT,
    "conselheiroB" TEXT,
    "oracaoInicial" TEXT,
    "oracaoFinal" TEXT,
    "canticoInicial" TEXT,
    "canticoMeio" TEXT,
    "canticoFinal" TEXT,
    "tesouro1_titulo" TEXT,
    "tesouro1_irmao" TEXT,
    "tesouro2_titulo" TEXT,
    "tesouro2_irmao" TEXT,
    "tesouro3_titulo" TEXT,
    "tesouro3_salaB" TEXT,
    "tesouro3_principal" TEXT,
    "ministerio1_titulo" TEXT,
    "ministerio1_salaB" TEXT,
    "ministerio1_principal" TEXT,
    "ministerio2_titulo" TEXT,
    "ministerio2_salaB" TEXT,
    "ministerio2_principal" TEXT,
    "ministerio3_titulo" TEXT,
    "ministerio3_salaB" TEXT,
    "ministerio3_principal" TEXT,
    "ministerio4_titulo" TEXT,
    "ministerio4_salaB" TEXT,
    "ministerio4_principal" TEXT,
    "vidaCrista1_titulo" TEXT,
    "vidaCrista1_irmao" TEXT,
    "vidaCrista2_titulo" TEXT,
    "vidaCrista2_irmao" TEXT,
    "estudoBiblico_dirigente" TEXT,
    "estudoBiblico_leitor" TEXT,
    "fds_presidente" TEXT,
    "fds_tema" TEXT,
    "fds_orador" TEXT,
    "fds_congregacao" TEXT,
    "fds_leitor" TEXT,
    "mecanica_audioVideo" TEXT,
    "mecanica_indicadores" TEXT,
    "mecanica_microfone" TEXT,
    "fds_mecanica_audioVideo" TEXT,
    "fds_mecanica_indicadores" TEXT,
    "fds_mecanica_microfone" TEXT,
    "fds_mecanica_portao" TEXT,
    "limpeza" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SemanaReuniao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaidaCampo" (
    "id" SERIAL NOT NULL,
    "diaSemana" TEXT NOT NULL,
    "turno" INTEGER NOT NULL DEFAULT 1,
    "local" TEXT NOT NULL,
    "horario" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaidaCampo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirigenteSaidaCampo" (
    "id" SERIAL NOT NULL,
    "irmaoId" INTEGER NOT NULL,
    "saidaCampoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirigenteSaidaCampo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuadroDirigente" (
    "id" SERIAL NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuadroDirigente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalaDirigente" (
    "id" SERIAL NOT NULL,
    "quadroId" INTEGER NOT NULL,
    "saidaCampoId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "principal" TEXT NOT NULL DEFAULT '',
    "substituto" TEXT NOT NULL DEFAULT '',
    "removido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalaDirigente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quadro_mes_ano_key" ON "Quadro"("mes", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_nickname_key" ON "Usuario"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_irmaoId_key" ON "Usuario"("irmaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Irmao_nome_key" ON "Irmao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Indisponibilidade_irmaoId_data_key" ON "Indisponibilidade"("irmaoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Reuniao_mes_ano_key" ON "Reuniao"("mes", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "DirigenteSaidaCampo_irmaoId_saidaCampoId_key" ON "DirigenteSaidaCampo"("irmaoId", "saidaCampoId");

-- CreateIndex
CREATE UNIQUE INDEX "QuadroDirigente_mes_ano_key" ON "QuadroDirigente"("mes", "ano");

-- AddForeignKey
ALTER TABLE "Designacao" ADD CONSTRAINT "Designacao_quadroId_fkey" FOREIGN KEY ("quadroId") REFERENCES "Quadro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_quadroId_fkey" FOREIGN KEY ("quadroId") REFERENCES "Quadro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indisponibilidade" ADD CONSTRAINT "Indisponibilidade_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemanaReuniao" ADD CONSTRAINT "SemanaReuniao_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "Reuniao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirigenteSaidaCampo" ADD CONSTRAINT "DirigenteSaidaCampo_irmaoId_fkey" FOREIGN KEY ("irmaoId") REFERENCES "Irmao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirigenteSaidaCampo" ADD CONSTRAINT "DirigenteSaidaCampo_saidaCampoId_fkey" FOREIGN KEY ("saidaCampoId") REFERENCES "SaidaCampo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaDirigente" ADD CONSTRAINT "EscalaDirigente_quadroId_fkey" FOREIGN KEY ("quadroId") REFERENCES "QuadroDirigente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaDirigente" ADD CONSTRAINT "EscalaDirigente_saidaCampoId_fkey" FOREIGN KEY ("saidaCampoId") REFERENCES "SaidaCampo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

