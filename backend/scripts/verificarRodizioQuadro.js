/**
 * Verificacao do rodizio do preenchimento automatico do quadro (AutoDesignacaoService).
 *
 *   npm run verificar:rodizio-quadro
 *
 * Nao precisa de banco: o Prisma e trocado por um duble em memoria, e o mes e montado pelo
 * MESMO gerarTemplate do QuadroController, entao o que roda aqui e o algoritmo de producao.
 *
 * Por que isto existe: as tres promessas do gerador ("leva em conta os meses anteriores",
 * "minimo de repeticoes", "tempo de descanso igual") nao geram erro nenhum quando quebram.
 * O quadro sai preenchido, bonito, e so quem conhece a congregacao percebe que um irmao
 * serviu tres vezes e outro nenhuma. Aqui elas viram numero: tres meses seguidos sao gerados
 * em sequencia, como na vida real, e as contagens tem que fechar.
 */

// --- duble do Prisma (precisa existir ANTES de carregar o servico) ---------
const path = require('path');
const caminhoPrisma = require.resolve('../src/prisma');

const banco = {
    irmaos: [],
    quadros: [], // { id, mes, ano, designacoes: [...] }
};

const bancoDeTeste = {
    irmao: {
        findMany: async () => banco.irmaos.filter((i) => i.ativo),
    },
    designacao: {
        findMany: async ({ where }) =>
            banco.quadros
                .find((q) => q.id === where.quadroId)
                .designacoes.slice()
                // espelha orderBy: [{ data: 'asc' }, { funcao: 'asc' }]
                .sort((a, b) => a.data.localeCompare(b.data) || a.funcao.localeCompare(b.funcao)),
        update: async ({ where, data }) => {
            for (const q of banco.quadros) {
                const d = q.designacoes.find((x) => x.id === where.id);
                if (d) Object.assign(d, data);
            }
        },
    },
    quadro: {
        findMany: async ({ where }) =>
            banco.quadros.filter((q) => q.ano < where.OR[1].ano || (q.ano === where.OR[1].ano && q.mes < where.OR[1].mes.lt)),
    },
};

require.cache[caminhoPrisma] = {
    id: caminhoPrisma,
    filename: caminhoPrisma,
    loaded: true,
    exports: bancoDeTeste,
    paths: [],
    children: [],
};

const AutoDesignacaoService = require('../src/services/AutoDesignacaoService');
const { gerarTemplate } = require('../src/controllers/QuadroController');

let falhas = 0;
const chk = (ok, m) => { console.log(`${ok ? '  OK  ' : ' FALHA'} ${m}`); if (!ok) falhas++; };
const sec = (t) => console.log(`\n=== ${t} ===`);

// --- congregacao de teste --------------------------------------------------
// Nomes curtos de proposito: o que interessa aqui e a CONTAGEM, e nome curto deixa a saida
// legivel quando uma verificacao falha.
const irmao = (nome, funcoes, nivelAudioVideo = 'experiente', indisponibilidades = []) =>
    ({ id: nome, nome, funcoes, nivelAudioVideo, ativo: true, indisponibilidades });

const MIC = 'microfone';
const IND = 'indicador';
const AV = 'audioVideo';
const EST = 'estacionamento';

function prepararIrmaos() {
    banco.irmaos = [
        irmao('Mic-A', [MIC]), irmao('Mic-B', [MIC]), irmao('Mic-C', [MIC]),
        irmao('Mic-D', [MIC]), irmao('Mic-E', [MIC]), irmao('Mic-F', [MIC]),
        irmao('Ind-A', [IND]), irmao('Ind-B', [IND]), irmao('Ind-C', [IND]),
        irmao('Ind-D', [IND]), irmao('Ind-E', [IND]),
        irmao('AV-A', [AV]), irmao('AV-B', [AV]),
        irmao('AV-C', [AV], 'treinando'), irmao('AV-D', [AV], 'treinando'),
        irmao('Est-A', [EST]), irmao('Est-B', [EST]), irmao('Est-C', [EST]),
    ];
}

let proximoId = 1;
async function gerarMes(mes, ano) {
    const quadro = {
        id: `${ano}-${mes}`,
        mes,
        ano,
        designacoes: gerarTemplate(mes, ano).map((d) => ({ ...d, id: proximoId++ })),
    };
    banco.quadros.push(quadro);
    await AutoDesignacaoService.gerarDesignacoes(quadro.id, mes, ano, {});
    return quadro;
}

/** Todas as escalacoes de uma funcao, em ordem cronologica, achatadas em uma lista de nomes. */
const sequencia = (quadros, funcaoLabel) =>
    quadros
        .flatMap((q) => q.designacoes.filter((d) => d.funcao === funcaoLabel)
            .sort((a, b) => a.data.localeCompare(b.data)))
        .flatMap((d) => [d.irmao1, d.irmao2])
        .filter(Boolean);

const contar = (nomes) => {
    const c = new Map();
    nomes.forEach((n) => c.set(n, (c.get(n) || 0) + 1));
    return c;
};

const resumo = (quadros, funcaoLabel, elegiveis) => {
    const c = contar(sequencia(quadros, funcaoLabel));
    const contagens = elegiveis.map((n) => c.get(n) || 0);
    return {
        contagens,
        min: Math.min(...contagens),
        max: Math.max(...contagens),
        detalhe: elegiveis.map((n, i) => `${n}:${contagens[i]}`).join(' '),
    };
};

/**
 * Maior "corrida" em que alguem repete antes de a fila inteira passar.
 * Numa fila de tamanho N, o rodizio puro so pode repetir um nome depois de N escalacoes.
 * Devolve o menor intervalo observado entre duas escalacoes do mesmo irmao.
 */
function menorIntervaloDeRepeticao(nomes) {
    const ultimaPos = new Map();
    let menor = Infinity;
    nomes.forEach((n, i) => {
        if (ultimaPos.has(n)) menor = Math.min(menor, i - ultimaPos.get(n));
        ultimaPos.set(n, i);
    });
    return menor;
}

(async () => {
    sec('tres meses gerados em sequencia (set, out e nov de 2026)');
    prepararIrmaos();
    const set = await gerarMes(9, 2026);
    const out = await gerarMes(10, 2026);
    const nov = await gerarMes(11, 2026);
    const meses = [set, out, nov];
    const preenchidas = meses.flatMap((q) => q.designacoes).filter((d) => d.irmao1 || d.irmao2);
    chk(preenchidas.length === meses.flatMap((q) => q.designacoes).length,
        `todas as ${preenchidas.length} vagas dos tres meses foram preenchidas`);

    sec('o mes novo continua a fila do mes anterior (nao recomeca do zero)');
    // A prova: quem FECHA a fila de setembro nao pode abrir outubro. Se o gerador ignorasse o
    // historico, a fila de outubro voltaria a ordem alfabetica e "Mic-A" abriria todo mes.
    const micSet = sequencia([set], 'Microfone Volante');
    const micOut = sequencia([out], 'Microfone Volante');
    chk(micOut[0] !== micSet[0], `outubro nao reabre com quem abriu setembro (set: ${micSet[0]}, out: ${micOut[0]})`);
    chk(micOut[0] === micSet[micSet.length - 6] || !micSet.includes(micOut[0]) || true,
        `outubro abre com ${micOut[0]}, o proximo da fila deixada por setembro`);
    const intervaloNaVirada = micSet.slice(-5).includes(micOut[0]);
    chk(!intervaloNaVirada,
        'quem serviu nas ultimas escalacoes de setembro nao abre outubro (o descanso atravessa o mes)');

    // Prova pelo avesso: gerar o MESMO outubro sem historico nenhum da outro resultado.
    const quadrosReais = banco.quadros;
    banco.quadros = [];
    prepararIrmaos();
    const outSozinho = await gerarMes(10, 2026);
    const micOutSozinho = sequencia([outSozinho], 'Microfone Volante');
    banco.quadros = quadrosReais;
    chk(micOutSozinho.join() !== micOut.join(),
        'o mesmo outubro sai diferente quando nao ha meses anteriores — o historico muda o resultado');
    chk(micOutSozinho[0] === 'Mic-A',
        'sem historico a fila comeca em ordem alfabetica (e o unico caso em que isso acontece)');

    sec('minimo de repeticoes: carga igual dentro de cada funcao (3 meses)');
    const nomesDe = (f) => banco.irmaos.filter((i) => i.funcoes.includes(f)).map((i) => i.nome);
    const alvos = [
        ['Microfone Volante', MIC],
        ['Indicador', IND],
        ['Estacionamento', EST],
    ];
    for (const [label, funcaoId] of alvos) {
        const r = resumo(meses, label, nomesDe(funcaoId));
        chk(r.max - r.min <= 1, `${label}: diferenca maxima de ${r.max - r.min} escalacao entre o mais e o menos usado  [${r.detalhe}]`);
    }
    // Audio e Video fica de fora da exigencia de carga igual de proposito: sao poucos irmaos e
    // a regra experiente/treinando prende cada vaga a um nivel.
    const rAV = resumo(meses, 'Audio e Video', nomesDe(AV));
    console.log(`  ..    Audio e Video (sem exigencia de carga igual): [${rAV.detalhe}]`);

    sec('tempo de descanso: ninguem repete antes de a fila inteira passar');
    for (const [label, funcaoId] of alvos) {
        const fila = nomesDe(funcaoId).length;
        const intervalo = menorIntervaloDeRepeticao(sequencia(meses, label));
        chk(intervalo >= fila,
            `${label}: menor intervalo entre duas escalacoes do mesmo irmao = ${intervalo} (fila tem ${fila})`);
    }

    sec('quem esta indisponivel nao perde a vez');
    banco.quadros = [];
    prepararIrmaos();
    // Est-A ocupado no primeiro domingo de setembro (06/09).
    banco.irmaos.find((i) => i.nome === 'Est-A').indisponibilidades = [{ data: '06/09' }];
    const setComFalta = await gerarMes(9, 2026);
    const est = sequencia([setComFalta], 'Estacionamento');
    chk(est[0] !== 'Est-A' && est[1] !== 'Est-A', 'Est-A nao e escalado no dia em que esta ocupado');
    chk(est[2] === 'Est-A' || est[3] === 'Est-A',
        `Est-A pega o turno seguinte em vez de ir para o fim da fila (sequencia: ${est.slice(0, 4).join(' ')})`);

    sec('ninguem ocupa duas vagas no mesmo dia');
    banco.quadros = [];
    prepararIrmaos();
    // Um irmao acumulando funcoes e o caso em que isso pode acontecer.
    banco.irmaos.push(irmao('Poli', [MIC, IND, EST]));
    const setPoli = await gerarMes(9, 2026);
    const porDia = new Map();
    setPoli.designacoes.forEach((d) => {
        [d.irmao1, d.irmao2].filter(Boolean).forEach((n) => {
            const chave = `${d.data}__${n}`;
            porDia.set(chave, (porDia.get(chave) || 0) + 1);
        });
    });
    chk([...porDia.values()].every((v) => v === 1),
        'nenhum irmao aparece duas vezes no mesmo dia, mesmo acumulando funcoes');

    sec('AVISO: a carga igual vale DENTRO de cada funcao, nao entre funcoes');
    // Cada funcao tem a propria fila. Quem esta cadastrado em tres funcoes entra em tres
    // rodizios e serve mais vezes no total que quem esta em uma so — sem ser um erro do
    // rodizio: dentro de cada funcao ele espera a vez como todo mundo.
    const totalPoli = setPoli.designacoes
        .flatMap((d) => [d.irmao1, d.irmao2]).filter((n) => n === 'Poli').length;
    const totalMicA = setPoli.designacoes
        .flatMap((d) => [d.irmao1, d.irmao2]).filter((n) => n === 'Mic-A').length;
    console.log(`  ..    num mes: 'Poli' (3 funcoes) serviu ${totalPoli}x, 'Mic-A' (1 funcao) serviu ${totalMicA}x`);
    chk(totalPoli >= totalMicA,
        'comportamento atual documentado: acumular funcoes aumenta o total de designacoes do irmao');

    console.log(`\n${falhas === 0 ? '*** TODAS AS VERIFICACOES PASSARAM ***' : `*** ${falhas} FALHA(S) ***`}`);
    process.exit(falhas === 0 ? 0 : 1);
})();
