'use strict';

/**
 * Nucleo de decisao da Escala de Dirigentes (saidas de campo).
 *
 * Este modulo e PURO de proposito: nao conhece Prisma, nao faz I/O e nao le o relogio.
 * Recebe o universo ja montado (vagas + dirigentes + historico) e devolve as atribuicoes
 * junto de um diagnostico. Isso permite simular o mes inteiro e provar cada regra sem banco.
 *
 * O problema que ele resolve
 * --------------------------
 * Cada saida de campo tem a sua propria lista de irmaos habilitados (DirigenteSaidaCampo).
 * Uns estao vinculados a 5 saidas por semana, outros a 1 so. Ordenar pela contagem bruta de
 * designacoes - como fazia a versao antiga - e injusto nos dois sentidos:
 *
 *   - o irmao ESCASSO perde: suas poucas datas sao tomadas por quem tinha alternativa;
 *   - o irmao ABUNDANTE cansa: aparece em todo lugar so porque cabe em todo lugar.
 *
 * A correcao tem tres pernas, e as tres importam:
 *
 *   1) COTA - quanto cada um deveria receber, por max-min fairness (water-filling).
 *      Todos tendem ao mesmo numero; quem e limitado pela propria disponibilidade recebe o
 *      maximo que consegue e a sobra e redistribuida entre os demais.
 *
 *   2) URGENCIA - quem deve receber ESTA vaga agora = deficit / oportunidades restantes.
 *      Um irmao que so dirige as quartas, devendo 3 designacoes com 4 quartas pela frente,
 *      e muito mais critico que um que deve 3 e tem 20 chances. Sem isso a cota nao salva
 *      ninguem: a vaga escassa se esgota antes de o deficit aparecer.
 *
 *   3) REBALANCEAMENTO - o preenchimento e guloso e cronologico, entao decide sem saber o
 *      que vem depois. Uma busca local no fim olha o mes inteiro e troca ocupantes enquanto
 *      isso aproximar todo mundo da propria cota.
 */

/** Regras expostas ao usuario, com os padroes de fabrica. */
const REGRAS_PADRAO = {
    // --- restricoes ---
    respeitarIndisponibilidades: true, // nao escalar em data bloqueada pelo irmao
    evitarDuplicidadeNoDia: true,      // o mesmo irmao no maximo 1x por data
    preencherSubstituto: true,         // gerar tambem a coluna de substituto

    // --- equilibrio ---
    distribuicaoIgualitaria: true,     // balancear a quantidade de designacoes
    ponderarDisponibilidade: true,     // cota proporcional a disponibilidade real de cada um
    designarTodos: true,               // garantir ao menos 1 designacao para cada dirigente
    evitarRepeticoes: true,            // respeitar um intervalo de descanso entre designacoes
    equilibrarPapeis: true,            // alternar principal x substituto
    rodizioLocais: true,               // variar a saida/local de cada irmao
    evitarRepetirDupla: true,          // evitar sempre a mesma dupla principal + substituto
    considerarMesAnterior: true,       // herdar carga e ultima data do mes anterior

    // --- parametros numericos ---
    diasDescanso: 7                    // intervalo desejado (em dias) entre designacoes
};

/**
 * Pesos do score guloso. Sao dados, nao codigo: da para calibrar sem mexer no algoritmo.
 * A ordem de grandeza codifica a prioridade das regras entre si.
 */
const PESOS_PADRAO = {
    semDesignacao: 3.0, // "garantir que todos sejam designados" e a regra mais forte
    urgencia: 2.0,      // ponderacao de disponibilidade
    descanso: 1.5,      // evitar repeticoes
    cota: 1.0,          // distribuicao igualitaria
    heranca: 0.5,       // compensar o desequilibrio do mes anterior
    papel: 0.9,         // equilibrio principal/substituto (termo com sinal: penaliza e premia)
    local: 0.3,         // rodizio de locais
    dupla: 0.3,         // evitar dupla repetida
    desempate: 0.02     // ruido deterministico (mata o vies de ordem do array)
};

const PAPEIS = ['principal', 'substituto'];

/** Quanto uma violacao de descanso pesa dentro do custo do rebalanceamento. */
const CUSTO_DESCANSO = 0.5;

/** Parametros da busca local. O problema e pequeno (dezenas de vagas), cabe folga. */
const BUSCA = {
    iteracoes: 600,
    tabu: 7,           // por quantas iteracoes uma vaga recem-mexida fica bloqueada
    estagnacao: 80     // para quando passa esse tanto de iteracoes sem bater recorde
};

// ---------------------------------------------------------------------------
// Utilitarios
// ---------------------------------------------------------------------------

/**
 * FNV-1a normalizado em [0,1). Serve de desempate estavel: o mesmo quadro sempre produz a
 * mesma escala, mas a ordem nao e alfabetica nem a de insercao no banco - que era o vies da
 * versao antiga, onde o primeiro do array vencia todo empate.
 */
function ruidoEstavel(texto) {
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) {
        h ^= texto.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) / 4294967296;
}

function limitar(valor, minimo, maximo) {
    return Math.min(maximo, Math.max(minimo, valor));
}

/**
 * Chave de horario de uma vaga, usada para impedir sobreposicao fisica.
 *
 * Nos dados reais o sabado tem turno 1 e turno 3 os DOIS as 08:45, em casas diferentes.
 * Estar nos dois e impossivel na vida real, entao esta e a unica restricao que nunca e
 * relaxada junto com a duplicidade no dia. Sem `horario` cada saida vira a propria chave,
 * o que preserva o comportamento antigo em vez de bloquear o dia inteiro por engano.
 */
function chaveHorario(base) {
    return base.horario
        ? `${base.data}|h${base.horario}`
        : `${base.data}|s${base.saidaCampoId}`;
}

function diasEntre(dataA, dataB) {
    return Math.abs(dataB.getTime() - dataA.getTime()) / 86400000;
}

// ---------------------------------------------------------------------------
// Cotas: max-min fairness (water-filling)
// ---------------------------------------------------------------------------

/**
 * Calcula a cota max-min de cada dirigente REALIZANDO-A de fato.
 *
 * Por que nao basta o water-filling sobre a capacidade individual: ele so enxerga o teto de
 * cada um isoladamente e ignora gargalo de GRUPO. Nos dados reais, terca + sexta + sabado T3
 * so tem 5 irmaos habilitados no total para 24 vagas no mes: esses cinco sao obrigados a uma
 * media de 4,8, mas a media global e 3,46. A cota ingenua entregava 3,46 a eles - um alvo
 * matematicamente inatingivel. O efeito pratico era ruim em dois lugares: o rebalanceamento
 * perseguia um alvo impossivel, e o diagnostico exibia "aproveitamento 1,73" para quem estava
 * exatamente onde tinha de estar, como se a escala estivesse desequilibrada.
 *
 * A cota correta e o vetor de cargas do emparelhamento lexicograficamente max-min. Ele e
 * obtido servindo repetidamente o irmao mais "seco" que ainda tem caminho aumentante no
 * bipartido (irmao x vaga), com a restricao de no maximo uma vaga por data. Quando ninguem
 * mais aumenta, o vetor resultante e atingivel por construcao e maximiza o menor quinhao.
 *
 * Efeito colateral util: "garantir que todos sejam designados" vira corolario - se existe
 * QUALQUER escala em que o irmao aparece, a cota dele sai >= 1.
 */
function calcularCotas(dirigentes, bases, papeisAtivos, elegivelPara, regras, seed) {
    dirigentes.forEach(d => { d.cota = 0; });
    const ativos = dirigentes.filter(d => d.capacidade > 0);
    if (ativos.length === 0) return;

    const totalVagas = bases.length * papeisAtivos.length;

    // Sem balanceamento: ninguem tem teto e o score ignora os termos de cota.
    if (!regras.distribuicaoIgualitaria) {
        ativos.forEach(d => { d.cota = Infinity; });
        return;
    }

    // Sem ponderacao: media simples. E o comportamento "ingenuo", mantido como opcao para o
    // usuario poder comparar os dois modos lado a lado.
    if (!regras.ponderarDisponibilidade) {
        const media = totalVagas / ativos.length;
        ativos.forEach(d => { d.cota = media; });
        return;
    }

    // --- monta o bipartido ---
    const vagas = [];
    const indicePorBasePapel = new Map();
    for (const base of bases) {
        for (const papel of papeisAtivos) {
            indicePorBasePapel.set(`${base.id}:${papel}`, vagas.length);
            vagas.push({ base, papel });
        }
    }

    const vagasDe = new Map();
    ativos.forEach(d => {
        const lista = [];
        vagas.forEach((v, i) => { if (elegivelPara(d, v.base)) lista.push(i); });
        vagasDe.set(d.nome, lista);
    });

    const dono = new Array(vagas.length).fill(null);
    const datas = new Map(ativos.map(d => [d.nome, new Map()])); // nome -> Map(data -> qtd)
    const carga = new Map(ativos.map(d => [d.nome, 0]));

    const ocupar = (nome, i) => {
        dono[i] = nome;
        const m = datas.get(nome);
        const chave = vagas[i].base.data;
        m.set(chave, (m.get(chave) || 0) + 1);
        carga.set(nome, carga.get(nome) + 1);
    };

    const liberar = (i) => {
        const nome = dono[i];
        if (!nome) return;
        const m = datas.get(nome);
        const chave = vagas[i].base.data;
        const restante = (m.get(chave) || 1) - 1;
        if (restante <= 0) m.delete(chave); else m.set(chave, restante);
        carga.set(nome, carga.get(nome) - 1);
        dono[i] = null;
    };

    const cabeNaVaga = (nome, i) => {
        const { base, papel } = vagas[i];
        // Nunca as duas vagas da mesma saida.
        for (const outro of papeisAtivos) {
            if (outro === papel) continue;
            const j = indicePorBasePapel.get(`${base.id}:${outro}`);
            if (j !== undefined && dono[j] === nome) return false;
        }
        if (regras.evitarDuplicidadeNoDia && datas.get(nome).has(base.data)) return false;
        return true;
    };

    // Kuhn: tenta dar mais uma vaga a `nome`, deslocando os ocupantes em cadeia se preciso.
    const aumentar = (nome, visitadas) => {
        for (const i of vagasDe.get(nome)) {
            if (visitadas.has(i)) continue;
            if (!cabeNaVaga(nome, i)) continue;
            visitadas.add(i);

            if (dono[i] === null) {
                ocupar(nome, i);
                return true;
            }

            const anterior = dono[i];
            liberar(i);
            if (cabeNaVaga(nome, i) && aumentar(anterior, visitadas)) {
                ocupar(nome, i);
                return true;
            }
            ocupar(anterior, i); // desfaz
        }
        return false;
    };

    // Desempate estavel: sem isso, entre dois irmaos simetricos o alfabeticamente menor
    // ganharia sempre a vaga extra - o mesmo vies de ordem que o resto do algoritmo combate.
    const ordem = new Map(ativos.map(d => [d.nome, ruidoEstavel(`${seed}|cota|${d.nome}`)]));

    const saturados = new Set();
    let progrediu = true;
    while (progrediu) {
        progrediu = false;
        const fila = ativos
            .filter(d => !saturados.has(d.nome))
            .sort((a, b) =>
                carga.get(a.nome) - carga.get(b.nome)
                || ordem.get(a.nome) - ordem.get(b.nome));

        for (const d of fila) {
            if (aumentar(d.nome, new Set())) {
                progrediu = true;
                break; // reordena: servimos sempre o mais seco
            }
            // Sem caminho aumentante agora significa sem caminho nunca mais: as atribuicoes
            // seguintes so ocupam vagas, nunca liberam.
            saturados.add(d.nome);
        }
    }

    ativos.forEach(d => { d.cota = carga.get(d.nome); });
}

// ---------------------------------------------------------------------------
// Custo (usado pela busca local)
// ---------------------------------------------------------------------------

/**
 * Custo de um dirigente: distancia quadratica ate a cota + violacoes de descanso.
 *
 * `simulacao` permite avaliar uma troca sem aplica-la: { deltaCarga, remover, adicionar }.
 */
function custoIrmao(d, regras, simulacao = null) {
    const deltaCarga = simulacao ? (simulacao.deltaCarga || 0) : 0;
    const carga = d.carga + deltaCarga;

    const desvio = Number.isFinite(d.cota) && d.cota > 0 ? carga - d.cota : 0;
    let custo = desvio * desvio;

    if (regras.evitarRepeticoes && regras.diasDescanso > 0) {
        const datas = [];
        d.datasUsadas.forEach((dataObj, chave) => {
            // So some da lista se aquela era a UNICA vaga dele na data. Com a duplicidade
            // relaxada ele pode ter duas no mesmo dia, e apagar a data inteira faria o custo
            // de descanso mentir.
            const ehAUltimaDaData = simulacao
                && chave === simulacao.remover
                && (d.ocupacoesPorData.get(chave) || 1) <= 1;
            if (!ehAUltimaDaData) datas.push(dataObj);
        });
        if (simulacao && simulacao.adicionar) datas.push(simulacao.adicionar);
        if (d.dataHistorico) datas.push(d.dataHistorico);

        datas.sort((a, b) => a.getTime() - b.getTime());
        for (let i = 1; i < datas.length; i++) {
            const intervalo = diasEntre(datas[i - 1], datas[i]);
            if (intervalo < regras.diasDescanso) {
                custo += CUSTO_DESCANSO * (regras.diasDescanso - intervalo) / regras.diasDescanso;
            }
        }
    }

    return custo;
}

function custoTotal(dirigentes, regras) {
    return dirigentes.reduce((soma, d) => soma + custoIrmao(d, regras), 0);
}

// ---------------------------------------------------------------------------
// Score do preenchimento guloso
// ---------------------------------------------------------------------------

/**
 * Menor score = melhor candidato. Todos os termos sao normalizados em torno de [0,1] para que
 * os pesos, e nao a escala das grandezas, definam a prioridade das regras.
 */
function calcularScore(d, vaga, contexto) {
    const { regras, pesos, seed } = contexto;
    const temCota = Number.isFinite(d.cota) && d.cota > 0;

    // --- distribuicao igualitaria: quanto da propria cota ja foi consumido ---
    const pressaoCota = temCota ? d.carga / d.cota : 0;

    // --- ponderacao de disponibilidade: deficit por oportunidade restante ---
    // Poucas chances + muito a receber = critico. Muitas chances = pode esperar.
    let urgencia = 0;
    if (temCota) {
        const deficit = Math.max(0, d.cota - d.carga);
        urgencia = limitar(deficit / Math.max(1, d.oportRestantes), 0, 2);
    }

    // --- garantir que todos sejam designados ---
    // O piso de 0.35 sustenta a prioridade de quem ainda nao tem nada; o resto cresce
    // conforme as chances dele se esgotam.
    let semDesignacao = 0;
    if (regras.designarTodos && d.carga === 0 && d.capacidade > 0) {
        semDesignacao = 0.35 + 0.65 / Math.max(1, d.oportRestantes);
    }

    // --- descanso entre designacoes (suave, nao filtro) ---
    let descanso = 0;
    if (regras.evitarRepeticoes && d.ultimaDataObj && regras.diasDescanso > 0) {
        const intervalo = diasEntre(d.ultimaDataObj, vaga.dataObj);
        if (intervalo < regras.diasDescanso) {
            descanso = (regras.diasDescanso - intervalo) / regras.diasDescanso;
        }
    }

    // --- equilibrio principal x substituto ---
    // Termo COM SINAL: quem esta sobre-representado num papel e penalizado nele, e quem esta
    // sub-representado ganha bonus. Com a versao so-penalidade, um irmao que nunca foi
    // principal nao recebia nenhum empurrao para virar principal - ele simplesmente nao era
    // punido -, e acabava substituto o mes inteiro (o irmao que "aparece 4x" e nunca dirige).
    let papel = 0;
    if (regras.equilibrarPapeis && d.carga > 0) {
        const noPapel = vaga.papel === 'principal' ? d.principais : d.substitutos;
        papel = limitar((noPapel / d.carga - 0.5) * 2, -1, 1);
    }

    // --- rodizio de locais/saidas ---
    let local = 0;
    if (regras.rodizioLocais && d.carga > 0) {
        local = (d.porSaida.get(vaga.saidaCampoId) || 0) / d.carga;
    }

    // --- evitar repetir a mesma dupla ---
    let dupla = 0;
    if (regras.evitarRepetirDupla && vaga.parceiro && d.carga > 0) {
        dupla = (d.parceiros.get(vaga.parceiro) || 0) / d.carga;
    }

    // --- compensacao do mes anterior ---
    const heranca = regras.considerarMesAnterior ? d.desvioAnterior : 0;

    const desempate = ruidoEstavel(`${seed}|${vaga.chave}|${d.nome}`);

    return (
        pesos.cota * pressaoCota
        - pesos.urgencia * urgencia
        - pesos.semDesignacao * semDesignacao
        + pesos.descanso * descanso
        + pesos.papel * papel
        + pesos.local * local
        + pesos.dupla * dupla
        + pesos.heranca * heranca
        + pesos.desempate * desempate
    );
}

// ---------------------------------------------------------------------------
// Estado agregado
// ---------------------------------------------------------------------------

/**
 * Recalcula todos os agregados por dirigente a partir de `resultado`.
 *
 * A busca local desfaz e refaz atribuicoes o tempo todo; manter contadores incrementais
 * corretos em todos os caminhos e uma fonte classica de bug silencioso. Recalcular do zero
 * custa quase nada neste tamanho de problema e elimina a classe inteira de erro.
 */
function recomputarAgregados(dirigentes, bases, resultado, porNome) {
    dirigentes.forEach(d => {
        d.carga = 0;
        d.principais = 0;
        d.substitutos = 0;
        d.porSaida = new Map();
        d.parceiros = new Map();
        d.datasUsadas = new Map();
        d.ocupacoesPorData = new Map(); // quantas vagas na data (>1 se a duplicidade foi relaxada)
        d.horariosUsados = new Set();
        d.ultimaDataObj = d.dataHistorico || null;
    });

    for (const base of bases) {
        const v = resultado.get(base.id);
        const ocupantes = [
            { nome: v.principal, papel: 'principal', parceiro: v.substituto },
            { nome: v.substituto, papel: 'substituto', parceiro: v.principal }
        ];

        for (const { nome, papel, parceiro } of ocupantes) {
            if (!nome) continue;
            const d = porNome.get(nome);
            if (!d) continue;

            d.carga += 1;
            if (papel === 'principal') d.principais += 1; else d.substitutos += 1;
            d.datasUsadas.set(base.data, base.dataObj);
            d.ocupacoesPorData.set(base.data, (d.ocupacoesPorData.get(base.data) || 0) + 1);
            d.horariosUsados.add(chaveHorario(base));
            d.porSaida.set(base.saidaCampoId, (d.porSaida.get(base.saidaCampoId) || 0) + 1);
            if (parceiro) {
                d.parceiros.set(parceiro, (d.parceiros.get(parceiro) || 0) + 1);
            }
            if (!d.ultimaDataObj || d.ultimaDataObj < base.dataObj) {
                d.ultimaDataObj = base.dataObj;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Motor principal
// ---------------------------------------------------------------------------

/**
 * @param {Object} entrada
 * @param {Array}  entrada.vagasBase  [{ id, data, dataObj, saidaCampoId, local, turno }]
 *                                    uma entrada por EscalaDirigente (cada uma rende 2 vagas)
 * @param {Array}  entrada.dirigentes [{ nome, saidaCampoIds:[], indisponiveis:[] }]
 * @param {Object} entrada.historico  { [nome]: { designacoes, ultimaDataObj } } do mes anterior
 * @param {Object} entrada.regras
 * @param {Object} [entrada.pesos]
 * @param {string} [entrada.seed]     torna o resultado reproduzivel
 */
function gerarEscala(entrada) {
    const regras = { ...REGRAS_PADRAO, ...(entrada.regras || {}) };
    const pesos = { ...PESOS_PADRAO, ...(entrada.pesos || {}) };
    const seed = String(entrada.seed ?? 'escala-dirigentes');
    const historico = entrada.historico || {};

    const avisos = [];
    const relaxamentos = {};
    const registrarRelaxamento = (regra) => {
        relaxamentos[regra] = (relaxamentos[regra] || 0) + 1;
    };

    // ---- 1. Estado por dirigente ------------------------------------------
    const dirigentes = (entrada.dirigentes || []).map(d => ({
        nome: d.nome,
        saidas: new Set(d.saidaCampoIds || []),
        indisponiveis: new Set(d.indisponiveis || []),

        datasElegiveis: [],   // ordenada cronologicamente
        cursor: 0,            // ponteiro para a proxima data ainda no futuro
        capacidade: 0,
        oportRestantes: 0,
        cota: 0,

        carga: 0,
        principais: 0,
        substitutos: 0,
        ultimaDataObj: null,
        dataHistorico: null,  // ultima designacao do mes anterior (imutavel)
        porSaida: new Map(),
        parceiros: new Map(),
        datasUsadas: new Map(),      // data -> Date
        ocupacoesPorData: new Map(), // data -> qtd de vagas nessa data
        horariosUsados: new Set(),   // "data|hHH:MM" - sobreposicao fisica, nunca relaxada
        desvioAnterior: 0
    }));

    const porNome = new Map(dirigentes.map(d => [d.nome, d]));

    // ---- 2. Heranca do mes anterior ---------------------------------------
    // A carga anterior NAO entra na carga do mes (isso zeraria quem trabalhou muito). Entra
    // como um desvio relativo a media, que apenas inclina o desempate.
    if (regras.considerarMesAnterior && dirigentes.length > 0) {
        const cargasAnteriores = dirigentes.map(d => historico[d.nome]?.designacoes || 0);
        const mediaAnterior = cargasAnteriores.reduce((a, b) => a + b, 0) / cargasAnteriores.length;

        dirigentes.forEach(d => {
            const h = historico[d.nome];
            if (!h) return;
            d.dataHistorico = h.ultimaDataObj || null;
            d.ultimaDataObj = d.dataHistorico;
            if (mediaAnterior > 0) {
                d.desvioAnterior = limitar(
                    ((h.designacoes || 0) - mediaAnterior) / mediaAnterior, -1, 1
                );
            }
        });
    }

    // ---- 3. Universo de vagas ---------------------------------------------
    const bases = [...(entrada.vagasBase || [])].sort((a, b) => {
        const dif = a.dataObj.getTime() - b.dataObj.getTime();
        if (dif !== 0) return dif;
        if ((a.turno || 0) !== (b.turno || 0)) return (a.turno || 0) - (b.turno || 0);
        return a.id - b.id;
    });

    const elegivelPara = (d, base) =>
        d.saidas.has(base.saidaCampoId)
        && !(regras.respeitarIndisponibilidades && d.indisponiveis.has(base.data));

    /**
     * Restricoes que valem SEMPRE, inclusive no caminho de degradacao: ninguem pode estar em
     * duas saidas no mesmo horario, nem ocupar as duas vagas da mesma saida.
     */
    const livrePara = (d, base, atual, papel) => {
        if (d.horariosUsados.has(chaveHorario(base))) return false;
        if (d.nome === atual.principal || d.nome === atual.substituto) return false;
        return true;
    };

    const datasOrdenadas = [];
    const vistas = new Set();
    for (const base of bases) {
        if (!vistas.has(base.data)) {
            vistas.add(base.data);
            datasOrdenadas.push({ data: base.data, dataObj: base.dataObj });
        }
    }

    // Capacidade = datas distintas elegiveis (no maximo 1 designacao por data).
    const basesPorData = new Map();
    for (const base of bases) {
        if (!basesPorData.has(base.data)) basesPorData.set(base.data, []);
        basesPorData.get(base.data).push(base);
    }

    for (const d of dirigentes) {
        for (const dia of datasOrdenadas) {
            if (basesPorData.get(dia.data).some(b => elegivelPara(d, b))) {
                d.datasElegiveis.push(dia);
            }
        }
        d.capacidade = d.datasElegiveis.length;
        d.oportRestantes = d.capacidade;
    }

    // ---- 4. Cotas ---------------------------------------------------------
    const papeisAtivos = regras.preencherSubstituto ? PAPEIS : ['principal'];
    const totalVagas = bases.length * papeisAtivos.length;
    calcularCotas(dirigentes, bases, papeisAtivos, elegivelPara, regras, seed);

    // ---- 5. Preenchimento guloso, em ordem cronologica --------------------
    const resultado = new Map();
    bases.forEach(b => resultado.set(b.id, { principal: '', substituto: '' }));

    const contexto = { regras, pesos, seed };

    for (const dia of datasOrdenadas) {
        // Oportunidades restantes = datas elegiveis de hoje em diante.
        for (const d of dirigentes) {
            while (
                d.cursor < d.datasElegiveis.length
                && d.datasElegiveis[d.cursor].dataObj.getTime() < dia.dataObj.getTime()
            ) {
                d.cursor += 1;
            }
            d.oportRestantes = d.datasElegiveis.length - d.cursor;
        }

        const basesDoDia = basesPorData.get(dia.data);

        for (const papel of papeisAtivos) {
            const pendentes = new Set(basesDoDia.map(b => b.id));

            // MRV (most constrained first): dentro do dia, a saida com menos candidatos vivos
            // e resolvida primeiro. Sem isso o sabado - que tem ate 4 turnos na MESMA data -
            // deixa a ultima saida sem ninguem.
            while (pendentes.size > 0) {
                let escolhida = null;
                let dadosEscolhida = null;
                let menor = Infinity;

                for (const base of basesDoDia) {
                    if (!pendentes.has(base.id)) continue;

                    const atual = resultado.get(base.id);
                    const parceiro = papel === 'substituto' ? atual.principal : '';
                    const candidatos = dirigentes.filter(d =>
                        elegivelPara(d, base)
                        && livrePara(d, base, atual, papel)
                        && !(regras.evitarDuplicidadeNoDia && d.datasUsadas.has(base.data))
                    );

                    if (candidatos.length < menor) {
                        menor = candidatos.length;
                        escolhida = base;
                        dadosEscolhida = { candidatos, parceiro };
                    }
                }

                if (!escolhida) break;
                pendentes.delete(escolhida.id);

                let { candidatos, parceiro } = dadosEscolhida;

                // Degradacao controlada. A indisponibilidade NUNCA e relaxada: e um
                // compromisso real do irmao. Repetir alguem no mesmo dia e o unico alivio, e
                // so quando a alternativa e deixar a saida sem dirigente.
                if (candidatos.length === 0 && regras.evitarDuplicidadeNoDia) {
                    const atual = resultado.get(escolhida.id);
                    // livrePara continua valendo: repetir no dia e aceitavel como ultimo
                    // recurso, estar em dois lugares no mesmo horario nunca e.
                    candidatos = dirigentes.filter(d =>
                        elegivelPara(d, escolhida) && livrePara(d, escolhida, atual, papel)
                    );
                    if (candidatos.length > 0) {
                        registrarRelaxamento('evitarDuplicidadeNoDia');
                        avisos.push({
                            tipo: 'duplicidade_no_dia',
                            data: escolhida.data,
                            saidaCampoId: escolhida.saidaCampoId,
                            mensagem: `Sem candidato livre em ${escolhida.data} para ${escolhida.local || 'a saida'}; um irmao precisou ser repetido no mesmo dia.`
                        });
                    }
                }

                // Vaga sem candidato fica vazia; o aviso so e emitido no fim, porque os passes
                // de correcao ainda podem preenche-la.
                if (candidatos.length === 0) continue;

                const vaga = {
                    // A chave nao pode usar `id`: ele e indice de array na criacao e id do
                    // banco na regeracao, o que faria o mesmo mes com as mesmas regras gerar
                    // escalas diferentes nos dois caminhos. Data + saida + papel e estavel.
                    chave: `${escolhida.data}|${escolhida.saidaCampoId}|${papel}`,
                    dataObj: escolhida.dataObj,
                    saidaCampoId: escolhida.saidaCampoId,
                    papel,
                    parceiro
                };

                let melhor = null;
                let melhorScore = Infinity;
                for (const d of candidatos) {
                    const s = calcularScore(d, vaga, contexto);
                    if (s < melhorScore) {
                        melhorScore = s;
                        melhor = d;
                    }
                }

                resultado.get(escolhida.id)[papel] = melhor.nome;

                melhor.carga += 1;
                if (papel === 'principal') melhor.principais += 1; else melhor.substitutos += 1;
                melhor.ultimaDataObj = escolhida.dataObj;
                melhor.datasUsadas.set(escolhida.data, escolhida.dataObj);
                melhor.ocupacoesPorData.set(escolhida.data, (melhor.ocupacoesPorData.get(escolhida.data) || 0) + 1);
                melhor.horariosUsados.add(chaveHorario(escolhida));
                melhor.porSaida.set(escolhida.saidaCampoId, (melhor.porSaida.get(escolhida.saidaCampoId) || 0) + 1);
                if (parceiro) {
                    melhor.parceiros.set(parceiro, (melhor.parceiros.get(parceiro) || 0) + 1);
                    const p = porNome.get(parceiro);
                    if (p) p.parceiros.set(melhor.nome, (p.parceiros.get(melhor.nome) || 0) + 1);
                }
            }
        }
    }

    // ---- 6. Passes de correcao -------------------------------------------
    // O guloso decide vaga a vaga, sem enxergar o mes inteiro. Estes passes olham o resultado
    // completo e corrigem o que a visao local errou.
    const ambiente = { dirigentes, bases, resultado, regras, porNome, elegivelPara, papeisAtivos };

    const reparos = [];
    if (regras.designarTodos) {
        repararOrfaos({ ...ambiente, reparos, avisos });
    }

    let trocasRebalanceamento = 0;
    if (regras.distribuicaoIgualitaria) {
        trocasRebalanceamento = rebalancear(ambiente);
        // O rebalanceamento pode ter aberto espaco para um orfao que antes nao cabia.
        if (regras.designarTodos) {
            repararOrfaos({ ...ambiente, reparos, avisos });
        }
    }

    // Por ultimo, porque as trocas anteriores podem ter liberado quem faltava.
    const vaziasPreenchidas = preencherVagasVazias(ambiente);

    recomputarAgregados(dirigentes, bases, resultado, porNome);

    // Depois de a carga estar decidida, so falta escolher quem dirige e quem e reserva.
    let trocasDePapel = 0;
    if (regras.equilibrarPapeis && regras.preencherSubstituto) {
        trocasDePapel = equilibrarPapeis(ambiente);
        recomputarAgregados(dirigentes, bases, resultado, porNome);
    }

    // ---- 7. Diagnostico ---------------------------------------------------
    let preenchidas = 0;
    for (const base of bases) {
        const v = resultado.get(base.id);
        for (const papel of papeisAtivos) {
            if (v[papel]) {
                preenchidas += 1;
            } else {
                avisos.push({
                    tipo: 'vaga_vazia',
                    data: base.data,
                    saidaCampoId: base.saidaCampoId,
                    papel,
                    mensagem: `Nenhum dirigente disponivel para ${papel} em ${base.data} (${base.local || 'saida'}).`
                });
            }
        }
    }

    // Um irmao pode ficar fora da cota sem que a escala esteja mal distribuida: se as saidas
    // dele tem mais vagas que candidatos, o grupo inteiro fica no teto e ninguem alcanca a
    // media. Perguntamos ao proprio modelo se ainda existe alguma troca que melhoraria - se
    // nao existe, o desvio e da estrutura dos dados, nao da distribuicao.
    const limitadosPorEstrutura = dirigentes
        .filter(d => Number.isFinite(d.cota) && d.cota > 0 && d.capacidade > 0)
        .filter(d => Math.abs(d.carga - d.cota) > 0.75)
        .filter(d => !existeTrocaMelhorante(d, ambiente))
        .map(d => d.nome);

    const cotaMedia = dirigentes.length > 0 ? totalVagas / dirigentes.length : 0;
    const gargalos = detectarGargalos(bases, dirigentes, papeisAtivos, cotaMedia, elegivelPara);

    const porIrmao = dirigentes
        .map(d => ({
            nome: d.nome,
            designacoes: d.carga,
            principais: d.principais,
            substitutos: d.substitutos,
            oportunidades: d.capacidade,
            cota: Number.isFinite(d.cota) ? Number(d.cota.toFixed(2)) : null,
            aproveitamento: Number.isFinite(d.cota) && d.cota > 0
                ? Number((d.carga / d.cota).toFixed(2))
                : null,
            saidasDistintas: d.porSaida.size,
            limitadoPelaDisponibilidade: limitadosPorEstrutura.includes(d.nome)
        }))
        .sort((a, b) => b.designacoes - a.designacoes || a.nome.localeCompare(b.nome));

    const semDesignacao = dirigentes
        .filter(d => d.carga === 0 && d.capacidade > 0)
        .map(d => d.nome);

    semDesignacao.forEach(nome => {
        avisos.push({
            tipo: 'irmao_sem_designacao',
            irmao: nome,
            mensagem: `${nome} nao pode ser escalado: todas as datas em que ele dirige ja estavam ocupadas ou bloqueadas.`
        });
    });

    dirigentes
        .filter(d => d.capacidade === 0)
        .forEach(d => avisos.push({
            tipo: 'sem_disponibilidade',
            irmao: d.nome,
            mensagem: `${d.nome} nao esta vinculado a nenhuma saida de campo ativa no periodo (ou esta indisponivel em todas as datas).`
        }));

    gargalos.forEach(g => {
        if (g.escopo === 'data') {
            avisos.push({
                tipo: 'dia_com_poucos_dirigentes',
                data: g.data,
                mensagem: `Dia ${g.data}: ${g.saidas} saida(s) = ${g.vagas} vagas, mas so ${g.candidatos} irmao(s) disponivel(is) nesse dia. Alguem tera de ser repetido no mesmo dia.`
            });
            return;
        }
        avisos.push({
            tipo: 'saida_com_poucos_dirigentes',
            saidaCampoId: g.saidaCampoId,
            mensagem: g.candidatos < papeisAtivos.length
                ? `${g.local || 'Saida'}: apenas ${g.candidatos} dirigente(s) habilitado(s) - nao da para preencher principal e substituto.`
                : `${g.local || 'Saida'}: ${g.vagas} vagas no mes para ${g.candidatos} dirigentes habilitados, o que forca ${g.cargaForcada} designacoes por irmao so nessa saida. Cadastrar mais dirigentes nela e o que mais equilibra a escala.`
        });
    });

    return {
        atribuicoes: bases.map(b => ({
            id: b.id,
            principal: resultado.get(b.id).principal,
            substituto: resultado.get(b.id).substituto
        })),
        diagnostico: {
            totalVagas,
            vagasPreenchidas: preenchidas,
            vagasVazias: totalVagas - preenchidas,
            totalDirigentes: dirigentes.length,
            semDesignacao,
            limitadosPelaDisponibilidade: limitadosPorEstrutura,
            gargalos,
            porIrmao,
            reparos,
            trocasRebalanceamento,
            vaziasPreenchidas,
            trocasDePapel,
            regrasRelaxadas: relaxamentos,
            avisos
        }
    };
}

// ---------------------------------------------------------------------------
// Passes de correcao
// ---------------------------------------------------------------------------

/** Aplica a troca de ocupante de uma vaga. Os agregados sao recalculados depois. */
function aplicarTroca(resultado, base, papel, nomeEntra) {
    resultado.get(base.id)[papel] = nomeEntra;
}

/**
 * Resgata os irmaos que terminaram o mes sem nenhuma designacao.
 *
 * Para cada orfao procura uma vaga onde ele caiba e cujo ocupante esteja mais acima da cota
 * (ou que esteja vazia) e troca. A troca so acontece se o ocupante ficar com pelo menos 1
 * designacao - assim nunca criamos um orfao novo para resolver outro, o numero de orfaos cai
 * estritamente a cada troca e o passe termina.
 */
function repararOrfaos(ambiente) {
    const { dirigentes, bases, resultado, regras, porNome, elegivelPara, papeisAtivos, reparos, avisos } = ambiente;

    const irrecuperaveis = new Set();
    const orfaos = () => dirigentes.filter(
        d => d.carga === 0 && d.capacidade > 0 && !irrecuperaveis.has(d.nome)
    );

    const limite = dirigentes.length * 2;

    for (let iteracao = 0; iteracao < limite; iteracao++) {
        const pendentes = orfaos();
        if (pendentes.length === 0) return;

        // Comeca pelo mais dificil de encaixar: menos oportunidades.
        pendentes.sort((a, b) => a.capacidade - b.capacidade || a.nome.localeCompare(b.nome));
        const orfao = pendentes[0];

        let melhor = null;

        for (const base of bases) {
            if (!elegivelPara(orfao, base)) continue;
            if (orfao.horariosUsados.has(chaveHorario(base))) continue;
            if (regras.evitarDuplicidadeNoDia && orfao.datasUsadas.has(base.data)) continue;

            const v = resultado.get(base.id);

            for (const papel of papeisAtivos) {
                const ocupante = v[papel];
                const outro = papel === 'principal' ? v.substituto : v.principal;
                if (outro === orfao.nome) continue;

                // Vaga vazia: ganho puro, sem tirar de ninguem.
                if (!ocupante) {
                    melhor = { base, papel, sai: null, prioridade: Infinity };
                    break;
                }

                const dOcupante = porNome.get(ocupante);
                if (!dOcupante || dOcupante.carga <= 1) continue; // nao criar outro orfao

                const folga = Number.isFinite(dOcupante.cota) && dOcupante.cota > 0
                    ? dOcupante.carga / dOcupante.cota
                    : dOcupante.carga;

                // Tiramos de quem esta mais acima da cota, preferindo mexer no substituto.
                const prioridade = folga + (papel === 'substituto' ? 0.15 : 0);
                if (!melhor || prioridade > melhor.prioridade) {
                    melhor = { base, papel, sai: dOcupante, prioridade };
                }
            }

            if (melhor && melhor.prioridade === Infinity) break;
        }

        if (!melhor) {
            irrecuperaveis.add(orfao.nome);
            avisos.push({
                tipo: 'reparo_impossivel',
                irmao: orfao.nome,
                mensagem: `Nao foi possivel abrir vaga para ${orfao.nome} sem deixar outro irmao sem designacao.`
            });
            continue;
        }

        aplicarTroca(resultado, melhor.base, melhor.papel, orfao.nome);
        recomputarAgregados(dirigentes, bases, resultado, porNome);

        reparos.push({
            irmao: orfao.nome,
            data: melhor.base.data,
            saidaCampoId: melhor.base.saidaCampoId,
            papel: melhor.papel,
            substituiu: melhor.sai ? melhor.sai.nome : null
        });
    }
}

/**
 * Busca local (tabu) que aproxima todo mundo da propria cota.
 *
 * Uma troca simples nem sempre existe mesmo quando a escala pode melhorar: e comum o irmao
 * sobrecarregado so ter vagas que o irmao folgado nao pode assumir porque ja esta escalado
 * naquela data. Sair desse plato exige aceitar um movimento NEUTRO primeiro (que libera a
 * data) para so entao aplicar o movimento que melhora.
 *
 * Por isso a busca aceita movimentos de custo nao-crescente, usa uma lista tabu para nao
 * desfazer o que acabou de fazer, e no fim restaura a melhor solucao que encontrou - o
 * resultado nunca e pior que o do preenchimento guloso.
 */
function rebalancear(ambiente) {
    const { dirigentes, bases, resultado, regras, porNome, elegivelPara, papeisAtivos } = ambiente;

    const instantaneo = () => {
        const copia = new Map();
        resultado.forEach((v, k) => copia.set(k, { ...v }));
        return copia;
    };
    const restaurar = (copia) => {
        copia.forEach((v, k) => resultado.set(k, { ...v }));
        recomputarAgregados(dirigentes, bases, resultado, porNome);
    };

    let custoAtual = custoTotal(dirigentes, regras);
    let melhorCusto = custoAtual;
    let melhorSolucao = instantaneo();
    let ultimoRecorde = 0;

    const tabu = new Map(); // "baseId:papel" -> iteracao ate a qual fica bloqueada
    let trocas = 0;

    for (let iteracao = 0; iteracao < BUSCA.iteracoes; iteracao++) {
        // Quando ja se passaram muitas iteracoes sem bater recorde, a escala esta no limite
        // que a estrutura permite: continuar so gasta tempo passeando pelo plato.
        if (iteracao - ultimoRecorde > BUSCA.estagnacao) break;

        let escolhido = null;
        let melhorDelta = 1e-9; // so aceita delta < isso, ou seja, nao-crescente

        for (const base of bases) {
            const v = resultado.get(base.id);

            for (const papel of papeisAtivos) {
                const nomeOcupante = v[papel];
                if (!nomeOcupante) continue;

                const sai = porNome.get(nomeOcupante);
                if (!sai) continue;
                // Nunca transformar alguem em orfao para equilibrar outro.
                if (regras.designarTodos && sai.carga <= 1) continue;

                const chaveTabu = `${base.id}:${papel}`;
                const bloqueada = (tabu.get(chaveTabu) || 0) > iteracao;

                const outro = papel === 'principal' ? v.substituto : v.principal;
                const custoSaiAntes = custoIrmao(sai, regras);
                const custoSaiDepois = custoIrmao(sai, regras, { deltaCarga: -1, remover: base.data });

                for (const entra of dirigentes) {
                    if (entra === sai || entra.nome === outro) continue;
                    if (!elegivelPara(entra, base)) continue;
                    if (entra.horariosUsados.has(chaveHorario(base))) continue;
                    if (regras.evitarDuplicidadeNoDia && entra.datasUsadas.has(base.data)) continue;

                    const delta =
                        (custoSaiDepois - custoSaiAntes)
                        + (custoIrmao(entra, regras, { deltaCarga: 1, adicionar: base.dataObj })
                            - custoIrmao(entra, regras));

                    if (delta >= melhorDelta) continue;
                    // Aspiracao: uma vaga tabu so pode ser mexida se levar a um novo recorde.
                    if (bloqueada && custoAtual + delta >= melhorCusto - 1e-9) continue;

                    melhorDelta = delta;
                    escolhido = { base, papel, entra, chaveTabu, delta };
                }
            }
        }

        if (!escolhido) break;

        aplicarTroca(resultado, escolhido.base, escolhido.papel, escolhido.entra.nome);
        recomputarAgregados(dirigentes, bases, resultado, porNome);
        custoAtual = custoTotal(dirigentes, regras);
        tabu.set(escolhido.chaveTabu, iteracao + BUSCA.tabu);
        trocas += 1;

        if (custoAtual < melhorCusto - 1e-9) {
            melhorCusto = custoAtual;
            melhorSolucao = instantaneo();
            ultimoRecorde = iteracao;
        }
    }

    restaurar(melhorSolucao);
    return trocas;
}

/**
 * Alterna principal e substituto dentro da MESMA escala enquanto isso reduzir o desequilibrio
 * de papeis do conjunto.
 *
 * Este passe e seguro por construcao: trocar as duas colunas de uma mesma linha nao muda a
 * carga de ninguem, nem a data, nem o local - so quem dirige e quem e reserva. Por isso ele
 * nao pode desfazer nada que a distribuicao igualitaria conquistou.
 *
 * Faz falta porque o preenchimento resolve todos os principais do dia antes dos substitutos:
 * um irmao de disponibilidade alta tem urgencia baixa, perde sempre a rodada dos principais e
 * termina o mes inteiro como reserva - aparecendo 3 ou 4 vezes na escala sem nunca dirigir.
 */
function equilibrarPapeis({ bases, resultado, porNome }) {
    const desequilibrio = (d) => Math.abs(d.principais - d.substitutos);
    let trocas = 0;

    for (let passada = 0; passada < 10; passada++) {
        let mudou = false;

        for (const base of bases) {
            const v = resultado.get(base.id);
            if (!v.principal || !v.substituto) continue;

            const p = porNome.get(v.principal);
            const s = porNome.get(v.substituto);
            if (!p || !s) continue;

            const antes = desequilibrio(p) + desequilibrio(s);
            const depois =
                Math.abs((p.principais - 1) - (p.substitutos + 1))
                + Math.abs((s.principais + 1) - (s.substitutos - 1));

            if (depois >= antes) continue;

            p.principais -= 1; p.substitutos += 1;
            s.principais += 1; s.substitutos -= 1;
            v.principal = s.nome;
            v.substituto = p.nome;
            trocas += 1;
            mudou = true;
        }

        if (!mudou) break;
    }

    return trocas;
}

/**
 * Preenche vagas que sobraram vazias.
 *
 * O guloso deixa uma vaga vazia quando, naquele instante, todo candidato estava indisponivel,
 * ja usado no dia ou em outra saida do mesmo horario. As trocas posteriores podem ter liberado
 * alguem. Sem este passe a vaga ficava vazia para sempre: `repararOrfaos` so cuida de quem tem
 * carga zero e `rebalancear` ignora slot sem ocupante.
 */
function preencherVagasVazias(ambiente) {
    const { dirigentes, bases, resultado, regras, porNome, elegivelPara, papeisAtivos } = ambiente;
    let preenchidas = 0;

    for (const base of bases) {
        for (const papel of papeisAtivos) {
            const v = resultado.get(base.id);
            if (v[papel]) continue;

            const candidatos = dirigentes.filter(d =>
                elegivelPara(d, base)
                && !d.horariosUsados.has(chaveHorario(base))
                && d.nome !== v.principal
                && d.nome !== v.substituto
                && !(regras.evitarDuplicidadeNoDia && d.datasUsadas.has(base.data))
            );
            if (candidatos.length === 0) continue;

            // Quem estiver mais longe da propria cota entra primeiro.
            candidatos.sort((a, b) => {
                const fa = Number.isFinite(a.cota) && a.cota > 0 ? a.carga / a.cota : a.carga;
                const fb = Number.isFinite(b.cota) && b.cota > 0 ? b.carga / b.cota : b.carga;
                return fa - fb || a.nome.localeCompare(b.nome);
            });

            v[papel] = candidatos[0].nome;
            recomputarAgregados(dirigentes, bases, resultado, porNome);
            preenchidas += 1;
        }
    }

    return preenchidas;
}

/**
 * Existe alguma troca simples que aproximaria `alvo` da cota sem piorar o conjunto?
 * Se nao existe, a carga dele nao e culpa da distribuicao: e o que a estrutura permite.
 */
function existeTrocaMelhorante(alvo, { bases, resultado, regras, porNome, elegivelPara, papeisAtivos }) {
    for (const base of bases) {
        if (!elegivelPara(alvo, base)) continue;
        if (alvo.horariosUsados.has(chaveHorario(base))) continue;
        if (regras.evitarDuplicidadeNoDia && alvo.datasUsadas.has(base.data)) continue;

        const v = resultado.get(base.id);
        const ganhoAlvo = custoIrmao(alvo, regras, { deltaCarga: 1, adicionar: base.dataObj })
            - custoIrmao(alvo, regras);

        for (const papel of papeisAtivos) {
            const ocupante = v[papel];
            const outro = papel === 'principal' ? v.substituto : v.principal;
            if (outro === alvo.nome) continue;
            if (!ocupante) return true;

            const sai = porNome.get(ocupante);
            if (!sai || (regras.designarTodos && sai.carga <= 1)) continue;

            const ganhoSai = custoIrmao(sai, regras, { deltaCarga: -1, remover: base.data })
                - custoIrmao(sai, regras);

            if (ganhoAlvo + ganhoSai < -1e-9) return true;
        }
    }
    return false;
}

/**
 * Identifica os dois tipos de gargalo do cadastro. E a informacao mais acionavel do
 * diagnostico: quem le sabe exatamente onde faltam dirigentes habilitados.
 *
 *  - por SAIDA: a saida tem mais vagas no mes do que os irmaos habilitados nela conseguem
 *    cobrir sem estourar a cota (foi o caso da terca, com 3 dirigentes para 10 vagas);
 *  - por DATA: o dia tem mais vagas do que irmaos disponiveis naquele dia, o que acontece no
 *    sabado, onde varios turnos caem na MESMA data e a regra de nao repetir no dia obriga
 *    um irmao distinto por vaga.
 */
function detectarGargalos(bases, dirigentes, papeisAtivos, cotaMedia, elegivelPara) {
    const gargalos = [];

    // --- por saida ---
    const porSaida = new Map();
    for (const base of bases) {
        if (!porSaida.has(base.saidaCampoId)) {
            porSaida.set(base.saidaCampoId, {
                saidaCampoId: base.saidaCampoId,
                local: base.local || null,
                datas: 0,
                candidatos: new Set()
            });
        }
        const info = porSaida.get(base.saidaCampoId);
        info.datas += 1;
        dirigentes.forEach(d => {
            if (elegivelPara(d, base)) info.candidatos.add(d.nome);
        });
    }

    porSaida.forEach(info => {
        const vagas = info.datas * papeisAtivos.length;
        const qtd = info.candidatos.size;
        const cargaForcada = qtd > 0 ? vagas / qtd : Infinity;
        if (qtd < papeisAtivos.length || cargaForcada > cotaMedia + 0.5) {
            gargalos.push({
                escopo: 'saida',
                saidaCampoId: info.saidaCampoId,
                local: info.local,
                datas: info.datas,
                vagas,
                candidatos: qtd,
                cargaForcada: Number.isFinite(cargaForcada) ? Number(cargaForcada.toFixed(2)) : null
            });
        }
    });

    // --- por data ---
    const porData = new Map();
    for (const base of bases) {
        if (!porData.has(base.data)) {
            porData.set(base.data, { data: base.data, saidas: 0, candidatos: new Set() });
        }
        const info = porData.get(base.data);
        info.saidas += 1;
        dirigentes.forEach(d => {
            if (elegivelPara(d, base)) info.candidatos.add(d.nome);
        });
    }

    porData.forEach(info => {
        const vagas = info.saidas * papeisAtivos.length;
        if (info.candidatos.size < vagas) {
            gargalos.push({
                escopo: 'data',
                data: info.data,
                saidas: info.saidas,
                vagas,
                candidatos: info.candidatos.size,
                cargaForcada: null
            });
        }
    });

    return gargalos.sort((a, b) => (b.cargaForcada || 0) - (a.cargaForcada || 0));
}

module.exports = {
    gerarEscala,
    calcularCotas,
    REGRAS_PADRAO,
    PESOS_PADRAO,
    _internos: { ruidoEstavel, limitar, diasEntre, custoIrmao, custoTotal, recomputarAgregados }
};
