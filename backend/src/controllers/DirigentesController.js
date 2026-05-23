const prisma = require('../prisma');

const MESES = ['', 'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

class DirigentesController {
    // Listar todos os quadros de dirigentes
    async indexQuadros(req, res) {
        try {
            const quadros = await prisma.quadroDirigente.findMany({
                include: {
                    _count: {
                        select: { escalas: true }
                    }
                },
                orderBy: [
                    { ano: 'desc' },
                    { mes: 'desc' }
                ]
            });
            return res.json(quadros);
        } catch (error) {
            console.error('Erro ao listar quadros de dirigentes:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Buscar quadro por ID com escalas
    async showQuadro(req, res) {
        try {
            const { id } = req.params;
            const quadro = await prisma.quadroDirigente.findUnique({
                where: { id: parseInt(id) },
                include: {
                    escalas: {
                        where: { removido: false },
                        include: {
                            saidaCampo: true
                        },
                        orderBy: [
                            { data: 'asc' },
                            { saidaCampo: { turno: 'asc' } }
                        ]
                    }
                }
            });

            if (!quadro) {
                return res.status(404).json({ error: 'Quadro não encontrado' });
            }

            return res.json(quadro);
        } catch (error) {
            console.error('Erro ao buscar quadro de dirigentes:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Criar novo quadro de dirigentes
    async createQuadro(req, res) {
        try {
            const { mes, ano, autoPreenchimento } = req.body;

            if (!mes || !ano) {
                return res.status(400).json({ error: 'Mês e ano são obrigatórios' });
            }

            const existente = await prisma.quadroDirigente.findUnique({
                where: { mes_ano: { mes: parseInt(mes), ano: parseInt(ano) } }
            });

            if (existente) {
                return res.status(400).json({ error: 'Já existe um quadro de dirigentes para esse mês/ano' });
            }

            const titulo = `Escala de Dirigentes ${MESES[mes]} ${ano}`;

            const quadro = await prisma.quadroDirigente.create({
                data: {
                    mes: parseInt(mes),
                    ano: parseInt(ano),
                    titulo,
                    status: 'rascunho'
                }
            });

            const AutoDirigenteService = require('../services/AutoDirigenteService');
            
            // Gerar o template vazio (dias e saídas) e auto-preencher se solicitado
            await AutoDirigenteService.gerarEscala(
                quadro.id,
                parseInt(mes),
                parseInt(ano),
                autoPreenchimento
            );

            return res.status(201).json(quadro);
        } catch (error) {
            console.error('Erro ao criar quadro de dirigentes:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Excluir quadro
    async deleteQuadro(req, res) {
        try {
            const { id } = req.params;

            await prisma.quadroDirigente.delete({
                where: { id: parseInt(id) }
            });

            return res.status(204).send();
        } catch (error) {
            console.error('Erro ao deletar quadro de dirigentes:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Alterar status
    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const atualizado = await prisma.quadroDirigente.update({
                where: { id: parseInt(id) },
                data: { status }
            });

            return res.json(atualizado);
        } catch (error) {
            console.error('Erro ao atualizar status do quadro:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Atualizar dirigente na escala (principal ou substituto)
    async updateEscala(req, res) {
        try {
            const { escalaId, campo, valor } = req.body; // campo pode ser 'principal' ou 'substituto'

            if (campo !== 'principal' && campo !== 'substituto') {
                return res.status(400).json({ error: 'Campo inválido' });
            }

            const atualizada = await prisma.escalaDirigente.update({
                where: { id: parseInt(escalaId) },
                data: { [campo]: valor }
            });

            return res.json(atualizada);
        } catch (error) {
            console.error('Erro ao atualizar escala:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Remover um dia inteiro da escala (exclui todas as saídas daquele dia)
    async deleteDia(req, res) {
        try {
            const { quadroId, data } = req.body;

            if (!quadroId || !data) {
                return res.status(400).json({ error: 'Dados inválidos' });
            }

            const result = await prisma.escalaDirigente.updateMany({
                where: {
                    quadroId: parseInt(quadroId),
                    data: data
                },
                data: { removido: true }
            });

            return res.json({ success: true, count: result.count });
        } catch (error) {
            console.error('Erro ao remover dia da escala:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // -----------------------------------------------------
    // Disponibilidade de Dirigentes

    // Buscar disponibilidade de um irmão
    async getDisponibilidade(req, res) {
        try {
            const { irmaoId } = req.params;
            const disponibilidades = await prisma.dirigenteSaidaCampo.findMany({
                where: { irmaoId: parseInt(irmaoId) },
                include: { saidaCampo: true }
            });
            return res.json(disponibilidades);
        } catch (error) {
            console.error('Erro ao buscar disponibilidade:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Atualizar disponibilidade de um irmão
    async updateDisponibilidade(req, res) {
        try {
            const { irmaoId, saidasCampoIds } = req.body; // array de IDs de saidaCampo

            // Excluir as atuais
            await prisma.dirigenteSaidaCampo.deleteMany({
                where: { irmaoId: parseInt(irmaoId) }
            });

            // Criar novas
            if (saidasCampoIds && saidasCampoIds.length > 0) {
                const novasDisponibilidades = saidasCampoIds.map(saidaId => ({
                    irmaoId: parseInt(irmaoId),
                    saidaCampoId: parseInt(saidaId)
                }));

                await prisma.dirigenteSaidaCampo.createMany({
                    data: novasDisponibilidades
                });
            }

            return res.json({ success: true });
        } catch (error) {
            console.error('Erro ao atualizar disponibilidade:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }
}

module.exports = new DirigentesController();
