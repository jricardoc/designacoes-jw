const prisma = require('../prisma');
const { parseExcel } = require('../services/ExcelReuniaoParser');
const { parsePdf } = require('../services/PdfReuniaoParser');
const { buildIndisponibilidadePreview } = require('../services/MatchIrmaosService');
const { reconciliarSemanas, domingoDaSemana } = require('../utils/semanaReuniao');
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
            const reuniaoId = parseInt(id);

            // A assistencia nao tem FK para a semana (sobrevive de proposito a
            // REIMPORTACAO, que recria as semanas). Mas excluir o mes e outra
            // historia: sem isto os registros ficariam orfaos, poluindo a media
            // da tela de Reuniao sem nenhum caminho de UI para remove-los (a
            // folha de assistencia so abre pelo cartao da semana, que morreu).
            // Apaga pelas datas derivadas das semanas do mes — nao por "mes da
            // data", porque o domingo da ultima semana pode cair no mes seguinte.
            const reuniao = await prisma.reuniao.findUnique({
                where: { id: reuniaoId },
                include: { semanas: { select: { dataReuniao: true } } },
            });
            if (reuniao) {
                const ddMMyyyy = (d) =>
                    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                const datas = [];
                for (const s of reuniao.semanas) {
                    const m = String(s.dataReuniao || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                    if (!m) continue;
                    datas.push(`${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`);
                    const fds = domingoDaSemana(s.dataReuniao);
                    if (fds) datas.push(ddMMyyyy(fds));
                }
                if (datas.length > 0) {
                    await prisma.assistenciaReuniao.deleteMany({ where: { data: { in: datas } } });
                }
            }

            await prisma.reuniao.delete({ where: { id: reuniaoId } });
            return res.json({ success: true });
        } catch (error) {
            console.error('Erro ao excluir reunião:', error);
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

            // `faixaData` e a unica coluna NOT NULL editavel: limpar o titulo na tela
            // mandaria null e o Prisma derrubaria a edicao inteira. Vazio e um titulo
            // valido; null nao e.
            const valorFinal = campo === 'faixaData' && (valor === null || valor === undefined)
                ? ''
                : valor;

            const semanaAtualizada = await prisma.semanaReuniao.update({
                where: { id: parseInt(id) },
                data: {
                    [campo]: valorFinal
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

    /**
     * GET /reunioes/assistencias
     *
     * Todos os registros de assistencia, do mais recente para o mais antigo. O
     * app calcula as estatisticas em cima desta lista — sao poucas linhas (duas
     * por semana), nao vale um endpoint de agregacao.
     *
     * Leitura: qualquer irmao logado ve as estatisticas.
     */
    async listarAssistencias(req, res) {
        try {
            const registros = await prisma.assistenciaReuniao.findMany();
            // "dd/MM/yyyy" nao ordena como texto; compara pela chave invertida.
            const chave = (r) => {
                const m = String(r.data).match(/(\d{2})\/(\d{2})\/(\d{4})/);
                return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
            };
            registros.sort((a, b) => chave(b).localeCompare(chave(a)));
            return res.json(registros);
        } catch (error) {
            console.error('Erro ao buscar assistências:', error);
            return res.status(500).json({ error: 'Erro ao buscar assistências' });
        }
    }

    /**
     * PUT /reunioes/assistencias
     *
     * Grava (ou regrava) a assistencia de uma reuniao.
     * Body: { data: "dd/MM/yyyy", tipo: "meio"|"fds", presencial, zoom }
     *
     * Upsert por (data, tipo) de proposito: contar de novo e corrigir o numero
     * e o fluxo normal, nao um conflito.
     */
    async salvarAssistencia(req, res) {
        try {
            const { data, tipo, presencial, zoom } = req.body || {};

            const m = String(data || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!m) {
                return res.status(400).json({ error: 'Data inválida. Use o formato dd/MM/yyyy.' });
            }
            const dia = Number(m[1]);
            const mes = Number(m[2]);
            const valida = new Date(Number(m[3]), mes - 1, dia);
            if (valida.getDate() !== dia || valida.getMonth() !== mes - 1) {
                return res.status(400).json({ error: 'Data inexistente no calendário.' });
            }

            if (tipo !== 'meio' && tipo !== 'fds') {
                return res.status(400).json({ error: 'Tipo inválido. Use "meio" ou "fds".' });
            }

            const contagens = {};
            for (const [campo, valor] of [['presencial', presencial], ['zoom', zoom]]) {
                const n = Number(valor);
                if (!Number.isInteger(n) || n < 0 || n > 5000) {
                    return res.status(400).json({ error: `Valor de "${campo}" inválido: informe um número inteiro entre 0 e 5000.` });
                }
                contagens[campo] = n;
            }

            const assistencia = await prisma.assistenciaReuniao.upsert({
                where: { data_tipo: { data, tipo } },
                update: contagens,
                create: { data, tipo, ...contagens },
            });

            return res.json({ success: true, assistencia });
        } catch (error) {
            console.error('Erro ao salvar assistência:', error);
            return res.status(500).json({ error: 'Erro ao salvar assistência' });
        }
    }

    /**
     * DELETE /reunioes/assistencias/:id
     *
     * Remove um registro (contagem lançada na semana errada, por exemplo).
     */
    async excluirAssistencia(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isInteger(id)) {
                return res.status(400).json({ error: 'Registro inválido' });
            }
            await prisma.assistenciaReuniao.delete({ where: { id } });
            return res.json({ success: true });
        } catch (error) {
            // P2025 = registro ja nao existe; para quem apagou, deu no mesmo.
            if (error && error.code === 'P2025') {
                return res.status(404).json({ error: 'Registro não encontrado' });
            }
            console.error('Erro ao excluir assistência:', error);
            return res.status(500).json({ error: 'Erro ao excluir assistência' });
        }
    }
}

module.exports = new ReuniaoController();
