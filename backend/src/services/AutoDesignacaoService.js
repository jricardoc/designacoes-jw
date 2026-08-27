const prisma = require('../prisma');

/**
 * Servico de preenchimento automatico do quadro de designacoes mecanicas.
 *
 * REGRA DE OURO (rodizio puro, sem pontuacao):
 * 1. Existe uma FILA de irmaos elegiveis. A ordem inicial vem do historico: quem serviu ha
 *    mais tempo fica na frente, quem nunca serviu fica na frente de todos.
 * 2. Os turnos sao percorridos em ordem CRONOLOGICA. Para cada vaga, anda-se na fila do
 *    inicio para o fim e pega-se o PRIMEIRO irmao que possa servir naquele turno.
 * 3. Quem nao pode servir naquele dia NAO perde a vez: continua na mesma posicao e pega o
 *    proximo turno compativel.
 * 4. Quem e designado vai para o FIM da fila. Quando todos ja serviram uma vez, a fila esta
 *    exatamente na ordem em que serviram, e o ciclo reinicia sozinho.
 *
 * O rodizio substitui a antiga politica de escolha por pesos (contador de designacoes,
 * "evitar repeticoes" por proximidade de datas, "designar todos"). As RESTRICOES continuam:
 * irmao inativo, funcao do irmao, indisponibilidade na data, nivel de Audio e Video e o fato
 * de ninguem poder ocupar duas vagas no mesmo dia.
 */

// Uma fila POR FUNCAO, nao uma fila unica. Um irmao pode acumular funcoes; com fila unica ele
// seria sempre pego primeiro e as funcoes com poucos habilitados nunca fechariam o ciclo.
// "Todos serem distribuidos antes de repetir" so tem sentido dentro do grupo que faz aquela funcao.
const FUNCAO_MAP = {
    'Microfone Volante': 'microfone',
    'Indicador': 'indicador',
    'Audio e Video': 'audioVideo',
    'Estacionamento': 'estacionamento'
};

const FUNCOES = ['microfone', 'indicador', 'audioVideo', 'estacionamento'];

// "31/01" -> 131. So para ordenar as datas de UM quadro, que e sempre de um unico mes.
const diaMesEmNumero = (dataString) => {
    const [dia, mes] = String(dataString).split('/').map(Number);
    return (mes || 0) * 100 + (dia || 0);
};

class AutoDesignacaoService {

    /**
     * Gera designacoes automaticas para um quadro
     * @param {number} quadroId - ID do quadro
     * @param {number} mes - Mes do quadro
     * @param {number} ano - Ano do quadro
     * @param {Object} regras - Regras de criacao
     * @param {boolean} regras.respeitarIndisponibilidades - Nao designar em dias ocupados
     * @param {boolean} regras.regraAudioVideo - Irmao 1 experiente / Irmao 2 treinando
     *
     * As antigas regras evitarRepeticoes, distribuicaoIgualitaria e designarTodos continuam
     * aceitas para nao quebrar quem chama, mas nao tem mais efeito: o rodizio ja distribui
     * igualmente, ja designa todos antes de repetir e ja cria o intervalo entre repeticoes.
     */
    async gerarDesignacoes(quadroId, mes, ano, regras = {}) {
        const {
            respeitarIndisponibilidades = true,
            regraAudioVideo = true
        } = regras;

        // 1. Irmaos ativos com funcoes e indisponibilidades
        const irmaos = await prisma.irmao.findMany({
            where: { ativo: true },
            include: { indisponibilidades: true }
        });

        // 2. Designacoes do quadro (template) agrupadas por data
        const designacoes = await prisma.designacao.findMany({
            where: { quadroId },
            orderBy: [{ data: 'asc' }, { funcao: 'asc' }]
        });

        const designacoesPorData = {};
        designacoes.forEach(d => {
            if (!designacoesPorData[d.data]) designacoesPorData[d.data] = [];
            designacoesPorData[d.data].push(d);
        });

        // 3. Historico dos meses anteriores: define a ordem inicial de cada fila
        const ultimoServico = await this.carregarHistorico(mes, ano);
        const filas = this.montarFilas(irmaos, ultimoServico);

        // 4. Turnos em ordem cronologica
        const datas = Object.keys(designacoesPorData).sort((a, b) => {
            const [diaA, mesA] = a.split('/').map(Number);
            const [diaB, mesB] = b.split('/').map(Number);
            return (mesA * 100 + diaA) - (mesB * 100 + diaB);
        });

        for (const data of datas) {
            // Ninguem ocupa duas vagas no mesmo dia, mesmo que acumule funcoes.
            const jaDesignadosNoDia = new Set();

            for (const designacao of designacoesPorData[data]) {
                const funcaoId = FUNCAO_MAP[designacao.funcao];
                const fila = filas[funcaoId];

                if (!fila || fila.length === 0) continue;

                // Restricao comum a todas as vagas daquele turno
                const podeServir = (irmao) => {
                    if (jaDesignadosNoDia.has(irmao.nome)) return false;
                    if (respeitarIndisponibilidades) {
                        if (irmao.indisponibilidades?.some(ind => ind.data === data)) return false;
                    }
                    return true;
                };

                let irmao1;
                let irmao2;

                if (regraAudioVideo && funcaoId === 'audioVideo') {
                    // Irmao 1 experiente, irmao 2 treinando. Se nao sobrar ninguem do nivel
                    // pedido, cai para o primeiro elegivel da fila em vez de deixar a vaga vazia.
                    irmao1 = this.puxarDaFila(fila, (i) => podeServir(i) && i.nivelAudioVideo === 'experiente')
                        || this.puxarDaFila(fila, podeServir);
                    if (irmao1) jaDesignadosNoDia.add(irmao1.nome);

                    irmao2 = this.puxarDaFila(fila, (i) => podeServir(i) && i.nivelAudioVideo === 'treinando')
                        || this.puxarDaFila(fila, podeServir);
                    if (irmao2) jaDesignadosNoDia.add(irmao2.nome);
                } else {
                    irmao1 = this.puxarDaFila(fila, podeServir);
                    if (irmao1) jaDesignadosNoDia.add(irmao1.nome);

                    irmao2 = this.puxarDaFila(fila, podeServir);
                    if (irmao2) jaDesignadosNoDia.add(irmao2.nome);
                }

                if (irmao1 || irmao2) {
                    await prisma.designacao.update({
                        where: { id: designacao.id },
                        data: {
                            irmao1: irmao1 ? irmao1.nome : '',
                            irmao2: irmao2 ? irmao2.nome : ''
                        }
                    });
                }
            }
        }

        return { success: true };
    }

    /**
     * Anda na fila do inicio para o fim e devolve o primeiro irmao que atende ao filtro.
     * Quem nao serve naquele turno NAO perde a vez: continua onde estava.
     * Quem e escolhido vai para o fim da fila.
     */
    puxarDaFila(fila, podeServir) {
        const indice = fila.findIndex(podeServir);
        if (indice === -1) return null;

        const [escolhido] = fila.splice(indice, 1);
        fila.push(escolhido);
        return escolhido;
    }

    /**
     * Posicao da ULTIMA vez que cada irmao serviu em cada funcao, olhando TODOS os quadros
     * anteriores. Gerar um mes novo nao recomeca do zero: a fila do mes N sai de como terminou
     * o mes N-1.
     *
     * A posicao e um contador que anda de vaga em vaga, na ordem em que as vagas foram
     * preenchidas (quadro por quadro, data por data, irmao1 antes de irmao2) — nao a DATA em
     * que o irmao serviu.
     *
     * A diferenca importa no ultimo dia de cada mes. Toda vaga escala dois irmaos no mesmo
     * dia, entao, por data, os dois empatam; o desempate era alfabetico e trocava a ordem
     * real da fila. Quem serviu por ultimo voltava na frente de quem tinha servido antes,
     * so por causa do nome: o descanso encurtava na virada do mes e os primeiros do alfabeto
     * acumulavam uma designacao a mais a cada mes. Contando a POSICAO, a fila de janeiro
     * comeca exatamente onde a de dezembro parou.
     *
     * @returns {Object} { microfone: { nome: posicao }, indicador: {...}, ... }
     */
    async carregarHistorico(mes, ano) {
        const ultimoServico = {};
        FUNCOES.forEach(f => { ultimoServico[f] = {}; });

        const quadrosAnteriores = await prisma.quadro.findMany({
            where: {
                OR: [
                    { ano: { lt: ano } },
                    { ano: ano, mes: { lt: mes } }
                ]
            },
            include: { designacoes: true },
            // A ordem dos quadros deixou de ser indiferente: o contador depende dela.
            orderBy: [{ ano: 'asc' }, { mes: 'asc' }]
        });

        let posicao = 0;
        for (const quadro of quadrosAnteriores) {
            const linhas = quadro.designacoes
                .filter(d => FUNCAO_MAP[d.funcao])
                .sort((a, b) => diaMesEmNumero(a.data) - diaMesEmNumero(b.data));

            for (const d of linhas) {
                const funcaoId = FUNCAO_MAP[d.funcao];
                for (const nome of [d.irmao1, d.irmao2]) {
                    posicao += 1;
                    if (nome) ultimoServico[funcaoId][nome] = posicao;
                }
            }
        }

        return ultimoServico;
    }

    /**
     * Fila inicial de cada funcao: quem nunca serviu na frente de todos, depois quem serviu ha
     * mais tempo (menor posicao no historico).
     *
     * O empate por nome so decide entre irmaos que NUNCA serviram naquela funcao — duas
     * posicoes iguais nao existem, porque o contador anda a cada vaga. Serve para a geracao
     * ser reproduzivel.
     */
    montarFilas(irmaos, ultimoServico) {
        const filas = {};

        FUNCOES.forEach(funcaoId => {
            const historico = ultimoServico[funcaoId] || {};

            filas[funcaoId] = irmaos
                .filter(i => i.funcoes.includes(funcaoId))
                .sort((a, b) => {
                    const ultimaA = historico[a.nome];
                    const ultimaB = historico[b.nome];

                    if (ultimaA === undefined && ultimaB !== undefined) return -1;
                    if (ultimaA !== undefined && ultimaB === undefined) return 1;
                    if (ultimaA !== undefined && ultimaB !== undefined && ultimaA !== ultimaB) {
                        return ultimaA - ultimaB;
                    }
                    return a.nome.localeCompare(b.nome);
                });
        });

        return filas;
    }
}

module.exports = new AutoDesignacaoService();
