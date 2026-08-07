'use strict';

const prisma = require('../prisma');
const MinhasDesignacoesService = require('./MinhasDesignacoesService');
const ExpoPushService = require('./ExpoPushService');
const RegrasLembrete = require('./RegrasLembrete');

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
 * Recado extra por funcao mecanica, pedido pela congregacao.
 *
 * A busca e por PEDACO do titulo normalizado porque o mesmo compromisso chega com dois
 * vocabularios: o quadro grava "Audio e Video" / "Estacionamento" e a programacao importada
 * usa "Áudio e vídeo" / "Portão / estacionamento". Comparar por igualdade exata deixaria
 * metade dos irmaos sem o recado, e sem erro nenhum para denunciar isso.
 */
const AVISOS_POR_FUNCAO = [
    {
        chave: 'indicador',
        texto: 'Se esforce para chegar mais cedo e receber os irmãos. Obrigado pelo apoio!',
    },
    {
        chave: 'audio e video',
        texto: 'Se esforce para chegar mais cedo e lembre-se de ligar os aparelhos, ' +
            'abrir o zoom e ativar a enquete. Obrigado!',
    },
    {
        chave: 'estacionamento',
        texto: 'Se esforce para chegar mais cedo e apoiar o estacionamento. ' +
            'Obrigado pelo seu apoio!',
    },
];

const semAcento = (valor) =>
    String(valor ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Recados das funcoes que o irmao tem no dia, sem repetir (ele pode servir na mesma duas vezes). */
function avisosDosItens(itens) {
    const textos = [];
    for (const item of itens) {
        const titulo = semAcento(item.titulo);
        for (const { chave, texto } of AVISOS_POR_FUNCAO) {
            if (titulo.includes(chave) && !textos.includes(texto)) textos.push(texto);
        }
    }
    return textos;
}

/**
 * "Leitura da Bíblia - amanhã, 05/08" ou "Leitura da Bíblia e mais 2 - amanhã, 05/08",
 * seguido do recado da funcao quando houver.
 *
 * O "amanhã" sai da regra de antecedencia: com o irmao podendo pedir "1 semana antes", uma
 * palavra fixa aqui faria o lembrete mentir a data. O padrao '1d' mantem o texto que a
 * congregacao ja conhece.
 *
 * O corpo do push e cortado pelo sistema operacional em poucas linhas; citar so o primeiro
 * item (os compromissos ja vem ordenados) e contar o resto cabe sempre. O recado vem DEPOIS
 * por isso: se algo for cortado na previa, que seja ele e nao a designacao.
 */
function montarCorpo(itens, dataISO, regraId = '1d') {
    const regra = RegrasLembrete.regraPorId(regraId) || RegrasLembrete.regraPorId('1d');
    const quando = `${regra.quando}, ${diaMes(dataISO)}`;
    const linha = itens.length === 1
        ? `${itens[0].titulo} - ${quando}`
        : `${itens[0].titulo} e mais ${itens.length - 1} - ${quando}`;

    const avisos = avisosDosItens(itens);
    return avisos.length > 0 ? `${linha}\n\n${avisos.join('\n\n')}` : linha;
}

/** Quanto tempo depois do instante certo um disparo atrasado ainda vale (ver estaVencida). */
const GRACA_MS = 6 * 60 * 60 * 1000;

/**
 * Percorre os irmaos e despacha os lembretes que estao vencidos AGORA.
 *
 * Um unico laco por usuario, com uma leitura so de compromissos, avaliando todas as regras
 * dele: o agendador roda de 15 em 15 minutos, e uma consulta por regra multiplicaria por
 * cinco a carga no banco sem necessidade.
 *
 * Parametros:
 *   `usuarioIds`       limita o publico (a rota de teste manda so para quem pediu, para uma
 *                      conferencia nao virar push na congregacao inteira).
 *   `usarTrava`        desliga a idempotencia E o registro dela: um teste nao pode consumir a
 *                      trava do dia, senao o disparo real seria pulado.
 *   `regras`           forca um conjunto de regras (o teste usa '1d'); null = as do irmao.
 *   `dataISOForcada`   forca o dia (o teste escolhe a data); null = o dia que cada regra pede.
 *   `exigirJanela`     so o agendador liga: sem isso o teste teria de cair no minuto exato.
 *   `exigirPreferencia` so o agendador liga: o teste manda mesmo para quem desligou tudo.
 *
 * `diagnostico` existe para o teste conseguir dizer POR QUE nada saiu — sem ele, "0 enviados"
 * e indistinguivel entre "ninguem tem token", "ninguem tem designacao" e "quadro em rascunho".
 */
async function processarLembretes({
    usuarioIds = null,
    usarTrava = true,
    regras = null,
    dataISOForcada = null,
    exigirJanela = false,
    exigirPreferencia = false,
    agora = new Date(),
} = {}) {
    const hoje = dataDeHojeEmBahia(agora);
    const agoraCong = RegrasLembrete.relogioDaCongregacao(agora);

    const usuarios = await prisma.usuario.findMany({
        where: {
            irmaoId: { not: null },
            pushTokens: { some: {} },
            ...(usuarioIds ? { id: { in: usuarioIds } } : {}),
        },
        include: { irmao: true, pushTokens: true, prefNotificacao: true },
    });

    const diagnostico = {
        comAparelho: usuarios.length,
        semCompromisso: 0,
        jaAvisados: 0,
        foraDaJanela: 0,
        tipoDesligado: 0,
    };

    if (usuarios.length === 0) {
        console.log('[lembretes] nenhum usuario com aparelho registrado.');
        return { data: dataISOForcada || hoje, usuarios: 0, enviados: 0, falhas: 0, diagnostico };
    }

    const config = await prisma.config.findFirst();

    // Uma leitura so da trava, para todos os usuarios e dias em jogo.
    let travados = new Set();
    if (usarTrava) {
        const jaAvisados = await prisma.lembreteEnviado.findMany({
            where: { usuarioId: { in: usuarios.map(u => u.id) } },
            select: { usuarioId: true, dataISO: true, regra: true },
        });
        travados = new Set(jaAvisados.map(l => `${l.usuarioId}|${l.dataISO}|${l.regra}`));
    }

    const mensagens = [];
    const marcar = [];
    const lembrados = new Set();
    let dataDoResumo = dataISOForcada || hoje;

    for (const usuario of usuarios) {
        if (!usuario.irmao) continue;

        const pref = RegrasLembrete.normalizarPreferencia(
            usuario.prefNotificacao || RegrasLembrete.PADRAO
        );
        const idsRegras = regras || pref.antecedencias;
        if (idsRegras.length === 0) continue;

        const compromissos = await MinhasDesignacoesService.listarPorIrmao(usuario.irmao);

        for (const idRegra of idsRegras) {
            const regra = RegrasLembrete.regraPorId(idRegra);
            if (!regra) continue;
            if (exigirPreferencia && !pref.antecedencias.includes(idRegra)) continue;

            const dia = dataISOForcada || RegrasLembrete.diaAlvo(hoje, regra);

            // Quadro em rascunho ainda muda de mao ate ser publicado; avisar sobre designacao
            // que pode sumir e pior do que nao avisar.
            const doDia = compromissos.filter(
                c => c.dataISO === dia && c.origem && c.origem.status === 'publicado'
            );
            if (doDia.length === 0) { diagnostico.semCompromisso += 1; continue; }

            // O filtro por tipo vem DEPOIS do corte por dia para o diagnostico separar
            // "nao tem nada nesse dia" de "tem, mas ele desligou esse tipo".
            const doTipo = exigirPreferencia
                ? doDia.filter(c => pref.tipos.includes(c.tipo))
                : doDia;
            if (doTipo.length === 0) { diagnostico.tipoDesligado += 1; continue; }

            if (exigirJanela) {
                const alvo = RegrasLembrete.instanteDoDisparo(dia, regra, doTipo, config);
                if (!RegrasLembrete.estaVencida(alvo, agoraCong, GRACA_MS)) {
                    diagnostico.foraDaJanela += 1;
                    continue;
                }
            }

            if (usarTrava && travados.has(`${usuario.id}|${dia}|${idRegra}`)) {
                diagnostico.jaAvisados += 1;
                continue;
            }

            const body = montarCorpo(doTipo, dia, idRegra);

            // Copia do aviso para a central do app, criada ANTES do envio para o id
            // viajar no payload. Se o push falhar depois, sobra um registro de algo
            // que nao chegou — preferivel ao contrario (aviso entregue sem registro,
            // que era exatamente o bug da central vazia).
            let notifId = null;
            try {
                const registro = await prisma.notificacaoEnviada.create({
                    data: {
                        usuarioId: usuario.id,
                        titulo: regra.titulo,
                        corpo: body,
                        data: { screen: 'minhas', dataISO: dia, regra: idRegra },
                    },
                });
                notifId = registro.id;
            } catch (erro) {
                // Sem a copia o push continua valendo: a central perde este item,
                // o lembrete nao.
                console.error('[lembretes] Nao gravei o historico da notificacao:', erro.message);
            }

            // Um irmao pode ter mais de um aparelho, e cada token e um destino separado.
            for (const { token } of usuario.pushTokens) {
                mensagens.push({
                    to: token,
                    title: regra.titulo,
                    body,
                    // `screen` e o que faz o toque abrir a aba certa em vez de so a home.
                    data: {
                        screen: 'minhas',
                        dataISO: dia,
                        regra: idRegra,
                        ...(notifId ? { notifId } : {}),
                    },
                });
            }
            marcar.push({ usuarioId: usuario.id, dataISO: dia, regra: idRegra });
            lembrados.add(usuario.id);
            dataDoResumo = dia;
        }
    }

    if (mensagens.length === 0) {
        return { data: dataDoResumo, usuarios: 0, enviados: 0, falhas: 0, diagnostico };
    }

    const resultado = await ExpoPushService.enviar(mensagens);

    // Marca depois do envio. skipDuplicates protege de dois disparos concorrentes.
    if (usarTrava) {
        await prisma.lembreteEnviado.createMany({ data: marcar, skipDuplicates: true });
    }

    const resumo = {
        data: dataDoResumo,
        usuarios: lembrados.size,
        enviados: resultado.enviados,
        falhas: resultado.falhas,
        diagnostico,
    };
    console.log(
        `[lembretes] ${marcar.length} lembrete(s) para ${resumo.usuarios} irmao(s), ` +
        `${resumo.enviados} push enviado(s), ${resumo.falhas} falha(s), ` +
        `${resultado.removidos} token(s) removido(s).`
    );
    return resumo;
}

/**
 * A rota de teste: um dia escolhido, regra '1d', sem janela, sem trava e sem respeitar a
 * preferencia — quem pede um teste quer ver o push chegar, nao descobrir que se auto-silenciou.
 */
async function enviarLembretes({ dataISO, usuarioIds = null, usarTrava = true } = {}) {
    return processarLembretes({
        dataISOForcada: dataISO || dataDeAmanhaEmBahia(),
        regras: ['1d'],
        usuarioIds,
        usarTrava,
        exigirJanela: false,
        exigirPreferencia: false,
    });
}

/** O tique do agendador: cada irmao com as regras dele, so o que venceu agora. */
async function processarTick(agora = new Date()) {
    return processarLembretes({
        usarTrava: true,
        exigirJanela: true,
        exigirPreferencia: true,
        agora,
    });
}

module.exports = {
    enviarLembretes,
    processarLembretes,
    processarTick,
    dataDeAmanhaEmBahia,
    dataDeHojeEmBahia,
    _internos: { montarCorpo, diaMes, GRACA_MS },
};
