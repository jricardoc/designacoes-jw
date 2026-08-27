const prisma = require('../prisma');

/**
 * Servico de preenchimento automatico do quadro de designacoes mecanicas.
 *
 * REGRA DE OURO (rodizio puro, sem pontuacao):
 * 1. Existe UMA fila com todos os irmaos ativos. A ordem inicial vem do historico: quem
 *    serviu ha mais tempo fica na frente, quem nunca serviu fica na frente de todos.
 * 2. Os turnos sao percorridos em ordem CRONOLOGICA. Para cada vaga, anda-se na fila do
 *    inicio para o fim e pega-se o PRIMEIRO irmao que possa servir naquele turno.
 * 3. Quem nao pode servir naquele turno (nao tem a funcao, esta ocupado, ja serviu no dia)
 *    NAO perde a vez: continua na mesma posicao e pega o proximo turno compativel.
 * 4. Quem e designado vai para o FIM da fila. Quando todos ja serviram uma vez, a fila esta
 *    exatamente na ordem em que serviram, e o ciclo reinicia sozinho.
 *
 * A FILA E UNICA, NAO UMA POR FUNCAO. Com uma fila por funcao, quem acumulava tres funcoes
 * entrava em tres rodizios e servia tres vezes mais que quem tinha uma so: numa geracao real
 * de 56 vagas, os irmaos de tres funcoes sairam com 5 designacoes e sete irmaos de uma funcao
 * so ficaram sem nenhuma. Cada um esperava a vez direitinho DENTRO da sua fila, e mesmo assim
 * o quadro saia injusto. Com fila unica, ser designado em QUALQUER funcao manda o irmao para
 * o fim da fila inteira — o descanso passa a ser igual para todos, independente de quantas
 * funcoes o irmao faz.
 *
 * Audio e Video e a excecao combinada: sao poucos habilitados para 16 vagas por mes, entao
 * ali a repeticao e inevitavel. Duas coisas garantem que ela nao contamine o resto: A e V e
 * a PRIMEIRA funcao resolvida em cada dia (ver ordenarFuncoes), entao quem e de A e V e pego
 * para A e V antes que outra funcao o consuma; e, como cada designacao de A e V manda o irmao
 * para o fim da fila unica, ele raramente volta a frente a tempo de tomar uma vaga de quem so
 * faz microfone, indicador ou estacionamento.
 *
 * As RESTRICOES continuam: irmao inativo, funcao do irmao, indisponibilidade na data, nivel
 * de Audio e Video e o fato de ninguem poder ocupar duas vagas no mesmo dia.
 */

const FUNCAO_MAP = {
    'Microfone Volante': 'microfone',
    'Indicador': 'indicador',
    'Audio e Video': 'audioVideo',
    'Estacionamento': 'estacionamento'
};

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

        // 3. Historico dos meses anteriores: define a ordem inicial da fila
        const ultimaPosicao = await this.carregarHistorico(mes, ano);
        const fila = this.montarFila(irmaos, ultimaPosicao);

        // Dentro de um mesmo dia, as funcoes com menos habilitados escolhem primeiro (A e V
        // sempre na frente). Resolver microfone antes de estacionamento pode consumir o unico
        // irmao que faz estacionamento e deixar a vaga vazia — o contrario nunca acontece.
        const ordemDasFuncoes = this.ordenarFuncoes(irmaos);

        // 4. Turnos em ordem cronologica
        const datas = Object.keys(designacoesPorData).sort((a, b) =>
            diaMesEmNumero(a) - diaMesEmNumero(b));

        for (const data of datas) {
            // Ninguem ocupa duas vagas no mesmo dia, mesmo que acumule funcoes.
            const jaDesignadosNoDia = new Set();

            const vagasDoDia = designacoesPorData[data].slice().sort((a, b) =>
                ordemDasFuncoes.indexOf(a.funcao) - ordemDasFuncoes.indexOf(b.funcao));

            for (const designacao of vagasDoDia) {
                const funcaoId = FUNCAO_MAP[designacao.funcao];
                if (!funcaoId) continue;

                // Restricao comum a todas as vagas daquele turno
                const podeServir = (irmao) => {
                    if (!irmao.funcoes.includes(funcaoId)) return false;
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
     * Ordem em que as funcoes de um mesmo dia sao resolvidas: Audio e Video sempre primeiro
     * (combinado: quem e de A e V serve em A e V, mesmo tendo outras funcoes), depois as
     * demais da que tem MENOS irmaos habilitados para a que tem mais.
     *
     * A fila e unica, entao a primeira funcao resolvida escolhe entre todos os elegiveis e as
     * seguintes escolhem entre o que sobrou naquele dia. Quem tem poucos candidatos precisa
     * escolher antes, ou a vaga fica vazia.
     *
     * @returns {string[]} rotulos de funcao ('Audio e Video', ...) na ordem de resolucao
     */
    ordenarFuncoes(irmaos) {
        const habilitados = (funcaoId) => irmaos.filter(i => i.funcoes.includes(funcaoId)).length;

        return Object.keys(FUNCAO_MAP).sort((a, b) => {
            const idA = FUNCAO_MAP[a];
            const idB = FUNCAO_MAP[b];
            const avA = idA === 'audioVideo' ? 0 : 1;
            const avB = idB === 'audioVideo' ? 0 : 1;
            return avA - avB || habilitados(idA) - habilitados(idB) || a.localeCompare(b);
        });
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
     * Posicao da ULTIMA vaga que cada irmao ocupou, olhando TODOS os quadros anteriores —
     * somando as quatro funcoes, porque a fila e uma so. Gerar um mes novo nao recomeca do
     * zero: a fila do mes N sai de como terminou o mes N-1.
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
     * As vagas de um mesmo dia sao contadas em ordem alfabetica de funcao, e nao na ordem em
     * que foram geradas: o quadro pode ter sido editado a mao depois, entao a ordem real de
     * geracao nao sobrevive no banco. So afeta a ordem relativa de quem serviu no ultimo dia
     * do mes, em funcoes diferentes.
     *
     * @returns {Object} { nome: posicao }
     */
    async carregarHistorico(mes, ano) {
        const ultimaPosicao = {};

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
                .sort((a, b) => diaMesEmNumero(a.data) - diaMesEmNumero(b.data)
                    || String(a.funcao).localeCompare(String(b.funcao)));

            for (const d of linhas) {
                for (const nome of [d.irmao1, d.irmao2]) {
                    posicao += 1;
                    if (nome) ultimaPosicao[nome] = posicao;
                }
            }
        }

        return ultimaPosicao;
    }

    /**
     * Fila inicial: quem nunca serviu na frente de todos, depois quem serviu ha mais tempo
     * (menor posicao no historico).
     *
     * Entram TODOS os irmaos ativos, inclusive quem nao faz nenhuma das quatro funcoes — ele
     * simplesmente nunca passa no filtro de nenhuma vaga e fica parado na fila, sem atrapalhar.
     *
     * O empate por nome so decide entre irmaos que NUNCA serviram — duas posicoes iguais nao
     * existem, porque o contador anda a cada vaga. Serve para a geracao ser reproduzivel.
     */
    montarFila(irmaos, ultimaPosicao) {
        return irmaos.slice().sort((a, b) => {
            const ultimaA = ultimaPosicao[a.nome];
            const ultimaB = ultimaPosicao[b.nome];

            if (ultimaA === undefined && ultimaB !== undefined) return -1;
            if (ultimaA !== undefined && ultimaB === undefined) return 1;
            if (ultimaA !== undefined && ultimaB !== undefined && ultimaA !== ultimaB) {
                return ultimaA - ultimaB;
            }
            return a.nome.localeCompare(b.nome);
        });
    }
}

module.exports = new AutoDesignacaoService();
