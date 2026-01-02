const prisma = require('../prisma');

/**
 * Servico para automatizar a criacao de designacoes
 * Algoritmo inteligente que considera:
 * - Indisponibilidades dos irmaos
 * - Evitar repeticoes seguidas
 * - Distribuicao igualitaria
 * - Garantir que todos sejam designados
 */
class AutoDesignacaoService {

    /**
     * Gera designacoes automaticas para um quadro
     * @param {number} quadroId - ID do quadro
     * @param {number} mes - Mes do quadro
     * @param {number} ano - Ano do quadro
     * @param {Object} regras - Regras de criacao
     * @param {boolean} regras.respeitarIndisponibilidades - Nao designar em dias ocupados
     * @param {boolean} regras.evitarRepeticoes - Nao colocar em dias seguidos
     * @param {boolean} regras.distribuicaoIgualitaria - Balancear entre irmaos
     * @param {boolean} regras.designarTodos - Garantir que todos tenham ao menos 1
     */
    async gerarDesignacoes(quadroId, mes, ano, regras = {}) {
        const {
            respeitarIndisponibilidades = true,
            evitarRepeticoes = true,
            distribuicaoIgualitaria = true,
            designarTodos = true,
            regraAudioVideo = true
        } = regras;

        // 1. Buscar todos os irmaos ativos com suas funcoes e indisponibilidades
        const irmaos = await prisma.irmao.findMany({
            where: { ativo: true },
            include: { indisponibilidades: true }
        });

        // 2. Organizar irmaos por funcao
        const irmaosPorFuncao = {
            microfone: irmaos.filter(i => i.funcoes.includes('microfone')),
            indicador: irmaos.filter(i => i.funcoes.includes('indicador')),
            audioVideo: irmaos.filter(i => i.funcoes.includes('audioVideo'))
        };

        // 3. Buscar designacoes existentes do quadro (template vazio)
        const designacoes = await prisma.designacao.findMany({
            where: { quadroId },
            orderBy: [{ data: 'asc' }, { funcao: 'asc' }]
        });

        // 4. Agrupar por data
        const designacoesPorData = {};
        designacoes.forEach(d => {
            if (!designacoesPorData[d.data]) {
                designacoesPorData[d.data] = [];
            }
            designacoesPorData[d.data].push(d);
        });

        // 5. Contador de designacoes por irmao (para distribuicao igualitaria)
        const contadorDesignacoes = {};
        irmaos.forEach(i => { contadorDesignacoes[i.nome] = 0; });

        // 6. Rastrear ultima designacao de cada irmao (para evitar repeticoes)
        const ultimaDesignacao = {};

        // 7. Irmaos que ainda nao foram designados (para garantir todos)
        const irmaosNaoDesignados = {
            microfone: new Set(irmaosPorFuncao.microfone.map(i => i.nome)),
            indicador: new Set(irmaosPorFuncao.indicador.map(i => i.nome)),
            audioVideo: new Set(irmaosPorFuncao.audioVideo.map(i => i.nome))
        };

        // 8. Processar cada data em ordem
        const datas = Object.keys(designacoesPorData).sort((a, b) => {
            const [diaA, mesA] = a.split('/').map(Number);
            const [diaB, mesB] = b.split('/').map(Number);
            return (mesA * 100 + diaA) - (mesB * 100 + diaB);
        });

        const funcaoMap = {
            'Microfone Volante': 'microfone',
            'Indicador': 'indicador',
            'Audio e Video': 'audioVideo'
        };

        for (const data of datas) {
            const designacoesData = designacoesPorData[data];

            for (const designacao of designacoesData) {
                const funcaoId = funcaoMap[designacao.funcao];
                const irmaosDisponiveis = irmaosPorFuncao[funcaoId];

                if (!irmaosDisponiveis || irmaosDisponiveis.length === 0) continue;

                let irmao1, irmao2;

                // REGRA ESPECIAL PARA AUDIO E VIDEO (se habilitada)
                if (regraAudioVideo && designacao.funcao === 'Audio e Video') {
                    if (designacao.dia === 'Quinta') {
                        // Quinta: 2 irmaos treinando
                        const treinandos = irmaosDisponiveis.filter(i => i.nivelAudioVideo === 'treinando');
                        irmao1 = this.selecionarIrmao(
                            treinandos.length > 0 ? treinandos : irmaosDisponiveis,
                            data, designacao.funcao, ultimaDesignacao, contadorDesignacoes,
                            irmaosNaoDesignados[funcaoId], regras, null
                        );
                        irmao2 = this.selecionarIrmao(
                            treinandos.length > 0 ? treinandos : irmaosDisponiveis,
                            data, designacao.funcao, ultimaDesignacao, contadorDesignacoes,
                            irmaosNaoDesignados[funcaoId], regras, irmao1
                        );
                    } else if (designacao.dia === 'Domingo') {
                        // Domingo: 1 experiente + 1 treinando
                        const experientes = irmaosDisponiveis.filter(i => i.nivelAudioVideo === 'experiente');
                        const treinandos = irmaosDisponiveis.filter(i => i.nivelAudioVideo === 'treinando');

                        irmao1 = this.selecionarIrmao(
                            experientes.length > 0 ? experientes : irmaosDisponiveis,
                            data, designacao.funcao, ultimaDesignacao, contadorDesignacoes,
                            irmaosNaoDesignados[funcaoId], regras, null
                        );
                        irmao2 = this.selecionarIrmao(
                            treinandos.length > 0 ? treinandos : irmaosDisponiveis,
                            data, designacao.funcao, ultimaDesignacao, contadorDesignacoes,
                            irmaosNaoDesignados[funcaoId], regras, irmao1
                        );
                    } else {
                        // Outro dia: comportamento padrao
                        irmao1 = this.selecionarIrmao(irmaosDisponiveis, data, designacao.funcao, ultimaDesignacao, contadorDesignacoes, irmaosNaoDesignados[funcaoId], regras, null);
                        irmao2 = this.selecionarIrmao(irmaosDisponiveis, data, designacao.funcao, ultimaDesignacao, contadorDesignacoes, irmaosNaoDesignados[funcaoId], regras, irmao1);
                    }
                } else {
                    // Outras funcoes: comportamento padrao
                    irmao1 = this.selecionarIrmao(irmaosDisponiveis, data, designacao.funcao, ultimaDesignacao, contadorDesignacoes, irmaosNaoDesignados[funcaoId], regras, null);
                    irmao2 = this.selecionarIrmao(irmaosDisponiveis, data, designacao.funcao, ultimaDesignacao, contadorDesignacoes, irmaosNaoDesignados[funcaoId], regras, irmao1);
                }

                // Atualizar designacao
                if (irmao1 || irmao2) {
                    await prisma.designacao.update({
                        where: { id: designacao.id },
                        data: {
                            irmao1: irmao1 || '',
                            irmao2: irmao2 || ''
                        }
                    });

                    // Atualizar contadores e rastreadores
                    if (irmao1) {
                        contadorDesignacoes[irmao1]++;
                        ultimaDesignacao[irmao1] = data;
                        irmaosNaoDesignados[funcaoId].delete(irmao1);
                    }
                    if (irmao2) {
                        contadorDesignacoes[irmao2]++;
                        ultimaDesignacao[irmao2] = data;
                        irmaosNaoDesignados[funcaoId].delete(irmao2);
                    }
                }
            }
        }

        return { success: true };
    }

    /**
     * Seleciona o melhor irmao para uma designacao
     */
    selecionarIrmao(
        irmaosDisponiveis,
        data,
        funcao,
        ultimaDesignacao,
        contadorDesignacoes,
        irmaosNaoDesignados,
        regras,
        excluir
    ) {
        const {
            respeitarIndisponibilidades = true,
            evitarRepeticoes = true,
            distribuicaoIgualitaria = true,
            designarTodos = true
        } = regras;

        // Filtrar candidatos
        let candidatos = irmaosDisponiveis.filter(i => {
            // Excluir irmao ja selecionado para essa designacao
            if (excluir && i.nome === excluir) return false;

            // Verificar indisponibilidade
            if (respeitarIndisponibilidades) {
                const indisponivel = i.indisponibilidades?.some(ind => ind.data === data);
                if (indisponivel) return false;
            }

            return true;
        });

        if (candidatos.length === 0) return null;

        // Se deve evitar repeticoes, EXCLUIR quem foi designado recentemente (regra rigorosa)
        if (evitarRepeticoes) {
            const candidatosSemRepeticao = candidatos.filter(i => {
                const ultima = ultimaDesignacao[i.nome];
                if (!ultima) return true;

                // Verificar se a ultima designacao foi em uma data proxima
                return !this.saoDatasSeguidas(ultima, data);
            });

            // RIGOROSO: Só usar candidatos sem repetição (não fazer fallback)
            if (candidatosSemRepeticao.length > 0) {
                candidatos = candidatosSemRepeticao;
            } else {
                // Se absolutamente nao houver opcao, logar aviso
                console.log(`Aviso: Sem candidatos sem repeticao para ${data}, usando todos disponiveis`);
            }
        }

        // Se deve designar todos, priorizar quem ainda nao foi designado
        if (designarTodos) {
            const naoDesignados = candidatos.filter(i => irmaosNaoDesignados.has(i.nome));
            if (naoDesignados.length > 0) {
                candidatos = naoDesignados;
            }
        }

        // Se distribuicao igualitaria, ordenar por menor quantidade de designacoes
        if (distribuicaoIgualitaria) {
            candidatos.sort((a, b) => {
                return (contadorDesignacoes[a.nome] || 0) - (contadorDesignacoes[b.nome] || 0);
            });
        }

        // Retornar o primeiro candidato (melhor opcao)
        return candidatos.length > 0 ? candidatos[0].nome : null;
    }

    /**
     * Verifica se duas datas sao seguidas (considerando apenas dia/mes)
     */
    saoDatasSeguidas(data1, data2) {
        const [dia1, mes1] = data1.split('/').map(Number);
        const [dia2, mes2] = data2.split('/').map(Number);

        // Converter para valor numerico para comparar
        const valor1 = mes1 * 100 + dia1;
        const valor2 = mes2 * 100 + dia2;

        // Considerar "seguidas" se diferenca for pequena (ate 4 dias)
        return Math.abs(valor2 - valor1) <= 4;
    }
}

module.exports = new AutoDesignacaoService();
