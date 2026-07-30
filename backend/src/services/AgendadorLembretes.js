'use strict';

const LembreteDesignacoesService = require('./LembreteDesignacoesService');

/**
 * Agendador dos lembretes: acorda de 15 em 15 minutos e despacha o que venceu.
 *
 * ANTES era um unico disparo diario as 19:00. Nao serve mais: desde que cada irmao escolhe a
 * antecedencia, existe lembrete que vence as 16:30 ("3 horas antes" de uma reuniao das
 * 19:30) e outro que vence uma semana antes. Quem decide se algo venceu e
 * RegrasLembrete.estaVencida; aqui so garantimos que alguem pergunte com frequencia.
 *
 * 15 minutos e o passo porque os horarios de reuniao caem em meia hora cheia ("19:30"), e
 * subtrair horas inteiras disso mantem o alvo na meia hora — um passo de 1 hora erraria todos
 * os alvos :30. A janela de graca de 6h em estaVencida cobre o resto: reinicio de container,
 * deploy no meio do caminho, tique perdido.
 *
 * Usa `setTimeout` puro de proposito. O docker-compose monta /app/node_modules como volume
 * anonimo, entao qualquer dependencia nova (node-cron e afins) exige rebuild da imagem e
 * quebra o deploy de quem so faz git pull.
 */

const PASSO_MS = 15 * 60 * 1000;

let agendado = false;

/** Quantos ms faltam para o proximo quarto de hora cheio (:00, :15, :30, :45). */
function msAteProximoTique(agora = new Date()) {
    const t = agora.getTime();
    const proximo = Math.floor(t / PASSO_MS) * PASSO_MS + PASSO_MS;
    return proximo - t;
}

async function tique() {
    try {
        await LembreteDesignacoesService.processarTick();
    } catch (erro) {
        // Uma falha de envio nao pode matar o agendamento seguinte: sem isso, um push com
        // erro deixaria a congregacao sem lembrete ate o proximo restart.
        console.error('[lembretes] falha no tique:', erro);
    }
}

function agendar() {
    // Recalcula a partir do relogio em vez de somar o passo fixo: somar acumula o atraso do
    // proprio setTimeout e os tiques escorregam para fora da meia hora com o passar dos dias.
    setTimeout(async () => {
        await tique();
        agendar();
    }, msAteProximoTique());
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

    console.log(`[lembretes] agendador ligado: um tique a cada ${PASSO_MS / 60000} minutos.`);

    // Um tique imediato no boot recupera o que venceu enquanto o container estava fora do ar
    // (deploy do EasyPanel, crash), dentro da janela de graca. A trava de LembreteEnviado
    // torna essa re-execucao segura — quem ja foi avisado e pulado. Sem `await` para nao
    // segurar o listen.
    tique();
    agendar();
}

module.exports = { iniciar, msAteProximoTique, PASSO_MS };
