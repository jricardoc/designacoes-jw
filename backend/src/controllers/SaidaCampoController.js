const prisma = require('../prisma');

class SaidaCampoController {
    // Listar todas as saídas de campo
    async index(req, res) {
        try {
            const saidas = await prisma.saidaCampo.findMany({
                where: { ativo: true },
                orderBy: [
                    { diaSemana: 'asc' },
                    { turno: 'asc' }
                ],
                include: {
                    dirigentesDisponiveis: {
                        include: {
                            irmao: true
                        }
                    }
                }
            });
            return res.json(saidas);
        } catch (error) {
            console.error('Erro ao listar saídas de campo:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Buscar saída de campo por ID
    async show(req, res) {
        try {
            const { id } = req.params;
            const saida = await prisma.saidaCampo.findUnique({
                where: { id: parseInt(id) },
                include: {
                    dirigentesDisponiveis: {
                        include: {
                            irmao: true
                        }
                    }
                }
            });

            if (!saida) {
                return res.status(404).json({ error: 'Saída de campo não encontrada' });
            }

            return res.json(saida);
        } catch (error) {
            console.error('Erro ao buscar saída de campo:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Criar nova saída de campo
    async create(req, res) {
        try {
            const { diaSemana, turno, local, horario, ativo } = req.body;

            if (!diaSemana || !local || !horario) {
                return res.status(400).json({ error: 'diaSemana, local e horario são obrigatórios' });
            }

            const saida = await prisma.saidaCampo.create({
                data: {
                    diaSemana,
                    turno: turno || 1,
                    local,
                    horario,
                    ativo: ativo !== undefined ? ativo : true
                }
            });

            return res.status(201).json(saida);
        } catch (error) {
            console.error('Erro ao criar saída de campo:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Atualizar saída de campo
    async update(req, res) {
        try {
            const { id } = req.params;
            const { diaSemana, turno, local, horario, ativo } = req.body;

            const saida = await prisma.saidaCampo.findUnique({
                where: { id: parseInt(id) }
            });

            if (!saida) {
                return res.status(404).json({ error: 'Saída de campo não encontrada' });
            }

            const updateData = {};
            if (diaSemana !== undefined) updateData.diaSemana = diaSemana;
            if (turno !== undefined) updateData.turno = turno;
            if (local !== undefined) updateData.local = local;
            if (horario !== undefined) updateData.horario = horario;
            if (ativo !== undefined) updateData.ativo = ativo;

            const atualizada = await prisma.saidaCampo.update({
                where: { id: parseInt(id) },
                data: updateData
            });

            return res.json(atualizada);
        } catch (error) {
            console.error('Erro ao atualizar saída de campo:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Deletar saída de campo
    async delete(req, res) {
        try {
            const { id } = req.params;

            await prisma.saidaCampo.delete({
                where: { id: parseInt(id) }
            });

            return res.status(204).send();
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Saída de campo não encontrada' });
            }
            console.error('Erro ao deletar saída de campo:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}

module.exports = new SaidaCampoController();
