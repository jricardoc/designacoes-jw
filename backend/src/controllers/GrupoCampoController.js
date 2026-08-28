'use strict';

const prisma = require('../prisma');

/**
 * Grupos de campo da congregacao.
 *
 * Sao poucos e mudam pouco, mas mudam: o grupo e batizado com o nome de quem o dirige, e
 * quando a designacao troca o grupo inteiro e renomeado. Como o publicador aponta para o
 * grupo (e nao guarda o texto), renomear aqui acerta todo mundo de uma vez.
 *
 * Gestao restrita ao admin geral, junto do resto do cadastro da congregacao. A LEITURA e
 * livre: a tela de cadastro precisa da lista para montar o seletor, e o nome do grupo nao e
 * informacao reservada.
 */
class GrupoCampoController {
    /** GET /grupos — todos, com quantos publicadores cada um tem. */
    async index(req, res) {
        try {
            const grupos = await prisma.grupoCampo.findMany({
                include: { _count: { select: { publicadores: true } } },
                orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
            });
            return res.json(grupos);
        } catch (error) {
            console.error('Erro ao listar grupos:', error);
            return res.status(500).json({ error: 'Erro ao buscar os grupos' });
        }
    }

    /** POST /grupos — body: { nome, ordem? } */
    async create(req, res) {
        try {
            const nome = String(req.body?.nome || '').trim();
            if (!nome) {
                return res.status(400).json({ error: 'Nome é obrigatório' });
            }

            const grupo = await prisma.grupoCampo.create({
                data: { nome, ordem: Number(req.body?.ordem) || 0 },
            });
            return res.status(201).json(grupo);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Já existe um grupo com esse nome' });
            }
            console.error('Erro ao criar grupo:', error);
            return res.status(500).json({ error: 'Erro ao criar o grupo' });
        }
    }

    /** PUT /grupos/:id — body: { nome?, ordem?, ativo? }. Campo ausente mantem o valor. */
    async update(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            const { nome, ordem, ativo } = req.body || {};

            const data = {};
            if (nome !== undefined) {
                const limpo = String(nome).trim();
                if (!limpo) return res.status(400).json({ error: 'Nome é obrigatório' });
                data.nome = limpo;
            }
            if (ordem !== undefined) data.ordem = Number(ordem) || 0;
            if (ativo !== undefined) data.ativo = Boolean(ativo);

            const grupo = await prisma.grupoCampo.update({ where: { id }, data });
            return res.json(grupo);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Já existe um grupo com esse nome' });
            }
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Grupo não encontrado' });
            }
            console.error('Erro ao atualizar grupo:', error);
            return res.status(500).json({ error: 'Erro ao salvar o grupo' });
        }
    }

    /**
     * DELETE /grupos/:id
     *
     * Quem estava no grupo NAO e apagado nem bloqueia a exclusao: a chave estrangeira e
     * `onDelete: SetNull`, entao os publicadores ficam sem grupo e reaparecem para ser
     * reatribuidos. Recusar a exclusao obrigaria a esvaziar o grupo na mao antes, e apagar
     * junto seria catastrofico.
     */
    async delete(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            const quantos = await prisma.irmao.count({ where: { grupoId: id } });

            await prisma.grupoCampo.delete({ where: { id } });
            return res.json({ success: true, publicadoresSemGrupo: quantos });
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Grupo não encontrado' });
            }
            console.error('Erro ao excluir grupo:', error);
            return res.status(500).json({ error: 'Erro ao excluir o grupo' });
        }
    }
}

module.exports = new GrupoCampoController();
