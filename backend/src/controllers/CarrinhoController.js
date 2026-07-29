const prisma = require('../prisma');

/**
 * Carrinho de publicações.
 *
 * Os turnos são fixos e semanais — não há quadro mensal. A tela mostra a grade
 * (ponto × dia × faixa de horário) e o CRUD abaixo cobre pontos, turnos, quem
 * serve em cada turno e o cadastro de publicadores.
 *
 * `GET /carrinho/agenda` existe para a automação de lembretes (n8n + Evolution
 * API): devolve, já achatado, quem serve num dia da semana com nome e telefone,
 * sem precisar montar a grade do lado de fora.
 */

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Ordena por dia da semana e, dentro do dia, pelo horário de início. */
const compararTurnos = (a, b) =>
    a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio);

function validarTurno({ diaSemana, horaInicio, horaFim }) {
    const dia = Number(diaSemana);
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) return 'Dia da semana inválido';
    if (!HORA.test(String(horaInicio || ''))) return 'Hora de início inválida (use HH:MM)';
    if (!HORA.test(String(horaFim || ''))) return 'Hora de término inválida (use HH:MM)';
    if (String(horaFim) <= String(horaInicio)) return 'O término precisa ser depois do início';
    return null;
}

class CarrinhoController {
    // ==================== GRADE ====================

    /** Tudo que a tela precisa numa chamada: pontos, turnos, quem serve e o cadastro. */
    async index(req, res) {
        try {
            const [pontos, publicadores] = await Promise.all([
                prisma.carrinhoPonto.findMany({
                    include: {
                        turnos: {
                            include: {
                                escalas: {
                                    include: {
                                        publicador: { select: { id: true, nome: true, telefone: true, ativo: true } },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
                }),
                prisma.carrinhoPublicador.findMany({ orderBy: { nome: 'asc' } }),
            ]);

            const resposta = pontos.map(p => ({
                id: p.id,
                nome: p.nome,
                cor: p.cor,
                ativo: p.ativo,
                ordem: p.ordem,
                turnos: p.turnos
                    .slice()
                    .sort(compararTurnos)
                    .map(t => ({
                        id: t.id,
                        diaSemana: t.diaSemana,
                        diaSemanaNome: DIAS[t.diaSemana],
                        horaInicio: t.horaInicio,
                        horaFim: t.horaFim,
                        publicadores: t.escalas
                            .map(e => e.publicador)
                            .sort((a, b) => a.nome.localeCompare(b.nome)),
                    })),
            }));

            return res.json({ pontos: resposta, publicadores, dias: DIAS });
        } catch (error) {
            console.error('Erro ao carregar o carrinho:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    /**
     * GET /carrinho/agenda?dia=2&hora=14:00
     *
     * Pensado para a automação de lembretes. Sem parâmetros devolve a semana toda.
     * A lista vem achatada (um item por turno, com as pessoas e os telefones), que
     * é o formato que um fluxo do n8n consegue iterar direto.
     */
    async agenda(req, res) {
        try {
            const filtro = { ponto: { ativo: true } };

            if (req.query.dia !== undefined) {
                const dia = Number(req.query.dia);
                if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
                    return res.status(400).json({ error: 'Parâmetro "dia" deve ser 0 (domingo) a 6 (sábado)' });
                }
                filtro.diaSemana = dia;
            }
            if (req.query.hora !== undefined) {
                if (!HORA.test(String(req.query.hora))) {
                    return res.status(400).json({ error: 'Parâmetro "hora" deve estar no formato HH:MM' });
                }
                filtro.horaInicio = String(req.query.hora);
            }

            const turnos = await prisma.carrinhoTurno.findMany({
                where: filtro,
                include: {
                    ponto: { select: { id: true, nome: true, cor: true } },
                    escalas: {
                        include: { publicador: { select: { id: true, nome: true, telefone: true, ativo: true } } },
                    },
                },
            });

            const agenda = turnos
                .slice()
                .sort((a, b) => compararTurnos(a, b) || a.ponto.nome.localeCompare(b.ponto.nome))
                .map(t => ({
                    turnoId: t.id,
                    ponto: t.ponto.nome,
                    diaSemana: t.diaSemana,
                    diaSemanaNome: DIAS[t.diaSemana],
                    horaInicio: t.horaInicio,
                    horaFim: t.horaFim,
                    // Só quem está ativo entra: uma pessoa desativada não deve
                    // receber lembrete, mas continua no histórico do turno.
                    publicadores: t.escalas
                        .map(e => e.publicador)
                        .filter(p => p.ativo)
                        .map(p => ({ id: p.id, nome: p.nome, telefone: p.telefone || null }))
                        .sort((a, b) => a.nome.localeCompare(b.nome)),
                }));

            return res.json({ total: agenda.length, agenda });
        } catch (error) {
            console.error('Erro ao montar a agenda do carrinho:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // ==================== PONTOS ====================

    async criarPonto(req, res) {
        try {
            const { nome, cor, ordem } = req.body;
            if (!nome || !String(nome).trim()) {
                return res.status(400).json({ error: 'Nome do ponto é obrigatório' });
            }

            const ponto = await prisma.carrinhoPonto.create({
                data: {
                    nome: String(nome).trim(),
                    cor: cor || '#8A8071',
                    ordem: Number.isInteger(Number(ordem)) ? Number(ordem) : 0,
                },
            });
            return res.status(201).json(ponto);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Já existe um ponto com esse nome' });
            }
            console.error('Erro ao criar ponto:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    async atualizarPonto(req, res) {
        try {
            const { nome, cor, ordem, ativo } = req.body;
            const data = {};
            if (nome !== undefined) data.nome = String(nome).trim();
            if (cor !== undefined) data.cor = cor;
            if (ordem !== undefined) data.ordem = Number(ordem) || 0;
            if (ativo !== undefined) data.ativo = Boolean(ativo);

            const ponto = await prisma.carrinhoPonto.update({
                where: { id: parseInt(req.params.id) },
                data,
            });
            return res.json(ponto);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Já existe um ponto com esse nome' });
            }
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Ponto não encontrado' });
            }
            console.error('Erro ao atualizar ponto:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    async excluirPonto(req, res) {
        try {
            // Cascata no schema: some com os turnos e as escalas do ponto, mas nunca
            // com o cadastro de publicadores.
            await prisma.carrinhoPonto.delete({ where: { id: parseInt(req.params.id) } });
            return res.status(204).send();
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Ponto não encontrado' });
            }
            console.error('Erro ao excluir ponto:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // ==================== TURNOS ====================

    async criarTurno(req, res) {
        try {
            const { pontoId, diaSemana, horaInicio, horaFim, publicadorIds } = req.body;

            const erro = validarTurno({ diaSemana, horaInicio, horaFim });
            if (erro) return res.status(400).json({ error: erro });

            const ponto = await prisma.carrinhoPonto.findUnique({ where: { id: parseInt(pontoId) } });
            if (!ponto) return res.status(400).json({ error: 'Ponto não encontrado' });

            const turno = await prisma.carrinhoTurno.create({
                data: {
                    pontoId: ponto.id,
                    diaSemana: Number(diaSemana),
                    horaInicio,
                    horaFim,
                    escalas: {
                        create: [...new Set(publicadorIds || [])].map(id => ({ publicadorId: Number(id) })),
                    },
                },
                include: { escalas: { include: { publicador: true } } },
            });
            return res.status(201).json(turno);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Esse ponto já tem um turno nesse dia e horário' });
            }
            console.error('Erro ao criar turno:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    async atualizarTurno(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { diaSemana, horaInicio, horaFim, publicadorIds } = req.body;

            const atual = await prisma.carrinhoTurno.findUnique({ where: { id } });
            if (!atual) return res.status(404).json({ error: 'Turno não encontrado' });

            const novo = {
                diaSemana: diaSemana !== undefined ? Number(diaSemana) : atual.diaSemana,
                horaInicio: horaInicio !== undefined ? horaInicio : atual.horaInicio,
                horaFim: horaFim !== undefined ? horaFim : atual.horaFim,
            };
            const erro = validarTurno(novo);
            if (erro) return res.status(400).json({ error: erro });

            // A lista de quem serve é substituída inteira: é como a tela edita, e
            // evita ter que descobrir do lado do cliente quem entrou e quem saiu.
            const turno = await prisma.$transaction(async (tx) => {
                if (publicadorIds !== undefined) {
                    await tx.carrinhoEscala.deleteMany({ where: { turnoId: id } });
                    const ids = [...new Set(publicadorIds)].map(Number).filter(Number.isInteger);
                    if (ids.length > 0) {
                        await tx.carrinhoEscala.createMany({
                            data: ids.map(publicadorId => ({ turnoId: id, publicadorId })),
                            skipDuplicates: true,
                        });
                    }
                }
                return tx.carrinhoTurno.update({
                    where: { id },
                    data: novo,
                    include: { escalas: { include: { publicador: true } } },
                });
            });

            return res.json(turno);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Esse ponto já tem um turno nesse dia e horário' });
            }
            console.error('Erro ao atualizar turno:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    async excluirTurno(req, res) {
        try {
            await prisma.carrinhoTurno.delete({ where: { id: parseInt(req.params.id) } });
            return res.status(204).send();
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Turno não encontrado' });
            }
            console.error('Erro ao excluir turno:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // ==================== PUBLICADORES ====================

    async criarPublicador(req, res) {
        try {
            const { nome, telefone, turnoIds } = req.body;
            if (!nome || !String(nome).trim()) {
                return res.status(400).json({ error: 'Nome é obrigatório' });
            }

            const publicador = await prisma.carrinhoPublicador.create({
                data: {
                    nome: String(nome).trim(),
                    telefone: telefone ? String(telefone).trim() : null,
                    escalas: {
                        create: [...new Set(turnoIds || [])].map(id => ({ turnoId: Number(id) })),
                    },
                },
                include: { escalas: true },
            });
            return res.status(201).json(publicador);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Já existe alguém com esse nome no carrinho' });
            }
            console.error('Erro ao criar publicador:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    async atualizarPublicador(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { nome, telefone, ativo, turnoIds } = req.body;

            const data = {};
            if (nome !== undefined) data.nome = String(nome).trim();
            // String vazia limpa o telefone; campo ausente mantém o que está lá.
            if (telefone !== undefined) data.telefone = telefone ? String(telefone).trim() : null;
            if (ativo !== undefined) data.ativo = Boolean(ativo);

            const publicador = await prisma.$transaction(async (tx) => {
                if (turnoIds !== undefined) {
                    await tx.carrinhoEscala.deleteMany({ where: { publicadorId: id } });
                    const ids = [...new Set(turnoIds)].map(Number).filter(Number.isInteger);
                    if (ids.length > 0) {
                        await tx.carrinhoEscala.createMany({
                            data: ids.map(turnoId => ({ turnoId, publicadorId: id })),
                            skipDuplicates: true,
                        });
                    }
                }
                return tx.carrinhoPublicador.update({ where: { id }, data });
            });

            return res.json(publicador);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Já existe alguém com esse nome no carrinho' });
            }
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Pessoa não encontrada' });
            }
            console.error('Erro ao atualizar publicador:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    async excluirPublicador(req, res) {
        try {
            await prisma.carrinhoPublicador.delete({ where: { id: parseInt(req.params.id) } });
            return res.status(204).send();
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Pessoa não encontrada' });
            }
            console.error('Erro ao excluir publicador:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }
}

module.exports = new CarrinhoController();
