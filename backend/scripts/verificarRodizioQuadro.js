/**
 * Verificacao do rodizio do preenchimento automatico do quadro (AutoDesignacaoService).
 *
 *   npm run verificar:rodizio-quadro
 *
 * Nao precisa de banco: o Prisma e trocado por um duble em memoria, e o mes e montado pelo
 * MESMO gerarTemplate do QuadroController, entao o que roda aqui e o algoritmo de producao.
 *
 * Por que isto existe: as promessas do gerador ("ninguem fica de fora", "descanso igual",
 * "leva em conta os meses anteriores") nao geram erro nenhum quando quebram. O quadro sai
 * preenchido, bonito, e so quem conhece a congregacao percebe que um irmao serviu cinco
 * vezes e sete nao serviram nenhuma — que foi exatamente o que aconteceu na geracao real
 * que originou este arquivo. Aqui as promessas viram numero.
 *
 * O cadastro de teste imita a forma do cadastro real: um punhado de irmaos acumulando duas
 * ou tres funcoes, a maioria com uma so, e um grupo pequeno habilitado em Audio e Video.
 */

// --- duble do Prisma (precisa existir ANTES de carregar o servico) ---------
const caminhoPrisma = require.resolve('../src/prisma');

const banco = { irmaos: [], quadros: [] };

require.cache[caminhoPrisma] = {
    id: caminhoPrisma,
    filename: caminhoPrisma,
    loaded: true,
    paths: [],
    children: [],
    exports: {
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
                banco.quadros
                    .filter((q) => q.ano < where.OR[1].ano
                        || (q.ano === where.OR[1].ano && q.mes < where.OR[1].mes.lt))
                    .sort((a, b) => a.ano - b.ano || a.mes - b.mes),
        },
    },
};

const AutoDesignacaoService = require('../src/services/AutoDesignacaoService');
const { gerarTemplate } = require('../src/controllers/QuadroController');

let falhas = 0;
const chk = (ok, m) => { console.log(`${ok ? '  OK  ' : ' FALHA'} ${m}`); if (!ok) falhas++; };
const info = (m) => console.log(`  ..    ${m}`);
const sec = (t) => console.log(`\n=== ${t} ===`);

const MIC = 'microfone';
const IND = 'indicador';
const AV = 'audioVideo';
const EST = 'estacionamento';

// Cadastro com a forma do real: 5 irmaos de A e V, 10 acumulando funcoes, 17 com uma so.
const CADASTRO = [
    ['AV-Mat', [AV, MIC, IND], 'experiente'],
    ['AV-Eve', [AV, MIC, IND], 'experiente'],
    ['AV-Cri', [AV, MIC], 'treinando'],
    ['AV-Eri', [AV, MIC], 'treinando'],
    ['AV-Joa', [AV, IND], 'treinando'],

    ['Tri-Hen', [MIC, IND, EST], 'experiente'],
    ['Tri-Man', [MIC, IND, EST], 'experiente'],
    ['Duo-Ric', [MIC, IND], 'experiente'],
    ['Duo-Kai', [MIC, IND], 'experiente'],
    ['Duo-Cla', [IND, EST], 'experiente'],
    ['Duo-Jes', [IND, EST], 'experiente'],
    ['Duo-Cos', [MIC, EST], 'experiente'],
    ['Duo-Cas', [MIC, IND], 'experiente'],
    ['Duo-Rai', [IND, EST], 'experiente'],
    ['Duo-Mig', [MIC, IND], 'experiente'],

    ['Uni-Dom', [MIC], 'experiente'],
    ['Uni-Fra', [MIC], 'experiente'],
    ['Uni-And', [MIC], 'experiente'],
    ['Uni-Ivo', [MIC], 'experiente'],
    ['Uni-Alo', [MIC], 'experiente'],
    ['Uni-Ben', [MIC], 'experiente'],
    ['Uni-Kau', [MIC], 'experiente'],
    ['Uni-Leo', [MIC], 'experiente'],
    ['Uni-Giv', [IND], 'experiente'],
    ['Uni-Har', [IND], 'experiente'],
    ['Uni-Jos', [IND], 'experiente'],
    ['Uni-Edg', [IND], 'experiente'],
    ['Uni-Laz', [IND], 'experiente'],
    ['Uni-Nic', [IND], 'experiente'],
    ['Uni-Car', [EST], 'experiente'],
    ['Uni-Juc', [EST], 'experiente'],
    ['Uni-Ped', [EST], 'experiente'],
];

const ehAV = (nome) => nome.startsWith('AV-');
const funcoesDe = (nome) => banco.irmaos.find((i) => i.nome === nome).funcoes;

function prepararIrmaos() {
    banco.irmaos = CADASTRO.map(([nome, funcoes, nivelAudioVideo]) => ({
        id: nome, nome, funcoes, nivelAudioVideo, ativo: true, indisponibilidades: [],
    }));
    banco.quadros = [];
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

const escalados = (quadros) =>
    quadros.flatMap((q) => q.designacoes).flatMap((d) => [d.irmao1, d.irmao2]).filter(Boolean);

const contar = (nomes) => {
    const c = new Map();
    nomes.forEach((n) => c.set(n, (c.get(n) || 0) + 1));
    return c;
};

/** Escalacoes de cada irmao, em ordem cronologica, achatadas numa lista de nomes. */
const sequencia = (quadros, filtroFuncao = () => true) =>
    quadros.flatMap((q) => q.designacoes
        .filter((d) => filtroFuncao(d.funcao))
        .sort((a, b) => a.data.localeCompare(b.data)))
        .flatMap((d) => [d.irmao1, d.irmao2])
        .filter(Boolean);

(async () => {
    sec('tres meses gerados em sequencia (out, nov e dez de 2026)');
    prepararIrmaos();
    const meses = [await gerarMes(10, 2026), await gerarMes(11, 2026), await gerarMes(12, 2026)];
    const vagas = meses.flatMap((q) => q.designacoes);
    const preenchidas = vagas.filter((d) => d.irmao1 && d.irmao2);
    chk(preenchidas.length === vagas.length,
        `as ${vagas.length} vagas dos tres meses foram preenchidas, sem celula vazia`);

    const cargas = contar(escalados(meses));
    const carga = (n) => cargas.get(n) || 0;

    sec('ninguem fica de fora');
    const semNenhuma = banco.irmaos.filter((i) => carga(i.nome) === 0);
    chk(semNenhuma.length === 0,
        `todo irmao habilitado foi designado ao menos uma vez${semNenhuma.length ? ': faltaram ' + semNenhuma.map((i) => i.nome).join(', ') : ''}`);

    sec('descanso igual: acumular funcoes NAO faz o irmao servir mais');
    // Era o bug relatado: com uma fila por funcao, quem tinha tres funcoes entrava em tres
    // rodizios. Numa geracao real deu 5x para quem acumulava e 0x para sete irmaos de uma
    // funcao so. Audio e Video fica de fora da conta — la a repeticao e combinada.
    const semAV = banco.irmaos.filter((i) => !ehAV(i.nome));
    const porQtdFuncoes = (n) => semAV.filter((i) => i.funcoes.length === n).map((i) => carga(i.nome));
    const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const uma = porQtdFuncoes(1);
    const duas = porQtdFuncoes(2);
    const tres = porQtdFuncoes(3);
    info(`media em 3 meses — 1 funcao: ${media(uma).toFixed(1)}x | 2 funcoes: ${media(duas).toFixed(1)}x | 3 funcoes: ${media(tres).toFixed(1)}x`);
    chk(Math.abs(media(tres) - media(uma)) <= 1,
        'quem tem 3 funcoes serve praticamente o mesmo que quem tem 1');
    chk(Math.abs(media(duas) - media(uma)) <= 1,
        'quem tem 2 funcoes serve praticamente o mesmo que quem tem 1');

    const cargasSemAV = semAV.map((i) => carga(i.nome));
    const spread = Math.max(...cargasSemAV) - Math.min(...cargasSemAV);
    info(`carga fora do A e V: de ${Math.min(...cargasSemAV)}x a ${Math.max(...cargasSemAV)}x`);
    chk(spread <= 2,
        `a diferenca entre o mais e o menos usado (fora do A e V) e de ${spread} designacoes em 3 meses`);

    sec('Audio e Video: a excecao combinada');
    const avSlots = sequencia(meses, (f) => f === 'Audio e Video');
    chk(avSlots.every((n) => funcoesDe(n).includes(AV)),
        'toda vaga de A e V foi preenchida por irmao habilitado em A e V');
    const cargaAV = banco.irmaos.filter((i) => ehAV(i.nome)).map((i) => carga(i.nome));
    info(`os 5 irmaos de A e V serviram ${cargaAV.join('x, ')}x no total (${avSlots.length} vagas de A e V em 3 meses)`);
    chk(Math.min(...cargaAV) > Math.max(...cargasSemAV) - 2,
        'quem e de A e V serve mais que a media — a repeticao ali e esperada, nao um desvio');

    // Prioridade: o irmao de A e V nao pode ser consumido por outra funcao no MESMO dia em
    // que uma vaga de A e V ficaria sem ele. Como A e V e resolvida primeiro, isso nao ocorre.
    let roubados = 0;
    for (const quadro of meses) {
        const porData = new Map();
        quadro.designacoes.forEach((d) => {
            if (!porData.has(d.data)) porData.set(d.data, []);
            porData.get(d.data).push(d);
        });
        for (const [, linhas] of porData) {
            const naAV = new Set(linhas.filter((d) => d.funcao === 'Audio e Video')
                .flatMap((d) => [d.irmao1, d.irmao2]).filter(Boolean));
            const emOutras = linhas.filter((d) => d.funcao !== 'Audio e Video')
                .flatMap((d) => [d.irmao1, d.irmao2]).filter(Boolean);
            if (linhas.some((d) => d.funcao === 'Audio e Video' && (!d.irmao1 || !d.irmao2))
                && emOutras.some((n) => ehAV(n) && !naAV.has(n))) roubados += 1;
        }
    }
    chk(roubados === 0, 'nenhum dia teve vaga de A e V vazia com irmao de A e V servindo em outra funcao');

    sec('o mes novo continua a fila do mes anterior');
    const seqOut = sequencia([meses[0]]);
    const seqNov = sequencia([meses[1]]);
    chk(!seqOut.slice(-6).includes(seqNov[0]),
        `quem serviu nas ultimas vagas de outubro nao abre novembro (fecha com ${seqOut[seqOut.length - 1]}, abre com ${seqNov[0]})`);

    // Prova pelo avesso: o MESMO novembro, gerado sem historico, sai diferente.
    const guardados = banco.quadros;
    prepararIrmaos();
    const novSozinho = await gerarMes(11, 2026);
    banco.quadros = guardados;
    chk(sequencia([novSozinho]).join() !== seqNov.join(),
        'o mesmo novembro sai diferente sem meses anteriores — o historico muda o resultado');

    sec('quem esta indisponivel nao perde a vez');
    prepararIrmaos();
    // 'Uni-Car' so faz estacionamento; ocupado no primeiro domingo de novembro (01/11).
    banco.irmaos.find((i) => i.nome === 'Uni-Car').indisponibilidades = [{ data: '01/11' }];
    const novComFalta = await gerarMes(11, 2026);
    const est = sequencia([novComFalta], (f) => f === 'Estacionamento');
    chk(!est.slice(0, 2).includes('Uni-Car'), 'nao e escalado no dia em que esta ocupado');
    chk(est.slice(2).includes('Uni-Car'), `pega um turno seguinte em vez de sumir do mes (${est.slice(0, 6).join(' ')})`);

    sec('ninguem ocupa duas vagas no mesmo dia');
    prepararIrmaos();
    const mesUnico = await gerarMes(11, 2026);
    const porDia = new Map();
    mesUnico.designacoes.forEach((d) => {
        [d.irmao1, d.irmao2].filter(Boolean).forEach((n) => {
            const chave = `${d.data}__${n}`;
            porDia.set(chave, (porDia.get(chave) || 0) + 1);
        });
    });
    chk([...porDia.values()].every((v) => v === 1),
        'nenhum irmao aparece duas vezes no mesmo dia, mesmo acumulando funcoes');

    sec('a funcao com menos habilitados escolhe primeiro');
    // Estacionamento so existe no domingo e tem poucos habilitados. Se microfone escolhesse
    // antes, consumiria os irmaos que tambem fazem estacionamento e a vaga ficaria vazia.
    const ordem = AutoDesignacaoService.ordenarFuncoes(banco.irmaos);
    chk(ordem[0] === 'Audio e Video', `A e V e sempre a primeira: ${ordem.join(' -> ')}`);
    chk(ordem.indexOf('Estacionamento') < ordem.indexOf('Microfone Volante'),
        'estacionamento (poucos habilitados) escolhe antes de microfone (muitos)');

    console.log(`\n${falhas === 0 ? '*** TODAS AS VERIFICACOES PASSARAM ***' : `*** ${falhas} FALHA(S) ***`}`);
    process.exit(falhas === 0 ? 0 : 1);
})();
