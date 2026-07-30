'use strict';

/**
 * Regras de antecedencia do lembrete e a aritmetica de quando cada uma dispara.
 *
 * Modulo PURO de proposito (nao toca banco, nao le relogio sozinho): e a parte com mais
 * chance de erro silencioso — um lembrete que sai na hora errada nao gera excecao nenhuma,
 * so chega tarde. Assim `scripts/verificarRegrasLembrete.js` consegue fixar o "agora" e
 * conferir os limites.
 *
 * TODO instante aqui e um "relogio da congregacao": um Date cujos campos UTC carregam a
 * hora local de America/Bahia. Comparar dois desses e valido porque ambos estao no mesmo
 * espaco — e evita depender do fuso do servidor, que roda em UTC no deploy e no fuso da
 * maquina em desenvolvimento.
 */

const FUSO = 'America/Bahia';

const FORMATADOR_RELOGIO = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

/** O instante recebido, com os campos de data/hora da congregacao empacotados como UTC. */
function relogioDaCongregacao(instante = new Date()) {
    const partes = {};
    for (const p of FORMATADOR_RELOGIO.formatToParts(instante)) partes[p.type] = p.value;
    return new Date(Date.UTC(
        Number(partes.year),
        Number(partes.month) - 1,
        Number(partes.day),
        Number(partes.hour),
        Number(partes.minute),
        Number(partes.second)
    ));
}

/**
 * As antecedencias que o irmao pode escolher.
 *
 * `dias` dispara numa hora fixa (o quadro nao muda de tarde para noite, entao 19h serve
 * para todas); `horasAntes` dispara relativo ao inicio da reuniao, que so existe porque a
 * congregacao cadastra o horario em Config.
 */
const REGRAS = [
    {
        id: '7d', label: '1 semana antes', descricao: 'Às 19h',
        dias: 7, hora: '19:00',
        titulo: 'Suas designações da semana que vem', quando: 'em uma semana',
    },
    {
        id: '3d', label: '3 dias antes', descricao: 'Às 19h',
        dias: 3, hora: '19:00',
        titulo: 'Suas designações em 3 dias', quando: 'em 3 dias',
    },
    {
        id: '1d', label: '1 dia antes', descricao: 'Na véspera, às 19h',
        dias: 1, hora: '19:00',
        titulo: 'Suas designações de amanhã', quando: 'amanhã',
    },
    {
        id: '3h', label: '3 horas antes', descricao: 'Contado do início da reunião',
        horasAntes: 3,
        titulo: 'Suas designações de hoje', quando: 'hoje',
    },
    {
        id: '1h', label: '1 hora antes', descricao: 'Contado do início da reunião',
        horasAntes: 1,
        titulo: 'Daqui a pouco: suas designações', quando: 'hoje',
    },
];

/** Tipos de compromisso que o irmao pode ligar/desligar (o `tipo` de MinhasDesignacoesService). */
const TIPOS = [
    { id: 'designacao', label: 'Designações do quadro', descricao: 'Microfone, indicador, áudio e vídeo, estacionamento' },
    { id: 'dirigente', label: 'Saída de campo', descricao: 'Quando você é o dirigente do turno' },
    { id: 'reuniao', label: 'Partes da reunião', descricao: 'Leitura, ministério, discurso, oração...' },
];

/** Sem preferencia gravada vale isto — que e exatamente o comportamento anterior a esta tela. */
const PADRAO = Object.freeze({
    tipos: TIPOS.map(t => t.id),
    antecedencias: ['1d'],
});

const IDS_REGRAS = REGRAS.map(r => r.id);
const IDS_TIPOS = TIPOS.map(t => t.id);

function regraPorId(id) {
    return REGRAS.find(r => r.id === id) || null;
}

/**
 * Descarta o que nao reconhece em vez de confiar no cliente: um id inventado viraria uma
 * regra que nunca dispara, e o irmao ficaria sem lembrete achando que configurou.
 */
function normalizarPreferencia(bruto) {
    const tipos = Array.isArray(bruto?.tipos)
        ? bruto.tipos.filter(t => IDS_TIPOS.includes(t))
        : PADRAO.tipos;
    const antecedencias = Array.isArray(bruto?.antecedencias)
        ? bruto.antecedencias.filter(a => IDS_REGRAS.includes(a))
        : PADRAO.antecedencias;
    return {
        tipos: [...new Set(tipos)],
        antecedencias: [...new Set(antecedencias)],
    };
}

/** 'YYYY-MM-DD' + 'HH:MM' -> instante no relogio da congregacao. */
function instanteDe(dataISO, hora) {
    const [ano, mes, dia] = String(dataISO).split('-').map(Number);
    const [h, m] = String(hora || '00:00').split(':').map(Number);
    return new Date(Date.UTC(ano, mes - 1, dia, h || 0, m || 0, 0, 0));
}

/** Soma dias a uma data ISO sem passar por timestamp (fim de mes e ano bissexto inclusos). */
function somarDias(dataISO, dias) {
    const [ano, mes, dia] = String(dataISO).split('-').map(Number);
    return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

const ehFimDeSemana = (dataISO) => {
    const [ano, mes, dia] = String(dataISO).split('-').map(Number);
    const diaDaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
    return diaDaSemana === 0 || diaDaSemana === 6;
};

/**
 * A que horas comeca o compromisso.
 *
 * A saida de campo tem horario proprio gravado e ele ganha do horario da reuniao — e o unico
 * compromisso do app que nao acontece no salao.
 */
function horaDoCompromisso(item, config) {
    if (item?.horario && /^\d{1,2}:\d{2}$/.test(item.horario)) return item.horario;
    return ehFimDeSemana(item?.dataISO)
        ? (config?.horaFimDeSemana || '09:00')
        : (config?.horaMeioSemana || '19:30');
}

/**
 * Sobre qual dia esta regra fala se disparar hoje.
 *
 * As de dias olham para frente (hoje + N). As de horas sempre falam do proprio dia: "3 horas
 * antes" de uma reuniao das 19:30 cai as 16:30 do mesmo dia.
 */
function diaAlvo(hojeISO, regra) {
    return regra.dias ? somarDias(hojeISO, regra.dias) : hojeISO;
}

/**
 * O instante exato em que a regra deve disparar, para os compromissos daquele dia.
 * `itens` so importa para as regras por hora (de onde sai o inicio da reuniao).
 */
function instanteDoDisparo(dataISO, regra, itens, config) {
    if (regra.dias) {
        return instanteDe(somarDias(dataISO, -regra.dias), regra.hora);
    }
    // Varios compromissos no mesmo dia: vale o mais cedo, senao o lembrete de uma parte da
    // manha sairia calculado pela reuniao da noite e chegaria depois dela.
    const horas = (itens || []).map(i => horaDoCompromisso(i, config)).sort();
    const inicio = horas[0] || horaDoCompromisso({ dataISO }, config);
    const alvo = instanteDe(dataISO, inicio);
    alvo.setUTCHours(alvo.getUTCHours() - regra.horasAntes);
    return alvo;
}

/**
 * A regra esta vencida agora?
 *
 * Vencida = o instante ja passou, mas ha menos de `gracaMs`. A graca existe para o container
 * que reinicia no meio do caminho (deploy do EasyPanel) conseguir recuperar o disparo; o
 * limite superior impede que ligar uma regra nova hoje dispare de uma vez todos os lembretes
 * cujo instante ja tinha passado.
 */
function estaVencida(alvo, agora, gracaMs) {
    const t = alvo.getTime();
    const n = agora.getTime();
    return t <= n && n - t < gracaMs;
}

module.exports = {
    REGRAS,
    TIPOS,
    PADRAO,
    FUSO,
    relogioDaCongregacao,
    regraPorId,
    normalizarPreferencia,
    instanteDe,
    somarDias,
    ehFimDeSemana,
    horaDoCompromisso,
    diaAlvo,
    instanteDoDisparo,
    estaVencida,
};
