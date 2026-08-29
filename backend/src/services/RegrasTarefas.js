'use strict';

const { somarDias, instanteDe } = require('./RegrasLembrete');

/**
 * As tarefas de sistema: o que cada irmao ficou de fazer para o app funcionar, com que
 * frequencia isso volta e ate quando vale.
 *
 * Modulo PURO de proposito (nao toca banco nem le o relogio sozinho), pelo mesmo motivo de
 * RegrasLembrete: prazo errado nao levanta excecao nenhuma, so chega tarde. Assim
 * `scripts/verificarTarefas.js` fixa o "agora" e confere os limites um a um.
 *
 * A diferenca para RegrasLembrete e o que cada modulo responde. La: "o irmao tem compromisso,
 * quando aviso?". Aqui: "o irmao TEM DE FAZER uma coisa, ate quando, e ela ja foi feita?".
 *
 * TODO instante devolvido daqui e um "relogio da congregacao" (Date com os campos de
 * America/Bahia empacotados como UTC), igual ao de RegrasLembrete — os dois sao comparados
 * entre si no agendador, entao precisam viver no mesmo espaco.
 */

// ---------------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------------

/**
 * Com que frequencia a tarefa volta:
 *   'reuniao' — uma vez por reuniao (meio de semana E fim de semana).
 *   'semana'  — uma vez por semana de programacao.
 *   'mes'     — uma vez por mes, amarrada ao quadro.
 */
const CADENCIAS = {
    REUNIAO: 'reuniao',
    SEMANA: 'semana',
    MES: 'mes',
};

/**
 * Quantos dias antes do vencimento a tarefa aparece na tela.
 *
 * As de reuniao aparecem com 2 dias porque o prazo delas JA e a vespera: mostrar antes disso
 * encheria a lista de coisa que ainda nao da para fazer (o quadro da semana pode nem ter sido
 * montado). As de quadro aparecem com 14 porque montar um quadro nao e tarefa de uma tarde.
 */
const JANELAS = { reuniao: 2, semana: 0, mes: 14 };

/**
 * As tarefas.
 *
 * `atribuivel: false` marca a que NAO se designa a ninguem — a limpeza cai em quem esta no
 * grupo escalado na semana, e quem decide isso e a programacao, nao o admin.
 *
 * `conclusao`:
 *   'manual'    — o irmao toca em "Concluí" (grava TarefaConcluida).
 *   'quadro'    — conclui sozinha quando o quadro do mes alvo e PUBLICADO. Sem botao: um
 *                 botao aqui deixaria silenciar o prazo sem ter feito o quadro.
 *   'nenhuma'   — informativa; some quando a semana passa.
 */
const TIPOS = [
    {
        id: 'zoom',
        label: 'Link do Zoom',
        descricao: 'Mandar o convite do Zoom no grupo, na véspera de cada reunião',
        cadencia: CADENCIAS.REUNIAO,
        conclusao: 'manual',
        atribuivel: true,
        icone: 'videocam-outline',
        acao: { titulo: 'Ver o convite pronto', destino: 'reuniao' },
    },
    {
        id: 'quadroDirigentes',
        label: 'Quadro de Dirigentes',
        descricao: 'Montar e publicar a escala do mês seguinte antes que a atual acabe',
        cadencia: CADENCIAS.MES,
        conclusao: 'quadro',
        atribuivel: true,
        icone: 'compass-outline',
        acao: { titulo: 'Abrir escala de dirigentes', destino: 'dirigentes' },
    },
    {
        id: 'quadroDesignacoes',
        label: 'Quadro de Designações',
        descricao: 'Montar e publicar o quadro do mês seguinte antes que o atual acabe',
        cadencia: CADENCIAS.MES,
        conclusao: 'quadro',
        atribuivel: true,
        icone: 'document-text-outline',
        acao: { titulo: 'Abrir quadros de designações', destino: 'designacoes' },
    },
    {
        id: 'confirmacoes',
        label: 'Confirmações',
        descricao: 'Falar com quem tem parte e anotar quem confirmou, até a véspera',
        cadencia: CADENCIAS.SEMANA,
        conclusao: 'manual',
        atribuivel: true,
        icone: 'checkmark-circle-outline',
        acao: { titulo: 'Abrir confirmações', destino: 'confirmacoes' },
    },
    {
        id: 'compartilharQuadro',
        label: 'Compartilhar Quadro de Designações',
        descricao: 'Postar a imagem das designações mecânicas na véspera de cada reunião',
        cadencia: CADENCIAS.REUNIAO,
        conclusao: 'manual',
        atribuivel: true,
        icone: 'share-social-outline',
        acao: { titulo: 'Abrir o quadro', destino: 'designacoes' },
    },
    {
        id: 'limpeza',
        label: 'Limpeza do salão',
        descricao: 'A semana em que o seu grupo de campo faz a limpeza',
        cadencia: CADENCIAS.SEMANA,
        conclusao: 'nenhuma',
        atribuivel: false,
        icone: 'sparkles-outline',
        acao: null,
    },
];

const IDS_TIPOS = TIPOS.map(t => t.id);
const IDS_ATRIBUIVEIS = TIPOS.filter(t => t.atribuivel).map(t => t.id);

function tipoPorId(id) {
    return TIPOS.find(t => t.id === id) || null;
}

/**
 * Descarta o que nao esta no catalogo, remove repetido e recusa o que nao se atribui.
 *
 * Mesmo criterio de `sanearEscopos`: um id inventado viraria uma tarefa que nunca aparece, e
 * o admin ficaria achando que designou. `limpeza` e recusada aqui de proposito — designa-la a
 * mao daria a alguem uma limpeza que o grupo dele nao tem.
 */
function sanearTarefas(valor) {
    if (!Array.isArray(valor)) return [];
    return [...new Set(valor.filter(t => IDS_ATRIBUIVEIS.includes(t)))];
}

/** Catalogo para a tela desenhar sem duplicar os textos aqui e la. */
const CATALOGO = TIPOS
    .filter(t => t.atribuivel)
    .map(({ id, label, descricao, cadencia, icone }) => ({
        id,
        label,
        descricao,
        cadencia,
        icone,
        cadenciaLabel: rotuloDaCadencia(cadencia),
    }));

function rotuloDaCadencia(cadencia) {
    if (cadencia === CADENCIAS.REUNIAO) return 'A cada reunião';
    if (cadencia === CADENCIAS.SEMANA) return 'Toda semana';
    return 'Todo mês';
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

/** Dia da semana (0=domingo) de uma data ISO, sem depender do fuso do servidor. */
function diaDaSemanaISO(dataISO) {
    const [ano, mes, dia] = String(dataISO).split('-').map(Number);
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    return Number.isNaN(d.getTime()) ? null : d.getUTCDay();
}

/**
 * Segunda-feira que abre a semana da data (semana de segunda a domingo).
 *
 * Espelha `segundaDaSemana` de utils/semanaReuniao.js, mas em ISO e sem passar por Date local
 * — misturar os dois espacos e o que faz um lembrete escorregar um dia na virada.
 */
function segundaDaSemanaISO(dataISO) {
    const dow = diaDaSemanaISO(dataISO);
    if (dow === null) return null;
    // Domingo (0) pertence a semana que comecou na segunda anterior, 6 dias atras.
    return somarDias(dataISO, dow === 0 ? -6 : 1 - dow);
}

/** Domingo que fecha a semana da data. */
function domingoDaSemanaISO(dataISO) {
    const segunda = segundaDaSemanaISO(dataISO);
    return segunda ? somarDias(segunda, 6) : null;
}

/** Ultimo dia do mes, em ISO. `mes` e 1-12. */
function ultimoDiaDoMes(ano, mes) {
    return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

/** O mes seguinte a (ano, mes), com o vira-ano resolvido. `mes` e 1-12. */
function mesSeguinte(ano, mes) {
    return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

const NOMES_MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** "2026-09-03" -> "03/09". */
function diaMes(dataISO) {
    const [, mes, dia] = String(dataISO).split('-');
    return `${dia}/${mes}`;
}

// ---------------------------------------------------------------------------
// Vencimento e janela
// ---------------------------------------------------------------------------

/**
 * Ate quando a tarefa vale, dado o "alvo" dela.
 *
 * O alvo muda com a cadencia:
 *   reuniao — a data da reuniao. Vence na VESPERA: o link e o quadro tem de estar no grupo
 *             antes do dia, nao no dia.
 *   semana  — a data da reuniao de meio de semana daquela semana. Tambem vence na vespera
 *             (as confirmacoes servem para a reuniao de quinta; na quinta ja nao servem).
 *             A limpeza e a excecao: vale a semana inteira, entao vence no domingo.
 *   mes     — o ultimo dia coberto pelo quadro ATUAL. Depois dele a congregacao fica sem
 *             escala, que e exatamente o prazo que o irmao descreveu.
 */
function vencimentoDe(tipo, alvoISO) {
    if (!alvoISO) return null;
    if (tipo.id === 'limpeza') return domingoDaSemanaISO(alvoISO);
    if (tipo.cadencia === CADENCIAS.MES) return alvoISO;
    return somarDias(alvoISO, -1);
}

/**
 * A partir de que dia a tarefa aparece na lista.
 *
 * As semanais abrem na SEGUNDA da semana, nao num offset do vencimento: a semana e a unidade
 * de que o irmao fala ("as confirmacoes desta semana"), e um offset faria a tarefa aparecer
 * na terca de uma semana e na segunda de outra conforme o dia da reuniao mudasse.
 */
function aberturaDe(tipo, alvoISO, vencimentoISO) {
    if (!vencimentoISO) return null;
    if (tipo.cadencia === CADENCIAS.SEMANA) return segundaDaSemanaISO(alvoISO);
    return somarDias(vencimentoISO, -JANELAS[tipo.cadencia]);
}

/**
 * A tarefa some da lista depois de que dia?
 *
 * Nao e o vencimento: uma tarefa vencida continua na lista, em atraso, ate o evento passar —
 * some-la no vencimento esconderia justamente a que mais precisa de olho. O limite e o
 * proprio alvo (a reuniao aconteceu, o quadro virou o mes), com um dia de folga para a
 * tarefa de reuniao ainda aparecer no proprio dia dela.
 */
function limiteDe(tipo, alvoISO) {
    if (!alvoISO) return null;
    if (tipo.id === 'limpeza') return domingoDaSemanaISO(alvoISO);
    if (tipo.cadencia === CADENCIAS.MES) return somarDias(alvoISO, 21);
    return alvoISO;
}

/**
 * A tarefa deve estar visivel em `hojeISO`?
 *
 * Aberta <= hoje <= limite. Comparacao de string ISO e valida porque YYYY-MM-DD ordena
 * lexicograficamente igual a cronologicamente.
 */
function estaVisivel({ aberturaISO, limiteISO }, hojeISO) {
    if (!aberturaISO || !limiteISO) return false;
    return aberturaISO <= hojeISO && hojeISO <= limiteISO;
}

/** Quantos dias faltam para o vencimento (negativo = atrasada). */
function diasAte(vencimentoISO, hojeISO) {
    if (!vencimentoISO || !hojeISO) return null;
    const ms = Date.parse(`${vencimentoISO}T00:00:00Z`) - Date.parse(`${hojeISO}T00:00:00Z`);
    return Math.round(ms / 86400000);
}

/**
 * Quantos dias antes do vencimento a tarefa entra em ALERTA.
 *
 * 1 dia: alerta e "e para agora", nao "esta chegando". Alargar isso pinta metade da lista de
 * ambar e a cor para de querer dizer alguma coisa.
 */
const LIMIAR_DE_ALERTA = 1;

/**
 * Em que pe a tarefa esta: 'atrasada' | 'alerta' | 'emDia' | 'informativa'.
 *
 * Mora AQUI, e nao na tela, porque agora duas telas leem isto — a lista do irmao e o painel
 * do admin. Cada uma com o proprio `if` acabaria pintando a mesma tarefa de cores
 * diferentes em lugares diferentes.
 */
function situacaoDe(diasAteVencer, tipo) {
    // A informativa (limpeza) nunca cobra: nao ha entrega para atrasar.
    if (tipo && tipo.conclusao === 'nenhuma') return 'informativa';
    if (diasAteVencer === null || diasAteVencer === undefined) return 'emDia';
    if (diasAteVencer < 0) return 'atrasada';
    if (diasAteVencer <= LIMIAR_DE_ALERTA) return 'alerta';
    return 'emDia';
}

/** "Vence hoje", "Vence amanhã", "Atrasada há 2 dias", "Faltam 5 dias". */
function rotuloDoPrazo(vencimentoISO, hojeISO) {
    const dias = diasAte(vencimentoISO, hojeISO);
    if (dias === null) return 'Sem prazo definido';
    if (dias === 0) return 'Vence hoje';
    if (dias === 1) return 'Vence amanhã';
    if (dias === -1) return 'Atrasada desde ontem';
    if (dias < -1) return `Atrasada há ${-dias} dias`;
    return `Faltam ${dias} dias`;
}

/**
 * O mesmo, para a tarefa que so INFORMA: "Hoje", "Amanhã", "Em 5 dias".
 *
 * Sem "vence" e sem "atrasada" porque nao ha nada a cumprir nem prazo a perder — a limpeza
 * do salao e a semana do grupo, e nao uma entrega. Dizer "Vence amanhã" ali cobrava uma
 * coisa que ninguem pediu, e de um grupo inteiro.
 */
function rotuloInformativo(vencimentoISO, hojeISO) {
    const dias = diasAte(vencimentoISO, hojeISO);
    if (dias === null) return 'Sem data definida';
    if (dias === 0) return 'Hoje';
    if (dias === 1) return 'Amanhã';
    if (dias < 0) return 'Esta semana';
    return `Em ${dias} dias`;
}

// ---------------------------------------------------------------------------
// Avisos (push)
// ---------------------------------------------------------------------------

/**
 * Quando cada tarefa avisa.
 *
 * `ancora`:
 *   'vencimento' — `dias` dias ANTES do vencimento, na `hora`.
 *   'segunda'    — a segunda-feira da semana do alvo, na `hora`. E ancora propria, e nao um
 *                  offset, porque foi pedida assim ("toda segunda por volta das 10h") e
 *                  porque um offset escorregaria junto com o dia da reuniao.
 *
 * `id` entra na chave de idempotencia (LembreteEnviado.regra): sem ele o aviso das 10h
 * travaria o das 18h do mesmo dia.
 */
const AVISOS = {
    zoom: [
        { id: 'manha', ancora: 'vencimento', dias: 0, hora: '09:00' },
        { id: 'tarde', ancora: 'vencimento', dias: 0, hora: '17:00' },
    ],
    compartilharQuadro: [
        { id: 'manha', ancora: 'vencimento', dias: 0, hora: '09:00' },
        { id: 'tarde', ancora: 'vencimento', dias: 0, hora: '17:00' },
    ],
    confirmacoes: [
        { id: 'segunda', ancora: 'segunda', hora: '10:00' },
        { id: 'vespera', ancora: 'vencimento', dias: 0, hora: '09:00' },
    ],
    quadroDirigentes: [
        { id: '7d', ancora: 'vencimento', dias: 7, hora: '10:00' },
        { id: '3d', ancora: 'vencimento', dias: 3, hora: '10:00' },
        { id: '1d', ancora: 'vencimento', dias: 1, hora: '10:00' },
        { id: 'hoje', ancora: 'vencimento', dias: 0, hora: '10:00' },
    ],
    quadroDesignacoes: [
        { id: '7d', ancora: 'vencimento', dias: 7, hora: '10:00' },
        { id: '3d', ancora: 'vencimento', dias: 3, hora: '10:00' },
        { id: '1d', ancora: 'vencimento', dias: 1, hora: '10:00' },
        { id: 'hoje', ancora: 'vencimento', dias: 0, hora: '10:00' },
    ],
    // Informativa: aparece na lista e pronto. Ninguem pediu para ser acordado por ela, e a
    // limpeza e do grupo inteiro — um push por irmao do grupo seria barulho por semana.
    limpeza: [],
};

function avisosDe(tipoId) {
    return AVISOS[tipoId] || [];
}

/** O instante em que o aviso deve sair, no relogio da congregacao. */
function instanteDoAviso(aviso, { alvoISO, vencimentoISO }) {
    if (aviso.ancora === 'segunda') {
        const segunda = segundaDaSemanaISO(alvoISO);
        return segunda ? instanteDe(segunda, aviso.hora) : null;
    }
    if (!vencimentoISO) return null;
    return instanteDe(somarDias(vencimentoISO, -aviso.dias), aviso.hora);
}

/**
 * Titulo e corpo do push.
 *
 * O recado sobre o quadro no grupo entra SO no aviso de segunda das confirmacoes, e foi
 * pedido nominalmente: e por aquele quadro postado que se sabe quem ainda falta confirmar,
 * entao o lembrete de confirmar sem o de conferir o quadro serve pela metade.
 */
function textoDoAviso(tipo, aviso, { alvoISO, vencimentoISO, referencia }) {
    if (tipo.id === 'zoom') {
        return {
            titulo: 'Link do Zoom',
            corpo: `Compartilhe o convite do Zoom da reunião de ${diaMes(alvoISO)} no grupo.`,
        };
    }
    if (tipo.id === 'compartilharQuadro') {
        return {
            titulo: 'Quadro de designações',
            corpo: `Compartilhe a imagem das designações mecânicas da reunião de ${diaMes(alvoISO)}.`,
        };
    }
    if (tipo.id === 'confirmacoes') {
        if (aviso.id === 'segunda') {
            return {
                titulo: 'Confirmações da semana',
                corpo:
                    'Fale com quem tem parte nesta semana e anote quem confirmou.\n\n' +
                    'Confira também se o irmão Marcelo já postou o quadro no grupo — ' +
                    'é por ele que se sabe quem ainda precisa confirmar.',
            };
        }
        return {
            titulo: 'Confirmações vencem hoje',
            corpo: `Hoje é o último dia para confirmar as designações da reunião de ${diaMes(alvoISO)}.`,
        };
    }
    // Quadros.
    //
    // O artigo vem da tabela, e nao concordado na mao: "escala" e feminino e "quadro" e
    // masculino, e a primeira versao deste texto dizia "Monte a quadro de designações".
    const { artigo, nome } = tipo.id === 'quadroDirigentes'
        ? { artigo: 'a', nome: 'escala de dirigentes' }
        : { artigo: 'o', nome: 'quadro de designações' };

    // `referencia` e o MES que falta montar ("setembro de 2026"). Nao pode ser o detalhe do
    // card ("O quadro atual termina em 31/08"): emendado aqui, ele produzia
    // "Monte o quadro de designações de O quadro atual termina em 31/08".
    const alvo = referencia ? ` de ${referencia}` : '';
    const dias = aviso.dias;
    const quando = dias === 0
        ? 'vence hoje'
        : dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`;

    return {
        titulo: dias === 0 ? `Último dia: ${nome}${alvo}` : `Monte ${artigo} ${nome}${alvo}`,
        corpo:
            `${artigo === 'a' ? 'A' : 'O'} ${nome}${alvo} ${quando} (${diaMes(vencimentoISO)}). ` +
            'Depois dessa data a congregação fica sem escala.',
    };
}

module.exports = {
    TIPOS,
    IDS_TIPOS,
    IDS_ATRIBUIVEIS,
    CADENCIAS,
    CATALOGO,
    JANELAS,
    AVISOS,
    NOMES_MESES,
    tipoPorId,
    sanearTarefas,
    rotuloDaCadencia,
    // Reexportado de RegrasLembrete: quem faz conta de dia neste assunto olha para este
    // modulo, e obrigar o painel a importar os dois so para somar dias espalharia a origem
    // da mesma aritmetica por dois lugares.
    somarDias,
    diaDaSemanaISO,
    segundaDaSemanaISO,
    domingoDaSemanaISO,
    ultimoDiaDoMes,
    mesSeguinte,
    diaMes,
    vencimentoDe,
    aberturaDe,
    limiteDe,
    estaVisivel,
    diasAte,
    rotuloDoPrazo,
    rotuloInformativo,
    situacaoDe,
    LIMIAR_DE_ALERTA,
    avisosDe,
    instanteDoAviso,
    textoDoAviso,
};
