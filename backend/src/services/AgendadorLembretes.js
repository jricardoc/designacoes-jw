'use strict';

const LembreteDesignacoesService = require('./LembreteDesignacoesService');

/**
 * Agendador do lembrete diario: dispara as 19:00 de America/Bahia e reagenda o dia seguinte.
 *
 * Usa `setTimeout` puro de proposito. O docker-compose monta /app/node_modules como volume
 * anonimo, entao qualquer dependencia nova (node-cron e afins) exige rebuild da imagem e
 * quebra o deploy de quem so faz git pull.
 */

const FUSO = 'America/Bahia';
const HORA_DISPARO = 19;

let agendado = false;

// hourCycle h23 para a hora vir 00-23; em alguns locales `hour12: false` devolve 24.
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

/**
 * O mesmo instante, mas com os campos de data/hora do fuso da congregacao empacotados como se
 * fossem UTC. Permite fazer aritmetica de calendario sem depender do fuso do servidor (que
 * roda em UTC no deploy e no fuso da maquina em desenvolvimento).
 */
function relogioDaCongregacao(instante) {
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
 * Quantos ms faltam para as 19:00 da congregacao.
 *
 * A diferenca e calculada dentro do proprio fuso; como a Bahia nao tem horario de verao desde
 * 2019, o deslocamento e constante e essa diferenca vale tambem no relogio do servidor.
 */
function msAteProximoDisparo(agora = new Date()) {
    const local = relogioDaCongregacao(agora);
    const alvo = new Date(Date.UTC(
        local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), HORA_DISPARO, 0, 0, 0
    ));
    if (alvo.getTime() <= local.getTime()) alvo.setUTCDate(alvo.getUTCDate() + 1);
    return alvo.getTime() - local.getTime();
}

function emHorasMinutos(ms) {
    const minutos = Math.round(ms / 60000);
    return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`;
}

function agendar() {
    const espera = msAteProximoDisparo();
    console.log(`[lembretes] proximo disparo em ${emHorasMinutos(espera)} (19:00 ${FUSO}).`);

    setTimeout(async () => {
        try {
            await LembreteDesignacoesService.enviarLembretesDeAmanha();
        } catch (erro) {
            // Uma falha de envio nao pode matar o agendamento seguinte: sem isso, um push com
            // erro deixaria a congregacao sem lembrete ate o proximo restart.
            console.error('[lembretes] falha no disparo:', erro);
        }
        // Recalcula a partir do relogio em vez de somar 24h fixas: somar acumula o atraso do
        // proprio setTimeout e o disparo escorrega alguns segundos por dia.
        agendar();
    }, espera);
}

function iniciar() {
    if (process.env.LEMBRETES_ATIVOS === 'false') {
        console.log('[lembretes] desligado (LEMBRETES_ATIVOS=false).');
        return;
    }
    // Dois agendamentos mandariam o push duas vezes; a trava de LembreteEnviado seguraria o
    // estrago, mas melhor nem chegar la.
    if (agendado) return;
    agendado = true;
    agendar();
}

module.exports = { iniciar, msAteProximoDisparo };
