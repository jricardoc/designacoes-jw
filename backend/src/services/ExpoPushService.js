'use strict';

const prisma = require('../prisma');

/**
 * Envio de notificacoes push pela API do Expo.
 *
 * NAO EXISTE RETRY, de proposito. O unico push do sistema e o lembrete de vespera:
 * se o envio falhar hoje as 19h, reenviar amanha avisaria sobre um dia que ja passou,
 * ou seja, o dado perde valor junto com a janela. Uma fila de retry (com backoff,
 * persistencia e desduplicacao) seria mais infraestrutura do que o problema merece —
 * a falha e registrada no log e o proximo lembrete sai normalmente no dia seguinte.
 *
 * Pelo mesmo motivo os "tickets" devolvidos aqui nao sao consultados depois no
 * endpoint de receipts do Expo: o ticket ok ja diz que a mensagem entrou na fila da
 * Apple/Google, e o que acontece dali para frente nao muda nada do nosso lado.
 */

const URL_EXPO = 'https://exp.host/--/api/v2/push/send';

// Teto da API do Expo por requisicao.
const TAMANHO_LOTE = 100;

// Sem timeout um fetch pendurado seguraria o agendador para sempre, porque o disparo
// das 19h e sequencial e so reagenda quando termina.
const TIMEOUT_MS = 15000;

/**
 * Token morto = app desinstalado ou credencial revogada. Se nao apagar, a linha fica
 * no banco para sempre e a cada lembrete gastamos uma mensagem em quem nunca recebe.
 */
async function removerTokens(tokens) {
    if (tokens.length === 0) return 0;
    try {
        const { count } = await prisma.pushToken.deleteMany({ where: { token: { in: tokens } } });
        return count;
    } catch (erro) {
        console.error('[push] Nao consegui apagar tokens invalidos:', erro.message);
        return 0;
    }
}

/**
 * @param {Array<{ to: string, title: string, body: string, data?: object }>} mensagens
 * @returns {Promise<{ enviados: number, falhas: number, removidos: number }>}
 */
async function enviar(mensagens) {
    const resumo = { enviados: 0, falhas: 0, removidos: 0 };

    const lista = (Array.isArray(mensagens) ? mensagens : []).filter(m => m && m.to);
    if (lista.length === 0) return resumo;

    const mortos = new Set();

    for (let inicio = 0; inicio < lista.length; inicio += TAMANHO_LOTE) {
        const lote = lista.slice(inicio, inicio + TAMANHO_LOTE);

        try {
            const resposta = await fetch(URL_EXPO, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(lote),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });

            if (!resposta.ok) {
                const corpo = await resposta.text().catch(() => '');
                console.error(`[push] Expo respondeu ${resposta.status}:`, corpo.slice(0, 500));
                resumo.falhas += lote.length;
                continue;
            }

            const json = await resposta.json();
            const tickets = json && Array.isArray(json.data) ? json.data : null;
            if (!tickets) {
                console.error('[push] Resposta do Expo fora do formato esperado:', JSON.stringify(json).slice(0, 500));
                resumo.falhas += lote.length;
                continue;
            }

            // O Expo devolve um ticket por mensagem, NA ORDEM enviada — e o unico jeito
            // de saber a qual token cada erro pertence.
            lote.forEach((mensagem, indice) => {
                const ticket = tickets[indice];
                if (!ticket) {
                    // Menos tickets que mensagens: sem correspondencia confiavel, nao da
                    // para culpar um token especifico; conta como falha e nao apaga nada.
                    resumo.falhas++;
                    return;
                }
                if (ticket.status === 'ok') {
                    resumo.enviados++;
                    return;
                }

                resumo.falhas++;
                console.warn(`[push] Falha em ${mensagem.to}: ${ticket.message || 'erro sem mensagem'}`);
                if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
                    mortos.add(mensagem.to);
                }
            });
        } catch (erro) {
            // Rede fora, DNS, timeout ou JSON invalido: o lote inteiro se perde, mas quem
            // chamou (o agendador, o boot) nao pode cair por causa disso.
            console.error('[push] Erro ao falar com o Expo:', erro.message);
            resumo.falhas += lote.length;
        }
    }

    resumo.removidos = await removerTokens([...mortos]);
    return resumo;
}

module.exports = { enviar };
