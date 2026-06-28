const prisma = require('../prisma');
const { parseExcel } = require('../services/ExcelReuniaoParser');
const { parsePdf } = require('../services/PdfReuniaoParser');
const { buildIndisponibilidadePreview } = require('../services/MatchIrmaosService');

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

            const { mes, ano, semanas } = parsed;
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

    async debugDump(req, res) {
        try {
            const xlsx = require('xlsx');
            const fs = require('fs');
            const filePath = '/app/Programacao.xlsx';
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: "Programacao.xlsx não encontrado no /app" });
            }
            const workbook = xlsx.readFile(filePath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });
            return res.json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
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
}

module.exports = new ReuniaoController();
