const prisma = require('../prisma');

class EstatisticasController {
    // Estatisticas Globais e Consolidadas de todos os quadros e designacoes
    async getEstatisticasGlobais(req, res) {
        try {
            // Conta numero total de Quadros
            const totalQuadros = await prisma.quadro.count();

            // Conta todos os Irmaos Ativos disponíveis
            const totalIrmaosAtivos = await prisma.irmao.count({
                where: { ativo: true }
            });

            // Busca todas as designacoes globais (Apenas as preenchidas)
            const designacoes = await prisma.designacao.findMany({
                where: {
                    OR: [
                        { irmao1: { not: '' } },
                        { irmao2: { not: '' } }
                    ]
                }
            });

            // O total de designações atribuidas será os slots preenchidos
            let totalDesignacoesAtribuidas = 0;
            const rankGeral = {};
            const rankFuncoes = {
                microfone: {},
                indicador: {},
                audioVideo: {},
                estacionamento: {}
            };

            const mapFuncao = {
                'Microfone Volante': 'microfone',
                'Indicador': 'indicador',
                'Audio e Video': 'audioVideo',
                'Estacionamento': 'estacionamento'
            };

            // Aggregation in Application layer
            designacoes.forEach(d => {
                const funcId = mapFuncao[d.funcao];

                if (d.irmao1) {
                    rankGeral[d.irmao1] = (rankGeral[d.irmao1] || 0) + 1;
                    if (funcId) rankFuncoes[funcId][d.irmao1] = (rankFuncoes[funcId][d.irmao1] || 0) + 1;
                    totalDesignacoesAtribuidas++;
                }

                if (d.irmao2) {
                    rankGeral[d.irmao2] = (rankGeral[d.irmao2] || 0) + 1;
                    if (funcId) rankFuncoes[funcId][d.irmao2] = (rankFuncoes[funcId][d.irmao2] || 0) + 1;
                    totalDesignacoesAtribuidas++;
                }
            });

            // Converter dicionarios em Arrays Ordenados
            const arrayRankGeral = Object.entries(rankGeral).sort((a, b) => b[1] - a[1]);

            // Top 3 Global
            const top5Geral = arrayRankGeral.slice(0, 5).map(i => ({ nome: i[0], qtd: i[1] }));

            // Inferir irmãos menos escalados (entre os que tem designacao)
            const menosEscaladosGeral = [...arrayRankGeral].reverse().slice(0, 5).map(i => ({ nome: i[0], qtd: i[1] }));

            // Ordena os Rank por funcoes
            const getTop1Funcao = (funcaoId) => {
                const arr = Object.entries(rankFuncoes[funcaoId]).sort((a, b) => b[1] - a[1]);
                return arr.length > 0 ? { nome: arr[0][0], qtd: arr[0][1] } : null;
            };

            return res.json({
                totalQuadros,
                totalIrmaosAtivos,
                totalDesignacoesAtribuidas,
                top5Geral,
                menosEscaladosGeral,
                rankFuncoes: {
                    microfone: getTop1Funcao('microfone'),
                    indicador: getTop1Funcao('indicador'),
                    audioVideo: getTop1Funcao('audioVideo'),
                    estacionamento: getTop1Funcao('estacionamento')
                }
            });

        } catch (error) {
            console.error('Erro ao gerar estatisticas globais:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }
}

module.exports = new EstatisticasController();
