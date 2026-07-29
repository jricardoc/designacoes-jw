'use strict';

const prisma = require('../prisma');
const { resolverDataDeQuadro, formatarDiaMes, chaveISO, nomeDoDia } = require('../utils/datas');
const { reconciliarDataReuniao, domingoDaSemana } = require('../utils/semanaReuniao');

/**
 * Reune, num lugar so, tudo em que um irmao esta designado.
 *
 * As tres fontes guardam o nome como TEXTO, nao como chave estrangeira:
 *   - Designacao.irmao1 / irmao2        (quadro de designacoes)
 *   - EscalaDirigente.principal / substituto (saidas de campo)
 *   - SemanaReuniao.<31 colunas>        (programacao da reuniao, importada de Excel/PDF)
 *
 * As duas primeiras vem de dropdowns alimentados por Irmao.nome, entao batem exatamente. A
 * terceira e digitada/importada e nao bate: aparece "Cosmirio Carvalho" sem acento, ou o nome
 * de um orador visitante que nem esta no cadastro. Por isso o casamento e por tokens.
 *
 * O criterio e DELIBERADAMENTE restritivo (ver `mesmaPessoa`): e melhor deixar de mostrar um
 * compromisso do que mostrar ao irmao um compromisso que nao e dele.
 */

// --- normalizacao de nomes -------------------------------------------------

/** minusculas, sem acento, sem pontuacao nem digitos. */
function normalizar(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
        .replace(/[^a-z]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Palavras significativas: descarta "de", "da", "e" e iniciais soltas. */
function tokens(texto) {
    return normalizar(texto).split(' ').filter(t => t.length > 2);
}

/**
 * Os dois textos designam a mesma pessoa?
 *
 * Exige CONTENCAO TOTAL de tokens (um nome contido no outro) com pelo menos 2 tokens em
 * comum. Bater so o primeiro nome nao basta - e o que impede "Marcelo Rodrigues", orador
 * visitante, de aparecer na lista do irmao "Marcelo Santana"; e "José Ricardo" de cair na
 * lista de "Ricardo Carvalho".
 */
function mesmaPessoa(tokensIrmao, texto) {
    const t = tokens(texto);
    if (t.length < 2 || tokensIrmao.length < 2) {
        // Nome de uma palavra so (ex.: "Walney"): exigimos igualdade exata.
        return t.length > 0 && normalizar(texto) === tokensIrmao.join(' ');
    }
    const contidos = (a, b) => a.every(x => b.includes(x));
    return contidos(tokensIrmao, t) || contidos(t, tokensIrmao);
}

/**
 * Um campo pode trazer varios nomes ("Fulano / Beltrano", "Grupo 2 do Fulano & Grupo 3 do
 * Beltrano"). Separamos por "/" e "&" apenas: " e " nao serve como separador porque faz
 * parte de nomes reais ("Olga Pereira e Souza").
 */
function fragmentos(valor) {
    return String(valor || '')
        .split(/[/&]/)
        .map(s => s.trim())
        .filter(Boolean);
}

const LIXO = new Set(['-', '--', 'a definir', 'a definir.', '__deletado__', 'sala b', 'salao principal']);

function ehValorUtil(valor) {
    if (!valor) return false;
    const limpo = String(valor).trim().toLowerCase();
    return limpo.length > 0 && !LIXO.has(limpo);
}

function campoMenciona(tokensIrmao, valor) {
    if (!ehValorUtil(valor)) return false;
    return fragmentos(valor).some(f => mesmaPessoa(tokensIrmao, f));
}

// --- colunas de SemanaReuniao que guardam nome -----------------------------
// `momento`: "meio" usa a data da reuniao de meio de semana; "fds" usa o domingo que fecha a
// mesma semana; "semana" nao tem dia proprio (limpeza vale a semana inteira).
const CAMPOS_REUNIAO = [
    { campo: 'presidente', rotulo: 'Presidente da reunião', momento: 'meio' },
    { campo: 'conselheiroB', rotulo: 'Conselheiro da Sala B', momento: 'meio' },
    { campo: 'oracaoInicial', rotulo: 'Oração inicial', momento: 'meio' },
    { campo: 'oracaoFinal', rotulo: 'Oração final', momento: 'meio' },

    { campo: 'tesouro1_irmao', rotulo: 'Tesouros da Palavra de Deus', momento: 'meio' },
    { campo: 'tesouro2_irmao', rotulo: 'Joias espirituais', momento: 'meio' },
    { campo: 'tesouro3_principal', rotulo: 'Leitura da Bíblia', momento: 'meio' },
    { campo: 'tesouro3_salaB', rotulo: 'Leitura da Bíblia (Sala B)', momento: 'meio' },

    { campo: 'ministerio1_principal', rotulo: 'Ministério — parte 1', momento: 'meio' },
    { campo: 'ministerio1_salaB', rotulo: 'Ministério — parte 1 (Sala B)', momento: 'meio' },
    { campo: 'ministerio2_principal', rotulo: 'Ministério — parte 2', momento: 'meio' },
    { campo: 'ministerio2_salaB', rotulo: 'Ministério — parte 2 (Sala B)', momento: 'meio' },
    { campo: 'ministerio3_principal', rotulo: 'Ministério — parte 3', momento: 'meio' },
    { campo: 'ministerio3_salaB', rotulo: 'Ministério — parte 3 (Sala B)', momento: 'meio' },
    { campo: 'ministerio4_principal', rotulo: 'Ministério — parte 4', momento: 'meio' },
    { campo: 'ministerio4_salaB', rotulo: 'Ministério — parte 4 (Sala B)', momento: 'meio' },

    { campo: 'vidaCrista1_irmao', rotulo: 'Nossa Vida Cristã — parte 1', momento: 'meio' },
    { campo: 'vidaCrista2_irmao', rotulo: 'Nossa Vida Cristã — parte 2', momento: 'meio' },
    { campo: 'estudoBiblico_dirigente', rotulo: 'Estudo bíblico de congregação — dirigente', momento: 'meio' },
    { campo: 'estudoBiblico_leitor', rotulo: 'Estudo bíblico de congregação — leitor', momento: 'meio' },

    { campo: 'mecanica_audioVideo', rotulo: 'Áudio e vídeo', momento: 'meio' },
    { campo: 'mecanica_indicadores', rotulo: 'Indicador', momento: 'meio' },
    { campo: 'mecanica_microfone', rotulo: 'Microfone volante', momento: 'meio' },

    { campo: 'fds_presidente', rotulo: 'Presidente da reunião', momento: 'fds' },
    { campo: 'fds_orador', rotulo: 'Discurso público', momento: 'fds' },
    { campo: 'fds_leitor', rotulo: 'Leitor de A Sentinela', momento: 'fds' },
    { campo: 'fds_mecanica_audioVideo', rotulo: 'Áudio e vídeo', momento: 'fds' },
    { campo: 'fds_mecanica_indicadores', rotulo: 'Indicador', momento: 'fds' },
    { campo: 'fds_mecanica_microfone', rotulo: 'Microfone volante', momento: 'fds' },
    { campo: 'fds_mecanica_portao', rotulo: 'Portão / estacionamento', momento: 'fds' },

    { campo: 'limpeza', rotulo: 'Limpeza do salão', momento: 'semana' },
];

/**
 * Datas de uma semana de reuniao.
 *
 * A reconciliacao com o rotulo da semana acontece na IMPORTACAO (utils/semanaReuniao.js), que
 * e onde o problema nasce. Aqui ela e refeita como rede de seguranca, para as semanas que ja
 * estavam gravadas antes dessa validacao existir.
 *
 * O domingo NAO pode sair de `Reuniao.mes`: uma semana atravessa o mes ("29 Junho - 5 Julho"),
 * entao ele vem de aritmetica de Date sobre a data do meio de semana.
 */
function datasDaSemana(semana) {
    const { dataReuniao, corrigida } = reconciliarDataReuniao(semana.faixaData, semana.dataReuniao);

    const m = String(dataReuniao || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return { meio: null, fds: null, corrigida: false };

    const meio = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (Number.isNaN(meio.getTime())) return { meio: null, fds: null, corrigida: false };

    return { meio, fds: domingoDaSemana(dataReuniao), corrigida };
}

// --- montagem dos compromissos ---------------------------------------------

function compromisso({ id, tipo, data, titulo, detalhe, papel, local, horario, origem, aproximada }) {
    return {
        id,
        tipo,
        dataISO: chaveISO(data),
        data: formatarDiaMes(data),
        diaSemana: nomeDoDia(data),
        titulo,
        detalhe: detalhe || null,
        papel: papel || null,
        local: local || null,
        horario: horario || null,
        origem: origem || null,
        dataAproximada: Boolean(aproximada),
    };
}

/**
 * @param {{ id: number, nome: string }} irmao
 * @returns {Promise<Array>} compromissos ordenados por data
 */
async function listarPorIrmao(irmao) {
    if (!irmao || !irmao.nome) return [];

    const tokensIrmao = tokens(irmao.nome);
    const nomeNormalizado = normalizar(irmao.nome);
    const ehEle = (valor) => normalizar(valor) === nomeNormalizado;

    const compromissos = [];

    // 1. Quadro de designacoes ------------------------------------------------
    const designacoes = await prisma.designacao.findMany({
        where: { OR: [{ irmao1: irmao.nome }, { irmao2: irmao.nome }] },
        include: { quadro: { select: { id: true, mes: true, ano: true, titulo: true, status: true } } },
    });

    for (const d of designacoes) {
        if (!d.quadro) continue;
        // O where do Prisma e sensivel a caixa/acento; a conferencia normalizada evita
        // depender disso e ja descarta um casamento parcial.
        const eu1 = ehEle(d.irmao1);
        const eu2 = ehEle(d.irmao2);
        if (!eu1 && !eu2) continue;

        const parceiro = eu1 ? d.irmao2 : d.irmao1;
        compromissos.push(compromisso({
            id: `designacao-${d.id}`,
            tipo: 'designacao',
            data: resolverDataDeQuadro(d.data, d.quadro.mes, d.quadro.ano),
            titulo: d.funcao,
            detalhe: parceiro ? `com ${parceiro}` : null,
            origem: { tipo: 'quadro', id: d.quadro.id, titulo: d.quadro.titulo, status: d.quadro.status },
        }));
    }

    // 2. Escala de dirigentes -------------------------------------------------
    const escalas = await prisma.escalaDirigente.findMany({
        where: {
            removido: false,
            OR: [{ principal: irmao.nome }, { substituto: irmao.nome }],
        },
        include: {
            quadro: { select: { id: true, mes: true, ano: true, titulo: true, status: true } },
            saidaCampo: { select: { local: true, horario: true } },
        },
    });

    for (const e of escalas) {
        if (!e.quadro) continue;
        const principal = ehEle(e.principal);
        const substituto = ehEle(e.substituto);
        if (!principal && !substituto) continue;

        const parceiro = principal ? e.substituto : e.principal;
        compromissos.push(compromisso({
            id: `dirigente-${e.id}`,
            tipo: 'dirigente',
            data: resolverDataDeQuadro(e.data, e.quadro.mes, e.quadro.ano),
            titulo: 'Saída de campo',
            detalhe: parceiro ? (principal ? `substituto: ${parceiro}` : `principal: ${parceiro}`) : null,
            papel: principal ? 'Principal' : 'Substituto',
            local: e.saidaCampo?.local,
            horario: e.saidaCampo?.horario,
            origem: { tipo: 'dirigentes', id: e.quadro.id, titulo: e.quadro.titulo, status: e.quadro.status },
        }));
    }

    // 3. Programacao da reuniao ----------------------------------------------
    const reunioes = await prisma.reuniao.findMany({ include: { semanas: true } });

    for (const reuniao of reunioes) {
        for (const semana of reuniao.semanas) {
            const { meio, fds, corrigida } = datasDaSemana(semana);

            for (const { campo, rotulo, momento } of CAMPOS_REUNIAO) {
                if (!campoMenciona(tokensIrmao, semana[campo])) continue;

                const data = momento === 'fds' ? fds : meio;
                compromissos.push(compromisso({
                    id: `reuniao-${semana.id}-${campo}`,
                    tipo: 'reuniao',
                    data,
                    titulo: rotulo,
                    detalhe: momento === 'semana'
                        ? semana.faixaData
                        : (momento === 'fds' ? 'Reunião do fim de semana' : 'Reunião do meio de semana'),
                    origem: { tipo: 'reuniao', id: reuniao.id, titulo: semana.faixaData, status: 'publicado' },
                    // A limpeza vale a semana inteira, e uma data reconciliada com o rótulo
                    // merece ressalva na tela.
                    aproximada: momento === 'semana' || !data || corrigida,
                }));
            }
        }
    }

    return compromissos.sort((a, b) => {
        if (!a.dataISO) return 1;
        if (!b.dataISO) return -1;
        return a.dataISO.localeCompare(b.dataISO) || a.titulo.localeCompare(b.titulo);
    });
}

module.exports = {
    listarPorIrmao,
    CAMPOS_REUNIAO,
    _internos: { normalizar, tokens, mesmaPessoa, fragmentos, campoMenciona, datasDaSemana },
};
