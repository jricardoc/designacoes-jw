const prisma = require('../prisma');

class IrmaoController {
    // Listar todos os irmaos
    async index(req, res) {
        try {
            const irmaos = await prisma.irmao.findMany({
                include: {
                    indisponibilidades: true
                },
                orderBy: { nome: 'asc' }
            });
            return res.json(irmaos);
        } catch (error) {
            console.error('Erro ao listar irmaos:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Buscar irmao por ID
    async show(req, res) {
        try {
            const { id } = req.params;
            const irmao = await prisma.irmao.findUnique({
                where: { id: parseInt(id) },
                include: {
                    indisponibilidades: true
                }
            });

            if (!irmao) {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }

            return res.json(irmao);
        } catch (error) {
            console.error('Erro ao buscar irmao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Criar novo irmao
    async create(req, res) {
        try {
            const { nome, funcoes } = req.body;

            if (!nome) {
                return res.status(400).json({ error: 'Nome e obrigatorio' });
            }

            const irmao = await prisma.irmao.create({
                data: {
                    nome,
                    funcoes: funcoes || []
                }
            });

            return res.status(201).json(irmao);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Ja existe um irmao com esse nome' });
            }
            console.error('Erro ao criar irmao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Atualizar irmao (renomear, funcoes, status)
    async update(req, res) {
        try {
            const { id } = req.params;
            const { nome, funcoes, ativo } = req.body;

            const updateData = {};
            if (nome !== undefined) updateData.nome = nome;
            if (funcoes !== undefined) updateData.funcoes = funcoes;
            if (ativo !== undefined) updateData.ativo = ativo;

            const irmao = await prisma.irmao.update({
                where: { id: parseInt(id) },
                data: updateData,
                include: {
                    indisponibilidades: true
                }
            });

            return res.json(irmao);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Ja existe um irmao com esse nome' });
            }
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }
            console.error('Erro ao atualizar irmao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Deletar irmao
    async delete(req, res) {
        try {
            const { id } = req.params;

            await prisma.irmao.delete({
                where: { id: parseInt(id) }
            });

            return res.status(204).send();
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }
            console.error('Erro ao deletar irmao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Adicionar funcao a um irmao
    async addFuncao(req, res) {
        try {
            const { id } = req.params;
            const { funcao } = req.body;

            const irmao = await prisma.irmao.findUnique({
                where: { id: parseInt(id) }
            });

            if (!irmao) {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }

            if (irmao.funcoes.includes(funcao)) {
                return res.status(400).json({ error: 'Irmao ja possui essa funcao' });
            }

            const atualizado = await prisma.irmao.update({
                where: { id: parseInt(id) },
                data: {
                    funcoes: [...irmao.funcoes, funcao]
                }
            });

            return res.json(atualizado);
        } catch (error) {
            console.error('Erro ao adicionar funcao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Remover funcao de um irmao
    async removeFuncao(req, res) {
        try {
            const { id } = req.params;
            const { funcao } = req.body;

            const irmao = await prisma.irmao.findUnique({
                where: { id: parseInt(id) }
            });

            if (!irmao) {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }

            const atualizado = await prisma.irmao.update({
                where: { id: parseInt(id) },
                data: {
                    funcoes: irmao.funcoes.filter(f => f !== funcao)
                }
            });

            return res.json(atualizado);
        } catch (error) {
            console.error('Erro ao remover funcao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Buscar irmaos por funcao (para os dropdowns)
    async porFuncao(req, res) {
        try {
            const { funcao } = req.params;

            const irmaos = await prisma.irmao.findMany({
                where: {
                    ativo: true,
                    funcoes: {
                        has: funcao
                    }
                },
                include: {
                    indisponibilidades: true
                },
                orderBy: { nome: 'asc' }
            });

            return res.json(irmaos);
        } catch (error) {
            console.error('Erro ao buscar irmaos por funcao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}

module.exports = new IrmaoController();
