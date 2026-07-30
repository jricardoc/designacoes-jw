'use strict';

/**
 * Nucleo de decisao da Escala de Dirigentes (saidas de campo).
 *
 * Este modulo e PURO de proposito: nao conhece Prisma, nao faz I/O e nao le o relogio.
 * Recebe o universo ja montado (turnos + dirigentes + historico) e devolve as atribuicoes
 * junto de um diagnostico. Isso permite simular o mes inteiro e provar cada regra sem banco.
 *
 * A REGRA DE OURO
 * ---------------
 * Nao existe mais pontuacao, peso, cota ou busca local. A escala e um RODIZIO puro, do jeito
 * que o usuario descreveu: "primeiro voce distribui todos, e quando todos ja estiverem
 * distribuidos, vai distribuindo os seguintes que foram os primeiros".
 *
 *   1. Existe uma FILA unica de dirigentes. A ordem inicial vem do historico: quem serviu ha
 *      mais tempo fica na frente, quem nunca serviu fica na frente de todos.
 *   2. Os turnos sao percorridos em ordem cronologica. Para cada turno andamos na fila do
 *      inicio para o fim e pegamos o PRIMEIRO irmao que possa servir naquele turno.
 *   3. PULA E MANTEM A VEZ: quem nao pode servir naquele dia NAO perde a vez - continua na
 *      frente e pega o proximo turno compativel. E isso que faz o irmao que so dirige as
 *      segundas reaparecer duas semanas depois, numa segunda, sem ter servido no meio.
 *   4. Quem foi designado vai para o FIM da fila. Quando todos ja serviram, o ciclo reinicia
 *      na mesma ordem em que serviram - e dai que sai o intervalo justo entre designacoes.
 *
 * O historico dos meses anteriores nao e enfeite: a fila inicial do mes N e como a fila do
 * mes N-1 terminou. Sem ele, quem fechasse um mes servindo abriria o seguinte servindo de novo.
 *
 * O que a regra de ouro substitui e a POLITICA DE ESCOLHA. As restricoes de elegibilidade
 * continuam valendo integralmente: vinculo com a saida, indisponibilidade na data, irmao
 * inativo (filtrado antes, na carga) e sobreposicao de horario.
 */

/** Regras expostas ao usuario, com os padroes de fabrica. Todas sao RESTRICOES. */
const REGRAS_PADRAO = {
    respeitarIndisponibilidades: true, // nao escalar em data bloqueada pelo irmao
    evitarDuplicidadeNoDia: true       // o mesmo irmao no maximo 1x por data
};

// ---------------------------------------------------------------------------
// Utilitarios
// ---------------------------------------------------------------------------

/**
 * Chave de horario de um turno, usada para impedir sobreposicao fisica.
 *
 * Nos dados reais o sabado tem turno 1 e turno 3 os DOIS as 08:45, em casas diferentes.
 * Estar nos dois e impossivel na vida real, entao esta e a unica restricao que nunca e
 * relaxada. Sem `horario` cada saida vira a propria chave, o que so bloqueia o obvio
 * (a mesma saida duas vezes) em vez de bloquear o dia inteiro por engano.
 */
function chaveHorario(base) {
    return base.horario
        ? `${base.data}|h${base.horario}`
        : `${base.data}|s${base.saidaCampoId}`;
}

/**
 * Ordem cronologica de verdade dos turnos.
 *
 * `data` e so "DD/MM", entao ordenar por string colocaria "02/09" antes de "28/08". Quem
 * resolve o mes/ano e o chamador, que entrega `dataObj`; aqui so desempatamos pelo turno
 * (varias saidas na mesma data) e pela saida, para a geracao ser reproduzivel.
 */
function ordenarTurnos(bases) {
    return [...bases].sort((a, b) => {
        const dif = a.dataObj.getTime() - b.dataObj.getTime();
        if (dif !== 0) return dif;
        const turnoA = a.turno || 0;
        const turnoB = b.turno || 0;
        if (turnoA !== turnoB) return turnoA - turnoB;
        if (a.saidaCampoId !== b.saidaCampoId) return a.saidaCampoId - b.saidaCampoId;
        return a.id - b.id;
    });
}

/**
 * Posicao do irmao na fila que o historico deixou.
 *
 * `ordem` e um inteiro crescente atribuido pelo chamador na sequencia cronologica de TODAS as
 * designacoes anteriores - maior = serviu mais recentemente. Aceitamos tambem so a data como
 * fallback, para o modulo continuar utilizavel com um historico mais pobre (testes, por ex.).
 * `null` significa "nunca serviu", e vai para a frente de todos.
 */
function ordemDoHistorico(registro) {
    if (!registro) return null;
    if (Number.isFinite(registro.ordem)) return registro.ordem;
    if (registro.ultimaDataObj instanceof Date) return registro.ultimaDataObj.getTime();
    return null;
}

/**
 * Fila inicial: quem serviu ha mais tempo primeiro, quem nunca serviu na frente de todos.
 * Empate desfeito por nome - o objetivo aqui e reprodutibilidade, nao surpresa.
 */
function montarFilaInicial(dirigentes) {
    return [...dirigentes].sort((a, b) => {
        const ordemA = a.ordemHistorico;
        const ordemB = b.ordemHistorico;
        if (ordemA === null && ordemB === null) return a.nome.localeCompare(b.nome);
        if (ordemA === null) return -1;
        if (ordemB === null) return 1;
        if (ordemA !== ordemB) return ordemA - ordemB;
        return a.nome.localeCompare(b.nome);
    });
}

/**
 * O irmao pode servir neste turno?
 *
 * Este e o unico filtro do algoritmo: fora daqui a escolha e puramente posicional.
 */
function podeServir(d, base, regras, opcoes = {}) {
    // Vinculo com a saida (DirigenteSaidaCampo). Sem isso ele nao dirige ali, ponto.
    if (!d.saidas.has(base.saidaCampoId)) return false;
    // Compromisso real do irmao: nunca relaxado.
    if (regras.respeitarIndisponibilidades && d.indisponiveis.has(base.data)) return false;
    // Estar em dois lugares no mesmo horario e impossivel: nunca relaxado.
    if (d.horariosUsados.has(chaveHorario(base))) return false;
    if (regras.evitarDuplicidadeNoDia && !opcoes.ignorarDuplicidadeNoDia && d.datasUsadas.has(base.data)) return false;
    return true;
}

// ---------------------------------------------------------------------------
// Motor principal
// ---------------------------------------------------------------------------

/**
 * @param {Object} entrada
 * @param {Array}  entrada.vagasBase  [{ id, data, dataObj, saidaCampoId, local, turno, horario }]
 *                                    uma entrada por EscalaDirigente = um turno = um dirigente
 * @param {Array}  entrada.dirigentes [{ nome, saidaCampoIds:[], indisponiveis:[] }]
 * @param {Object} entrada.historico  { [nome]: { designacoes, ultimaDataObj, ordem } }
 *                                    de TODOS os quadros anteriores, nao so do mes passado
 * @param {Object} entrada.regras
 */
function gerarEscala(entrada) {
    const regras = { ...REGRAS_PADRAO, ...(entrada.regras || {}) };
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

        ordemHistorico: ordemDoHistorico(historico[d.nome]),
        designacoesAnteriores: historico[d.nome]?.designacoes || 0,

        capacidade: 0,               // datas distintas em que ele poderia servir
        carga: 0,                    // designacoes recebidas neste quadro
        datasUsadas: new Set(),      // "DD/MM"
        horariosUsados: new Set(),   // "DD/MM|hHH:MM" - sobreposicao fisica
        porSaida: new Map(),
        ultimaDataObj: null
    }));

    // ---- 2. Universo de turnos --------------------------------------------
    const turnos = ordenarTurnos(entrada.vagasBase || []);
    const totalVagas = turnos.length;

    const turnosPorData = new Map();
    const datasOrdenadas = [];
    for (const base of turnos) {
        if (!turnosPorData.has(base.data)) {
            turnosPorData.set(base.data, []);
            datasOrdenadas.push(base.data);
        }
        turnosPorData.get(base.data).push(base);
    }

    // Capacidade = datas distintas em que existe ao menos um turno que ele poderia assumir.
    // Serve so para o diagnostico e para saber quem entra no rodizio deste mes.
    const elegivelNaData = (d, data) => turnosPorData.get(data).some(base =>
        d.saidas.has(base.saidaCampoId)
        && !(regras.respeitarIndisponibilidades && d.indisponiveis.has(base.data))
    );

    for (const d of dirigentes) {
        d.capacidade = datasOrdenadas.filter(data => elegivelNaData(d, data)).length;
    }

    // ---- 3. A fila ---------------------------------------------------------
    // Quem nao tem nenhuma data possivel neste mes fica fora do rodizio (senao ele seria
    // testado e pulado em todos os turnos sem nunca sair da frente) - mas continua no
    // diagnostico, e o historico dele e preservado para o mes seguinte.
    const noRodizio = dirigentes.filter(d => d.capacidade > 0);
    const fila = montarFilaInicial(noRodizio);
    const filaInicial = fila.map(d => d.nome);

    // ---- 4. Rodizio, turno a turno, em ordem cronologica -------------------
    const resultado = new Map();
    turnos.forEach(base => resultado.set(base.id, ''));

    const turnosVazios = [];
    let ciclosCompletos = 0;
    let servidosNoCiclo = new Set();

    for (const base of turnos) {
        let indice = fila.findIndex(d => podeServir(d, base, regras));

        // Degradacao controlada: repetir alguem no mesmo dia e o UNICO alivio possivel, e so
        // quando a alternativa e deixar o turno sem dirigente. Indisponibilidade, vinculo e
        // sobreposicao de horario continuam de pe.
        if (indice === -1 && regras.evitarDuplicidadeNoDia) {
            indice = fila.findIndex(d => podeServir(d, base, regras, { ignorarDuplicidadeNoDia: true }));
            if (indice !== -1) {
                registrarRelaxamento('evitarDuplicidadeNoDia');
                avisos.push({
                    tipo: 'duplicidade_no_dia',
                    data: base.data,
                    saidaCampoId: base.saidaCampoId,
                    mensagem: `Sem dirigente livre em ${base.data} para ${base.local || 'a saida'}; um irmao precisou ser repetido no mesmo dia.`
                });
            }
        }

        // Ninguem pode servir: o turno fica VAZIO. Inventar nome ou chamar alguem fora da vez
        // quebraria as duas coisas que o quadro promete - a disponibilidade e o rodizio.
        if (indice === -1) {
            const habilitados = dirigentes.filter(d => d.saidas.has(base.saidaCampoId));
            const bloqueadosPorData = habilitados.filter(d =>
                regras.respeitarIndisponibilidades && d.indisponiveis.has(base.data));

            const motivo = habilitados.length === 0
                ? 'sem_dirigente_habilitado'
                : (bloqueadosPorData.length === habilitados.length
                    ? 'todos_indisponiveis_na_data'
                    : 'todos_ja_ocupados_no_horario');

            const mensagem = habilitados.length === 0
                ? `Nenhum dirigente esta habilitado em ${base.local || 'a saida'} (${base.data}); o turno ficou sem ninguem.`
                : (bloqueadosPorData.length === habilitados.length
                    ? `Todos os ${habilitados.length} dirigente(s) habilitados em ${base.local || 'a saida'} marcaram indisponibilidade em ${base.data}; o turno ficou sem ninguem.`
                    : `Em ${base.data} nao sobrou dirigente habilitado em ${base.local || 'a saida'} livre nesse horario; o turno ficou sem ninguem.`);

            turnosVazios.push({
                data: base.data,
                saidaCampoId: base.saidaCampoId,
                local: base.local || null,
                motivo,
                habilitados: habilitados.length,
                indisponiveisNaData: bloqueadosPorData.length
            });
            avisos.push({ tipo: 'vaga_vazia', data: base.data, saidaCampoId: base.saidaCampoId, motivo, mensagem });
            continue;
        }

        const escolhido = fila[indice];
        resultado.set(base.id, escolhido.nome);

        escolhido.carga += 1;
        escolhido.datasUsadas.add(base.data);
        escolhido.horariosUsados.add(chaveHorario(base));
        escolhido.porSaida.set(base.saidaCampoId, (escolhido.porSaida.get(base.saidaCampoId) || 0) + 1);
        if (!escolhido.ultimaDataObj || escolhido.ultimaDataObj < base.dataObj) {
            escolhido.ultimaDataObj = base.dataObj;
        }

        // Serviu -> vai para o fim da fila. Quem foi pulado nao se mexe: mantem a vez.
        fila.splice(indice, 1);
        fila.push(escolhido);

        // Um ciclo fecha quando todos do rodizio ja serviram uma vez desde o ultimo reinicio.
        servidosNoCiclo.add(escolhido.nome);
        if (noRodizio.length > 0 && servidosNoCiclo.size >= noRodizio.length) {
            ciclosCompletos += 1;
            servidosNoCiclo = new Set();
        }
    }

    // ---- 5. Diagnostico ----------------------------------------------------
    const preenchidas = totalVagas - turnosVazios.length;

    // Sob o rodizio nao existe cota: todos recebem a mesma quantidade a menos de um ciclo.
    // A media continua exposta como `cota` porque e a referencia que a tela ja desenha.
    const cotaMedia = noRodizio.length > 0 ? preenchidas / noRodizio.length : 0;

    // Quem ficou abaixo da media so pode ter ficado por disponibilidade: o rodizio nao pula
    // ninguem por nenhum outro motivo.
    const limitadosPelaDisponibilidade = noRodizio
        .filter(d => cotaMedia > 0 && d.carga < cotaMedia - 0.5)
        .map(d => d.nome);

    const porIrmao = dirigentes
        .map(d => ({
            nome: d.nome,
            designacoes: d.carga,
            oportunidades: d.capacidade,
            cota: d.capacidade > 0 ? Number(cotaMedia.toFixed(2)) : null,
            aproveitamento: d.capacidade > 0 && cotaMedia > 0
                ? Number((d.carga / cotaMedia).toFixed(2))
                : null,
            saidasDistintas: d.porSaida.size,
            designacoesAnteriores: d.designacoesAnteriores,
            limitadoPelaDisponibilidade: limitadosPelaDisponibilidade.includes(d.nome)
        }))
        .sort((a, b) => b.designacoes - a.designacoes || a.nome.localeCompare(b.nome));

    const semDesignacao = noRodizio.filter(d => d.carga === 0).map(d => d.nome);

    semDesignacao.forEach(nome => {
        avisos.push({
            tipo: 'irmao_sem_designacao',
            irmao: nome,
            mensagem: `${nome} nao chegou a servir: em todas as datas em que ele dirige a vez ja tinha passado para outro turno ou ele estava indisponivel.`
        });
    });

    dirigentes
        .filter(d => d.capacidade === 0)
        .forEach(d => avisos.push({
            tipo: 'sem_disponibilidade',
            irmao: d.nome,
            mensagem: `${d.nome} nao esta vinculado a nenhuma saida de campo ativa no periodo (ou esta indisponivel em todas as datas), entao ficou fora do rodizio deste mes.`
        }));

    const gargalos = detectarGargalos(turnos, dirigentes, cotaMedia, regras);

    gargalos.forEach(g => {
        if (g.escopo === 'data') {
            avisos.push({
                tipo: 'dia_com_poucos_dirigentes',
                data: g.data,
                mensagem: `Dia ${g.data}: ${g.vagas} turno(s), mas so ${g.candidatos} irmao(s) disponivel(is) nesse dia. Alguem tera de ser repetido no mesmo dia ou um turno ficara vazio.`
            });
            return;
        }
        avisos.push({
            tipo: 'saida_com_poucos_dirigentes',
            saidaCampoId: g.saidaCampoId,
            mensagem: g.candidatos === 0
                ? `${g.local || 'Saida'}: nenhum dirigente habilitado - todos os ${g.vagas} turnos ficam vazios.`
                : `${g.local || 'Saida'}: ${g.vagas} turnos no mes para ${g.candidatos} dirigente(s) habilitado(s), o que forca ${g.cargaForcada} designacoes por irmao so nessa saida. Cadastrar mais dirigentes nela e o que mais equilibra o rodizio.`
        });
    });

    return {
        atribuicoes: turnos.map(base => ({
            id: base.id,
            principal: resultado.get(base.id)
        })),
        diagnostico: {
            totalVagas,
            vagasPreenchidas: preenchidas,
            vagasVazias: turnosVazios.length,
            totalDirigentes: dirigentes.length,
            semDesignacao,
            limitadosPelaDisponibilidade,
            gargalos,
            porIrmao,
            turnosVazios,
            rodizio: {
                naFila: noRodizio.length,
                ciclosCompletos,
                faltandoNoCicloAtual: noRodizio
                    .filter(d => !servidosNoCiclo.has(d.nome))
                    .map(d => d.nome),
                filaInicial,
                // Como a fila termina o mes: e exatamente daqui que o proximo quadro comeca.
                filaFinal: fila.map(d => d.nome)
            },
            regrasRelaxadas: relaxamentos,
            avisos
        }
    };
}

/**
 * Identifica os dois tipos de gargalo do cadastro. E a informacao mais acionavel do
 * diagnostico: quem le sabe exatamente onde faltam dirigentes habilitados.
 *
 *  - por SAIDA: a saida tem mais turnos no mes do que os irmaos habilitados nela conseguem
 *    cobrir sem servir mais que a media (foi o caso da terca, com 3 dirigentes para 10 turnos);
 *  - por DATA: o dia tem mais turnos do que irmaos disponiveis naquele dia, o que acontece no
 *    sabado, onde varios turnos caem na MESMA data e a regra de nao repetir no dia obriga
 *    um irmao distinto por turno.
 */
function detectarGargalos(turnos, dirigentes, cotaMedia, regras) {
    const gargalos = [];

    const habilitado = (d, base) =>
        d.saidas.has(base.saidaCampoId)
        && !(regras.respeitarIndisponibilidades && d.indisponiveis.has(base.data));

    // --- por saida ---
    const porSaida = new Map();
    for (const base of turnos) {
        if (!porSaida.has(base.saidaCampoId)) {
            porSaida.set(base.saidaCampoId, {
                saidaCampoId: base.saidaCampoId,
                local: base.local || null,
                vagas: 0,
                candidatos: new Set()
            });
        }
        const info = porSaida.get(base.saidaCampoId);
        info.vagas += 1;
        dirigentes.forEach(d => {
            if (habilitado(d, base)) info.candidatos.add(d.nome);
        });
    }

    porSaida.forEach(info => {
        const qtd = info.candidatos.size;
        const cargaForcada = qtd > 0 ? info.vagas / qtd : Infinity;
        if (qtd === 0 || cargaForcada > cotaMedia + 0.5) {
            gargalos.push({
                escopo: 'saida',
                saidaCampoId: info.saidaCampoId,
                local: info.local,
                vagas: info.vagas,
                candidatos: qtd,
                cargaForcada: Number.isFinite(cargaForcada) ? Number(cargaForcada.toFixed(2)) : null
            });
        }
    });

    // --- por data ---
    const porData = new Map();
    for (const base of turnos) {
        if (!porData.has(base.data)) {
            porData.set(base.data, { data: base.data, vagas: 0, candidatos: new Set() });
        }
        const info = porData.get(base.data);
        info.vagas += 1;
        dirigentes.forEach(d => {
            if (habilitado(d, base)) info.candidatos.add(d.nome);
        });
    }

    porData.forEach(info => {
        if (info.candidatos.size < info.vagas) {
            gargalos.push({
                escopo: 'data',
                data: info.data,
                vagas: info.vagas,
                candidatos: info.candidatos.size,
                cargaForcada: null
            });
        }
    });

    return gargalos.sort((a, b) => (b.cargaForcada || 0) - (a.cargaForcada || 0));
}

module.exports = {
    gerarEscala,
    REGRAS_PADRAO,
    _internos: { chaveHorario, ordenarTurnos, ordemDoHistorico, montarFilaInicial, podeServir, detectarGargalos }
};
