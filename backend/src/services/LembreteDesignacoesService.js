'use strict';

const prisma = require('../prisma');
const MinhasDesignacoesService = require('./MinhasDesignacoesService');
const ExpoPushService = require('./ExpoPushService');

/**
 * Lembrete diario: um dia antes, cada irmao recebe um push com o que ele tem no dia seguinte.
 *
 * A lista de compromissos sai inteira de MinhasDesignacoesService.listarPorIrmao — o casamento
 * de nome dele e restritivo de proposito e nao pode ser reimplementado aqui, senao o lembrete
 * avisaria coisa que a tela do irmao nem mostra.
 */

const FUSO = 'America/Bahia';

// 'en-CA' ja formata como YYYY-MM-DD, que e exatamente o formato de `dataISO`.
const FORMATADOR_DIA = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/** Dia de calendario da congregacao, nao o do servidor (que roda em UTC). */
function dataDeHojeEmBahia(agora = new Date()) {
    return FORMATADOR_DIA.format(agora);
}

/**
 * "Amanha" no fuso da congregacao, em YYYY-MM-DD.
 *
 * A soma do dia e feita sobre a DATA DE CALENDARIO, nunca sobre o timestamp: as 22h de Bahia
 * ja e o dia seguinte em UTC, entao somar 24h ao relogio pularia um dia na virada. `Date.UTC`
 * cuida sozinho de fim de mes e de ano bissexto.
 */
function dataDeAmanhaEmBahia(agora = new Date()) {
    const [ano, mes, dia] = dataDeHojeEmBahia(agora).split('-').map(Number);
    return new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' -> 'DD/MM', que e como o quadro impresso mostra a data. */
function diaMes(dataISO) {
    const [, mes, dia] = String(dataISO).split('-');
    return `${dia}/${mes}`;
}

/**
 * "Leitura da Bíblia - amanhã, 05/08" ou "Leitura da Bíblia e mais 2 - amanhã, 05/08".
 *
 * O corpo do push e cortado pelo sistema operacional em poucas linhas; citar so o primeiro
 * item (os compromissos ja vem ordenados) e contar o resto cabe sempre.
 */
function montarCorpo(itens, dataISO) {
    const quando = `amanhã, ${diaMes(dataISO)}`;
    if (itens.length === 1) return `${itens[0].titulo} - ${quando}`;
    return `${itens[0].titulo} e mais ${itens.length - 1} - ${quando}`;
}

/**
 * Envia o lembrete de um dia.
 *
 * `usuarioIds` limita o publico (a rota de teste manda so para quem pediu, para uma conferencia
 * nao virar push na congregacao inteira). `usarTrava` desliga a idempotencia E o registro dela:
 * um teste nao pode consumir a trava do dia, senao o disparo real das 19h seria pulado.
 *
 * `diagnostico` existe para o teste conseguir dizer POR QUE nada saiu — sem ele, "0 enviados"
 * e indistinguivel entre "ninguem tem token", "ninguem tem designacao" e "quadro em rascunho".
 */
async function enviarLembretes({ dataISO, usuarioIds = null, usarTrava = true } = {}) {
    const dia = dataISO || dataDeAmanhaEmBahia();

    const usuarios = await prisma.usuario.findMany({
        where: {
            irmaoId: { not: null },
            pushTokens: { some: {} },
            ...(usuarioIds ? { id: { in: usuarioIds } } : {}),
        },
        include: { irmao: true, pushTokens: true },
    });

    const diagnostico = { comAparelho: usuarios.length, semCompromisso: 0, jaAvisados: 0 };

    if (usuarios.length === 0) {
        console.log(`[lembretes] ${dia}: nenhum usuario com aparelho registrado.`);
        return { data: dia, usuarios: 0, enviados: 0, falhas: 0, diagnostico };
    }

    // Trava de idempotencia: se o container reiniciar depois do disparo, o agendador roda de
    // novo no mesmo dia e nao pode repetir o push de quem ja foi avisado.
    let avisados = new Set();
    if (usarTrava) {
        const jaAvisados = await prisma.lembreteEnviado.findMany({
            where: { dataISO: dia, usuarioId: { in: usuarios.map(u => u.id) } },
            select: { usuarioId: true },
        });
        avisados = new Set(jaAvisados.map(l => l.usuarioId));
    }

    const mensagens = [];
    const lembrados = [];

    for (const usuario of usuarios) {
        if (avisados.has(usuario.id)) { diagnostico.jaAvisados += 1; continue; }
        if (!usuario.irmao) continue;

        const compromissos = await MinhasDesignacoesService.listarPorIrmao(usuario.irmao);
        // Quadro em rascunho ainda muda de mao ate ser publicado; avisar sobre designacao que
        // pode sumir e pior do que nao avisar.
        const doDia = compromissos.filter(
            c => c.dataISO === dia && c.origem && c.origem.status === 'publicado'
        );

        // Sem nada no dia, silencio: notificacao vazia so ensina o irmao a ignorar o app.
        if (doDia.length === 0) { diagnostico.semCompromisso += 1; continue; }

        const body = montarCorpo(doDia, dia);
        // Um irmao pode ter mais de um aparelho, e cada token e um destino separado.
        for (const { token } of usuario.pushTokens) {
            mensagens.push({
                to: token,
                title: 'Suas designações de amanhã',
                body,
                // `screen` e o que faz o toque abrir a aba certa em vez de so a home.
                data: { screen: 'minhas', dataISO: dia },
            });
        }
        lembrados.push(usuario.id);
    }

    if (mensagens.length === 0) {
        console.log(`[lembretes] ${dia}: ninguem tem designacao publicada nesse dia.`);
        return { data: dia, usuarios: 0, enviados: 0, falhas: 0, diagnostico };
    }

    const resultado = await ExpoPushService.enviar(mensagens);

    // Marca depois do envio, e por usuario (nao por token): a trava e "essa pessoa ja foi
    // avisada desse dia". skipDuplicates protege de dois disparos concorrentes.
    if (usarTrava) {
        await prisma.lembreteEnviado.createMany({
            data: lembrados.map(usuarioId => ({ usuarioId, dataISO: dia })),
            skipDuplicates: true,
        });
    }

    const resumo = {
        data: dia,
        usuarios: lembrados.length,
        enviados: resultado.enviados,
        falhas: resultado.falhas,
        diagnostico,
    };
    console.log(
        `[lembretes] ${dia}: ${resumo.usuarios} irmao(s), ` +
        `${resumo.enviados} push enviado(s), ${resumo.falhas} falha(s), ` +
        `${resultado.removidos} token(s) removido(s).`
    );
    return resumo;
}

/** O disparo das 19h: amanha, congregacao inteira, com a trava ligada. */
async function enviarLembretesDeAmanha() {
    return enviarLembretes({ dataISO: dataDeAmanhaEmBahia(), usarTrava: true });
}

module.exports = {
    enviarLembretes,
    enviarLembretesDeAmanha,
    dataDeAmanhaEmBahia,
    dataDeHojeEmBahia,
    _internos: { montarCorpo, diaMes },
};
