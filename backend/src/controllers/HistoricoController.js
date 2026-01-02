const prisma = require('../prisma');

class HistoricoController {
    // Listar historico de um quadro
    async porQuadro(req, res) {
        try {
            const { quadroId } = req.params;

            const historicos = await prisma.historico.findMany({
                where: { quadroId: parseInt(quadroId) },
                include: {
                    usuario: {
                        select: { id: true, nome: true, nickname: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            return res.json(historicos);
        } catch (error) {
            console.error('Erro ao listar historico:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Listar historico geral (todos os quadros)
    async index(req, res) {
        try {
            const { limite = 50, pagina = 1 } = req.query;
            const skip = (parseInt(pagina) - 1) * parseInt(limite);

            const historicos = await prisma.historico.findMany({
                include: {
                    usuario: {
                        select: { id: true, nome: true }
                    },
                    quadro: {
                        select: { id: true, titulo: true, mes: true, ano: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limite),
                skip
            });

            const total = await prisma.historico.count();

            return res.json({
                historicos,
                total,
                pagina: parseInt(pagina),
                totalPaginas: Math.ceil(total / parseInt(limite))
            });
        } catch (error) {
            console.error('Erro ao listar historico:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Estatisticas de historico
    async estatisticas(req, res) {
        try {
            const { quadroId } = req.params;

            const where = quadroId ? { quadroId: parseInt(quadroId) } : {};

            const total = await prisma.historico.count({ where });

            const porAcao = await prisma.historico.groupBy({
                by: ['acao'],
                where,
                _count: { id: true }
            });

            const ultimasModificacoes = await prisma.historico.findMany({
                where,
                include: {
                    usuario: { select: { nome: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 5
            });

            return res.json({
                total,
                porAcao: porAcao.reduce((acc, item) => {
                    acc[item.acao] = item._count.id;
                    return acc;
                }, {}),
                ultimasModificacoes
            });
        } catch (error) {
            console.error('Erro ao buscar estatisticas:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }
}

module.exports = new HistoricoController();
