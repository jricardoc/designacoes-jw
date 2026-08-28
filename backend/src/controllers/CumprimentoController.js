const prisma = require('../prisma');
const { ESCOPOS, temEscopo } = require('../middleware/escopos');

/**
 * Cumprimento das participacoes: o V/X ao lado do nome nas telas de
 * Designacoes e Dirigentes.
 *
 * A avaliacao mora NA linha da designacao (Designacao.cumpriu1/cumpriu2,
 * EscalaDirigente.cumpriu), nao numa tabela propria: trocar o irmao da celula
 * ou excluir o quadro descarta a avaliacao junto, que e o comportamento certo —
 * a avaliacao e daquela escalacao especifica.
 *
 * null = ainda nao avaliado, true = cumpriu, false = faltou.
 */

/** So estes tres valores entram no banco; qualquer outro e erro de contrato. */
function cumprimentoValido(valor) {
    return valor === true || valor === false || valor === null;
}

/**
 * "dd/MM" + (mes, ano) do quadro -> "dd/MM/yyyy".
 *
 * Um quadro contem dias do mes anterior (a escala abre na segunda-feira da
 * semana do dia 1), entao mes maior que o do quadro e do ano anterior — a
 * mesma regra de chaveDataBR no app (mobile/src/utils/date.ts).
 */
function dataCompleta(data, quadro) {
    const m = String(data || '').match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    const dia = m[1].padStart(2, '0');
    const mes = Number(m[2]);
    const ano = mes > quadro.mes ? quadro.ano - 1 : quadro.ano;
    return `${dia}/${String(mes).padStart(2, '0')}/${ano}`;
}

class CumprimentoController {
    /**
     * PUT /quadros/designacao/cumprimento
     * Body: { designacaoId, campo: "irmao1"|"irmao2", cumpriu: true|false|null }
     */
    async marcarDesignacao(req, res) {
        try {
            const { designacaoId, campo, cumpriu } = req.body || {};

            // Whitelist do campo: e ele que decide qual coluna de avaliacao muda.
            if (campo !== 'irmao1' && campo !== 'irmao2') {
                return res.status(400).json({ error: 'Campo inválido' });
            }
            if (!cumprimentoValido(cumpriu)) {
                return res.status(400).json({ error: 'Valor inválido: use true, false ou null.' });
            }

            const id = parseInt(designacaoId, 10);
            if (!Number.isInteger(id)) {
                return res.status(400).json({ error: 'Designação inválida' });
            }

            const designacao = await prisma.designacao.findUnique({ where: { id } });
            if (!designacao) {
                return res.status(404).json({ error: 'Designação não encontrada' });
            }

            const nome = designacao[campo];
            if (!nome) {
                return res.status(400).json({ error: 'Não há irmão nesta célula para avaliar.' });
            }

            const coluna = campo === 'irmao1' ? 'cumpriu1' : 'cumpriu2';
            const atualizada = await prisma.designacao.update({
                where: { id },
                data: { [coluna]: cumpriu },
            });

            // Mesmo trilho de auditoria das edicoes de celula.
            await prisma.historico.create({
                data: {
                    quadroId: designacao.quadroId,
                    usuarioId: req.user.id,
                    acao: 'avaliou',
                    descricao:
                        cumpriu === null
                            ? `Removeu a avaliação de "${nome}"`
                            : `Marcou "${nome}" como ${cumpriu ? 'cumprida' : 'não cumprida'}`,
                    campo: coluna,
                    designacaoInfo: `${designacao.data} - ${designacao.funcao}`,
                },
            });

            return res.json(atualizada);
        } catch (error) {
            console.error('Erro ao marcar cumprimento da designação:', error);
            return res.status(500).json({ error: 'Erro ao salvar avaliação' });
        }
    }

    /**
     * PUT /dirigentes/escala/cumprimento
     * Body: { escalaId, cumpriu: true|false|null }
     */
    async marcarEscala(req, res) {
        try {
            const { escalaId, cumpriu } = req.body || {};

            if (!cumprimentoValido(cumpriu)) {
                return res.status(400).json({ error: 'Valor inválido: use true, false ou null.' });
            }

            const id = parseInt(escalaId, 10);
            if (!Number.isInteger(id)) {
                return res.status(400).json({ error: 'Escala inválida' });
            }

            const escala = await prisma.escalaDirigente.findUnique({ where: { id } });
            if (!escala || escala.removido) {
                return res.status(404).json({ error: 'Saída não encontrada' });
            }
            if (!escala.principal) {
                return res.status(400).json({ error: 'Não há dirigente nesta saída para avaliar.' });
            }

            const atualizada = await prisma.escalaDirigente.update({
                where: { id },
                data: { cumpriu },
            });

            return res.json(atualizada);
        } catch (error) {
            console.error('Erro ao marcar cumprimento da escala:', error);
            return res.status(500).json({ error: 'Erro ao salvar avaliação' });
        }
    }

    /**
     * GET /cumprimento
     *
     * As avaliacoes DAS AREAS QUE O USUARIO CUIDA, achatadas num formato unico:
     *   { nome, origem: "designacoes"|"dirigentes", cumpriu, data: "dd/MM/yyyy", rotulo }
     *
     * Cada area so sai para quem tem o escopo dela. Quem cuida so dos dirigentes ve so os
     * dirigentes; o admin geral, que passa em todo escopo, ve as duas. O gate da rota exige
     * UM dos dois escopos e por isso, sozinho, deixava quem tinha um ler os dois.
     *
     * A consulta da area negada nem chega a ser feita — filtrar depois de ler seria pagar por
     * um dado que nao pode ser entregue.
     *
     * A tela de analise agrega e filtra em cima desta lista — sao poucas linhas
     * por mes, nao vale um endpoint de agregacao por corte.
     */
    async index(req, res) {
        try {
            const veDesignacoes = temEscopo(req.user, ESCOPOS.DESIGNACOES);
            const veDirigentes = temEscopo(req.user, ESCOPOS.DIRIGENTES);

            const [designacoes, escalas] = await Promise.all([
                veDesignacoes ? prisma.designacao.findMany({
                    where: { OR: [{ cumpriu1: { not: null } }, { cumpriu2: { not: null } }] },
                    include: { quadro: { select: { mes: true, ano: true } } },
                }) : [],
                veDirigentes ? prisma.escalaDirigente.findMany({
                    where: { cumpriu: { not: null }, removido: false },
                    include: {
                        quadro: { select: { mes: true, ano: true } },
                        saidaCampo: { select: { local: true, horario: true } },
                    },
                }) : [],
            ]);

            const registros = [];

            for (const d of designacoes) {
                const data = dataCompleta(d.data, d.quadro);
                if (!data) continue;
                // Celula pode ter sido esvaziada DEPOIS de avaliada em tese, mas o
                // update de celula nao mexe na avaliacao — por isso o nome vazio e
                // descartado aqui em vez de virar linha fantasma na analise.
                if (d.cumpriu1 !== null && d.irmao1) {
                    registros.push({ nome: d.irmao1, origem: 'designacoes', cumpriu: d.cumpriu1, data, rotulo: d.funcao });
                }
                if (d.cumpriu2 !== null && d.irmao2) {
                    registros.push({ nome: d.irmao2, origem: 'designacoes', cumpriu: d.cumpriu2, data, rotulo: d.funcao });
                }
            }

            for (const e of escalas) {
                const data = dataCompleta(e.data, e.quadro);
                if (!data || !e.principal) continue;
                const rotulo = [e.saidaCampo?.horario, e.saidaCampo?.local].filter(Boolean).join(' · ') || 'Saída de campo';
                registros.push({ nome: e.principal, origem: 'dirigentes', cumpriu: e.cumpriu, data, rotulo });
            }

            // Mais recente primeiro; "dd/MM/yyyy" nao ordena como texto.
            const chave = (r) => {
                const m = r.data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
            };
            registros.sort((a, b) => chave(b).localeCompare(chave(a)));

            return res.json({ registros });
        } catch (error) {
            console.error('Erro ao montar análise de cumprimento:', error);
            return res.status(500).json({ error: 'Erro ao buscar avaliações' });
        }
    }
}

module.exports = new CumprimentoController();
