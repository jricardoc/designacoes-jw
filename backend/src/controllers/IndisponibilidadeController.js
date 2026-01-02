const prisma = require('../prisma');

class IndisponibilidadeController {
    // Listar todas as indisponibilidades
    async index(req, res) {
        try {
            const indisponibilidades = await prisma.indisponibilidade.findMany({
                include: {
                    irmao: {
                        select: { id: true, nome: true }
                    }
                },
                orderBy: [
                    { data: 'asc' },
                    { irmao: { nome: 'asc' } }
                ]
            });
            return res.json(indisponibilidades);
        } catch (error) {
            console.error('Erro ao listar indisponibilidades:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Listar indisponibilidades por irmao
    async porIrmao(req, res) {
        try {
            const { irmaoId } = req.params;

            const indisponibilidades = await prisma.indisponibilidade.findMany({
                where: { irmaoId: parseInt(irmaoId) },
                orderBy: { data: 'asc' }
            });

            return res.json(indisponibilidades);
        } catch (error) {
            console.error('Erro ao listar indisponibilidades do irmao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Listar indisponibilidades por data
    async porData(req, res) {
        try {
            const { data } = req.params;

            const indisponibilidades = await prisma.indisponibilidade.findMany({
                where: { data },
                include: {
                    irmao: {
                        select: { id: true, nome: true }
                    }
                }
            });

            return res.json(indisponibilidades);
        } catch (error) {
            console.error('Erro ao listar indisponibilidades por data:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Verificar se irmao esta indisponivel em uma data
    async verificar(req, res) {
        try {
            const { irmaoId, data } = req.params;

            const indisponibilidade = await prisma.indisponibilidade.findUnique({
                where: {
                    irmaoId_data: {
                        irmaoId: parseInt(irmaoId),
                        data
                    }
                }
            });

            return res.json({
                indisponivel: !!indisponibilidade,
                motivo: indisponibilidade?.motivo || null
            });
        } catch (error) {
            console.error('Erro ao verificar indisponibilidade:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Criar indisponibilidade
    async create(req, res) {
        try {
            const { irmaoId, data, motivo } = req.body;

            if (!irmaoId || !data) {
                return res.status(400).json({ error: 'irmaoId e data sao obrigatorios' });
            }

            const indisponibilidade = await prisma.indisponibilidade.create({
                data: {
                    irmaoId: parseInt(irmaoId),
                    data,
                    motivo
                },
                include: {
                    irmao: {
                        select: { id: true, nome: true }
                    }
                }
            });

            return res.status(201).json(indisponibilidade);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Ja existe indisponibilidade para esse irmao nessa data' });
            }
            if (error.code === 'P2003') {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }
            console.error('Erro ao criar indisponibilidade:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Criar multiplas indisponibilidades de uma vez
    async createMany(req, res) {
        try {
            const { irmaoId, datas, motivo } = req.body;

            if (!irmaoId || !datas || !Array.isArray(datas)) {
                return res.status(400).json({ error: 'irmaoId e datas (array) sao obrigatorios' });
            }

            const indisponibilidades = datas.map(data => ({
                irmaoId: parseInt(irmaoId),
                data,
                motivo
            }));

            await prisma.indisponibilidade.createMany({
                data: indisponibilidades,
                skipDuplicates: true
            });

            const criadas = await prisma.indisponibilidade.findMany({
                where: {
                    irmaoId: parseInt(irmaoId),
                    data: { in: datas }
                }
            });

            return res.status(201).json(criadas);
        } catch (error) {
            console.error('Erro ao criar indisponibilidades:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Atualizar motivo da indisponibilidade
    async update(req, res) {
        try {
            const { id } = req.params;
            const { motivo } = req.body;

            const indisponibilidade = await prisma.indisponibilidade.update({
                where: { id: parseInt(id) },
                data: { motivo },
                include: {
                    irmao: {
                        select: { id: true, nome: true }
                    }
                }
            });

            return res.json(indisponibilidade);
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Indisponibilidade nao encontrada' });
            }
            console.error('Erro ao atualizar indisponibilidade:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Deletar indisponibilidade
    async delete(req, res) {
        try {
            const { id } = req.params;

            await prisma.indisponibilidade.delete({
                where: { id: parseInt(id) }
            });

            return res.status(204).send();
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Indisponibilidade nao encontrada' });
            }
            console.error('Erro ao deletar indisponibilidade:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Deletar por irmao e data
    async deleteByIrmaoData(req, res) {
        try {
            const { irmaoId, data } = req.params;

            await prisma.indisponibilidade.delete({
                where: {
                    irmaoId_data: {
                        irmaoId: parseInt(irmaoId),
                        data
                    }
                }
            });

            return res.status(204).send();
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Indisponibilidade nao encontrada' });
            }
            console.error('Erro ao deletar indisponibilidade:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Limpar todas indisponibilidades de um irmao
    async clearByIrmao(req, res) {
        try {
            const { irmaoId } = req.params;

            await prisma.indisponibilidade.deleteMany({
                where: { irmaoId: parseInt(irmaoId) }
            });

            return res.status(204).send();
        } catch (error) {
            console.error('Erro ao limpar indisponibilidades:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}

module.exports = new IndisponibilidadeController();
