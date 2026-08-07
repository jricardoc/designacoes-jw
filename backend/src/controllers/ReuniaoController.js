const prisma = require('../prisma');
const { parseExcel } = require('../services/ExcelReuniaoParser');
const { parsePdf } = require('../services/PdfReuniaoParser');
const { buildIndisponibilidadePreview } = require('../services/MatchIrmaosService');
const { reconciliarSemanas } = require('../utils/semanaReuniao');
const ConviteReuniaoService = require('../services/ConviteReuniaoService');

// Campos editaveis de SemanaReuniao (whitelist para o updateSemana).
// Bloqueia mass assignment em id/reuniaoId/timestamps e colunas nao editaveis.
const CAMPOS_SEMANA_EDITAVEIS = new Set([
    'faixaData', 'dataReuniao', 'leituraSemanal',
    'presidente', 'conselheiroB', 'oracaoInicial', 'oracaoFinal',
    'canticoInicial', 'canticoMeio', 'canticoFinal',
    'tesouro1_titulo', 'tesouro1_irmao', 'tesouro2_titulo', 'tesouro2_irmao',
    'tesouro3_titulo', 'tesouro3_salaB', 'tesouro3_principal',
    'ministerio1_titulo', 'ministerio1_salaB', 'ministerio1_principal',
    'ministerio2_titulo', 'ministerio2_salaB', 'ministerio2_principal',
    'ministerio3_titulo', 'ministerio3_salaB', 'ministerio3_principal',
    'ministerio4_titulo', 'ministerio4_salaB', 'ministerio4_principal',
    'vidaCrista1_titulo', 'vidaCrista1_irmao', 'vidaCrista2_titulo', 'vidaCrista2_irmao',
    'estudoBiblico_dirigente', 'estudoBiblico_leitor',
    'fds_presidente', 'fds_tema', 'fds_orador', 'fds_congregacao', 'fds_leitor',
    'mecanica_audioVideo', 'mecanica_indicadores', 'mecanica_microfone',
    'fds_mecanica_audioVideo', 'fds_mecanica_indicadores', 'fds_mecanica_microfone', 'fds_mecanica_portao',
    'limpeza'
]);

class ReuniaoController {
    /**
     * Lista todas as reuniões agrupadas por mês/ano
     */
    async index(req, res) {
        try {
            const reunioes = await prisma.reuniao.findMany({
                include: {
                    semanas: {
                        orderBy: { id: 'asc' }
                    }
                },
                orderBy: [
                    { ano: 'desc' },
                    { mes: 'desc' }
                ]
            });
            return res.json(reunioes);
        } catch (error) {
            console.error('Erro ao buscar reuniões:', error);
            return res.status(500).json({ error: 'Erro interno ao buscar reuniões' });
        }
    }

    /**
     * Processa o upload da programação (Excel .xlsx/.xls OU PDF) e salva no banco.
     * NÃO aplica indisponibilidades automaticamente — devolve um preview dos irmãos
     * cadastrados que ficarão ocupados, para o usuário revisar e confirmar.
     */
    async import(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            const name = (req.file.originalname || '').toLowerCase();
            const mime = (req.file.mimetype || '').toLowerCase();
            const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
            const isExcel =
                mime.includes('sheet') ||
                mime.includes('excel') ||
                name.endsWith('.xlsx') ||
                name.endsWith('.xls');

            let parsed;
            if (isPdf) {
                parsed = await parsePdf(req.file.buffer);
            } else if (isExcel) {
                parsed = parseExcel(req.file.buffer);
            } else {
                return res.status(400).json({
                    error: 'Formato não suportado. Envie um arquivo .pdf, .xlsx ou .xls',
                });
            }

            const { mes, ano } = parsed;
            // O arquivo de origem pode trazer a data da reuniao contradizendo o rotulo da
            // semana (aconteceu com a planilha de marco/2026). Corrigimos o que da para
            // corrigir com seguranca e devolvemos os avisos para quem esta importando.
            const { semanas, avisos: avisosDeData } = reconciliarSemanas(parsed.semanas);

            if (!semanas || semanas.length === 0) {
                return res.status(422).json({
                    error: 'Não foi possível extrair nenhuma semana do arquivo. Verifique se é a programação correta.',
                });
            }

            const upsertReuniao = await prisma.reuniao.upsert({
                where: { mes_ano: { mes, ano } },
                update: {},
                create: { mes, ano },
            });

            await prisma.semanaReuniao.deleteMany({
                where: { reuniaoId: upsertReuniao.id },
            });

            await prisma.semanaReuniao.createMany({
                data: semanas.map((s) => ({ ...s, reuniaoId: upsertReuniao.id })),
            });

            // Preview de indisponibilidades (revisão antes de aplicar).
            let indisponibilidades = { confirmados: [], ambiguos: [] };
            try {
                const irmaosDB = await prisma.irmao.findMany({ select: { id: true, nome: true } });
                indisponibilidades = buildIndisponibilidadePreview(semanas, irmaosDB);
            } catch (previewError) {
                console.error('Erro ao montar preview de indisponibilidade:', previewError);
            }

            return res.json({
                success: true,
                reuniaoId: upsertReuniao.id,
                mes,
                ano,
                message: `${semanas.length} semana(s) importada(s) com sucesso para ${mes}/${ano}`,
                indisponibilidades,
                // Datas que contradiziam o rótulo da semana no arquivo de origem.
                avisos: avisosDeData,
            });
        } catch (error) {
            console.error('Erro na importação da reunião:', error);
            return res.status(500).json({ error: error.message || 'Erro ao processar o arquivo' });
        }
    }

    /**
     * Aplica em massa as indisponibilidades confirmadas pelo usuário.
     * Body: { registros: [{ irmaoId, data, motivo? }] }
     */
    async aplicarIndisponibilidades(req, res) {
        try {
            const { registros } = req.body;
            if (!Array.isArray(registros) || registros.length === 0) {
                return res.status(400).json({ error: 'Nenhum registro informado' });
            }

            const data = registros
                .filter((r) => r && r.irmaoId && r.data)
                .map((r) => ({
                    irmaoId: parseInt(r.irmaoId, 10),
                    data: String(r.data),
                    motivo: r.motivo || 'Parte na Reunião',
                }));

            if (data.length === 0) {
                return res.status(400).json({ error: 'Registros inválidos' });
            }

            const result = await prisma.indisponibilidade.createMany({
                data,
                skipDuplicates: true,
            });

            return res.json({ success: true, criados: result.count });
        } catch (error) {
            console.error('Erro ao aplicar indisponibilidades:', error);
            return res.status(500).json({ error: 'Erro ao aplicar indisponibilidades' });
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.params;
            await prisma.reuniao.delete({ where: { id: parseInt(id) } });
            return res.json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao excluir reunião' });
        }
    }

    async updateSemana(req, res) {
        try {
            const { id } = req.params;
            const { campo, valor } = req.body;

            if (!campo) {
                return res.status(400).json({ error: 'Campo não informado' });
            }

            if (!CAMPOS_SEMANA_EDITAVEIS.has(campo)) {
                return res.status(400).json({ error: 'Campo inválido' });
            }

            const semanaAtualizada = await prisma.semanaReuniao.update({
                where: { id: parseInt(id) },
                data: {
                    [campo]: valor
                }
            });

            return res.json({ success: true, semana: semanaAtualizada });
        } catch (error) {
            console.error('Erro ao atualizar semana:', error);
            return res.status(500).json({ error: 'Erro ao atualizar campo da semana' });
        }
    }

    /**
     * GET /reunioes/semanas/:id/compartilhamentos
     *
     * Os textos prontos para compartilhar (os convites de Zoom), ja formatados.
     * O app so exibe e manda para a folha de compartilhamento — nao monta nada.
     * E por isso que mexer no texto ou no negrito nao pede build novo do app.
     *
     * Leitura: qualquer irmao logado compartilha, nao so administrador.
     */
    async compartilhamentos(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isInteger(id)) {
                return res.status(400).json({ error: 'Semana inválida' });
            }

            const semana = await prisma.semanaReuniao.findUnique({ where: { id } });
            if (!semana) {
                return res.status(404).json({ error: 'Semana não encontrada' });
            }

            return res.json({ opcoes: ConviteReuniaoService.montarOpcoes(semana) });
        } catch (error) {
            console.error('Erro ao montar textos de compartilhamento:', error);
            return res.status(500).json({ error: 'Erro ao montar os textos' });
        }
    }
}

module.exports = new ReuniaoController();
