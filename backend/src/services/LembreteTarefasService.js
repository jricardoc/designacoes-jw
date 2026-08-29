'use strict';

const prisma = require('../prisma');
const ExpoPushService = require('./ExpoPushService');
const TarefasService = require('./TarefasService');
const Regras = require('./RegrasTarefas');
const RegrasLembrete = require('./RegrasLembrete');

/**
 * Os lembretes das TAREFAS — o outro lado do agendador.
 *
 * LembreteDesignacoesService avisa o irmao do que ele vai FAZER na reuniao (ler, orar, operar
 * o som). Este avisa do que ele tem de fazer PARA a reuniao acontecer: mandar o link, montar o
 * quadro, fazer as confirmacoes. Sao dois publicos e dois calendarios — o primeiro sai da
 * designacao, o segundo do prazo da tarefa —, e por isso sao dois servicos e nao um `if`
 * dentro do outro.
 *
 * O que os dois COMPARTILHAM e a trava: `LembreteEnviado`, com a `regra` prefixada por
 * "tarefa:". Sem uma trava, o tique de 15 em 15 minutos mandaria o mesmo push quatro vezes por
 * hora, e um restart de container recomecaria a conta.
 */

/** Quanto tempo depois do instante certo um disparo atrasado ainda vale. Igual ao dos lembretes. */
const GRACA_MS = 6 * 60 * 60 * 1000;

/** A chave da trava. O id do aviso entra porque uma tarefa avisa mais de uma vez no mesmo dia. */
function chaveDaRegra(tipoId, avisoId) {
    return `tarefa:${tipoId}:${avisoId}`;
}

/**
 * Percorre os irmaos com aparelho e despacha os avisos de tarefa que venceram AGORA.
 *
 * O contexto das tarefas e carregado UMA vez e reaproveitado por todos: ele so depende da
 * programacao e dos quadros, nao de quem esta olhando. Sem isso, cada irmao custaria uma
 * releitura da programacao inteira a cada 15 minutos.
 *
 * Parametros (mesmo espirito de LembreteDesignacoesService.processarLembretes):
 *   `usuarioIds`   limita o publico, para uma conferencia nao virar push na congregacao.
 *   `usarTrava`    desliga a idempotencia E o registro dela (um teste nao pode consumir a
 *                  trava do dia real).
 *   `exigirJanela` so o agendador liga; sem ela o teste teria de cair no minuto exato.
 */
async function processarTarefas({
    usuarioIds = null,
    usarTrava = true,
    exigirJanela = true,
    agora = new Date(),
} = {}) {
    const agoraCong = RegrasLembrete.relogioDaCongregacao(agora);

    const usuarios = await prisma.usuario.findMany({
        where: {
            pushTokens: { some: {} },
            ...(usuarioIds ? { id: { in: usuarioIds } } : {}),
        },
        select: {
            id: true,
            irmaoId: true,
            pushTokens: { select: { token: true } },
            tarefas: { select: { tipo: true } },
            tarefasConcluidas: { select: { tipo: true, ocorrencia: true } },
        },
    });

    const diagnostico = { comAparelho: usuarios.length, semTarefa: 0, foraDaJanela: 0, jaAvisados: 0 };
    if (usuarios.length === 0) return { enviados: 0, falhas: 0, avisos: 0, diagnostico };

    const contexto = await TarefasService.carregarContexto(agora);

    // Uma leitura so da trava, para todos os usuarios em jogo. O recorte por prefixo evita
    // trazer os lembretes de designacao, que sao a maioria das linhas da tabela.
    let travados = new Set();
    if (usarTrava) {
        const jaAvisados = await prisma.lembreteEnviado.findMany({
            where: { usuarioId: { in: usuarios.map(u => u.id) }, regra: { startsWith: 'tarefa:' } },
            select: { usuarioId: true, dataISO: true, regra: true },
        });
        travados = new Set(jaAvisados.map(l => `${l.usuarioId}|${l.dataISO}|${l.regra}`));
    }

    const mensagens = [];
    const marcar = [];
    const avisados = new Set();

    for (const usuario of usuarios) {
        const grupo = TarefasService.grupoDoUsuario(usuario, contexto.grupos);

        const tarefas = TarefasService.montarParaUsuario({
            contexto,
            designadas: usuario.tarefas.map(t => t.tipo),
            concluidas: new Set(usuario.tarefasConcluidas.map(c => `${c.tipo}|${c.ocorrencia}`)),
            grupoId: grupo?.id ?? null,
        });

        if (tarefas.length === 0) { diagnostico.semTarefa += 1; continue; }

        for (const tarefa of tarefas) {
            const tipo = Regras.tipoPorId(tarefa.tipo);
            if (!tipo) continue;

            for (const aviso of Regras.avisosDe(tarefa.tipo)) {
                const alvo = Regras.instanteDoAviso(aviso, {
                    alvoISO: tarefa.ocorrencia,
                    vencimentoISO: tarefa.vencimentoISO,
                });
                if (!alvo) continue;

                if (exigirJanela && !RegrasLembrete.estaVencida(alvo, agoraCong, GRACA_MS)) {
                    diagnostico.foraDaJanela += 1;
                    continue;
                }

                const regra = chaveDaRegra(tarefa.tipo, aviso.id);
                if (usarTrava && travados.has(`${usuario.id}|${tarefa.ocorrencia}|${regra}`)) {
                    diagnostico.jaAvisados += 1;
                    continue;
                }

                const { titulo, corpo } = Regras.textoDoAviso(tipo, aviso, {
                    alvoISO: tarefa.ocorrencia,
                    vencimentoISO: tarefa.vencimentoISO,
                    referencia: tarefa.referencia,
                });

                // Copia para a central do app, criada ANTES do envio para o id viajar no
                // payload — mesma ordem (e mesmo motivo) de LembreteDesignacoesService.
                let notifId = null;
                try {
                    const registro = await prisma.notificacaoEnviada.create({
                        data: {
                            usuarioId: usuario.id,
                            titulo,
                            corpo,
                            data: { screen: 'minhas', tarefa: tarefa.tipo, ocorrencia: tarefa.ocorrencia },
                        },
                    });
                    notifId = registro.id;
                } catch (erro) {
                    console.error('[tarefas] Nao gravei o historico da notificacao:', erro.message);
                }

                for (const { token } of usuario.pushTokens) {
                    mensagens.push({
                        to: token,
                        title: titulo,
                        body: corpo,
                        data: {
                            screen: 'minhas',
                            tarefa: tarefa.tipo,
                            ocorrencia: tarefa.ocorrencia,
                            ...(notifId ? { notifId } : {}),
                        },
                    });
                }

                marcar.push({ usuarioId: usuario.id, dataISO: tarefa.ocorrencia, regra });
                avisados.add(usuario.id);
            }
        }
    }

    if (mensagens.length === 0) {
        return { enviados: 0, falhas: 0, avisos: 0, usuarios: 0, diagnostico };
    }

    const resultado = await ExpoPushService.enviar(mensagens);

    if (usarTrava) {
        await prisma.lembreteEnviado.createMany({ data: marcar, skipDuplicates: true });
    }

    console.log(
        `[tarefas] ${marcar.length} aviso(s) para ${avisados.size} irmao(s), ` +
        `${resultado.enviados} push enviado(s), ${resultado.falhas} falha(s).`
    );

    return {
        avisos: marcar.length,
        usuarios: avisados.size,
        enviados: resultado.enviados,
        falhas: resultado.falhas,
        diagnostico,
    };
}

/** O tique do agendador. */
async function processarTick(agora = new Date()) {
    return processarTarefas({ usarTrava: true, exigirJanela: true, agora });
}

/**
 * O empurrãozinho que o admin dispara do painel, agora.
 *
 * NAO passa pela trava nem pela janela: e uma cobranca deliberada, feita por gente olhando a
 * tela, e nao um disparo automatico. Travar seria pior do que repetir — o admin que tocou duas
 * vezes queria mesmo insistir.
 *
 * Recusa o que nao esta pendente de verdade. Cobrar uma tarefa que o irmao ja cumpriu (ou que
 * nem e dele) e o tipo de erro que faz a congregacao parar de confiar no aviso.
 */
async function lembrarAgora({ usuarioId, tipo, ocorrencia, agora = new Date() }) {
    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
            id: true,
            nome: true,
            irmaoId: true,
            pushTokens: { select: { token: true } },
            tarefas: { select: { tipo: true } },
            tarefasConcluidas: { select: { tipo: true, ocorrencia: true } },
        },
    });
    if (!usuario) return { ok: false, motivo: 'USUARIO_NAO_ENCONTRADO' };
    if (usuario.pushTokens.length === 0) return { ok: false, motivo: 'SEM_APARELHO' };

    const contexto = await TarefasService.carregarContexto(agora);
    const grupo = TarefasService.grupoDoUsuario(usuario, contexto.grupos);

    const pendentes = TarefasService.montarParaUsuario({
        contexto,
        designadas: usuario.tarefas.map(t => t.tipo),
        concluidas: new Set(usuario.tarefasConcluidas.map(c => `${c.tipo}|${c.ocorrencia}`)),
        grupoId: grupo?.id ?? null,
    });

    const tarefa = pendentes.find(t => t.tipo === tipo && t.ocorrencia === ocorrencia);
    if (!tarefa) return { ok: false, motivo: 'NAO_PENDENTE' };

    const titulo = `Lembrete: ${tarefa.label}`;
    const corpo = `${tarefa.titulo} — ${tarefa.prazo.toLowerCase()}.`;

    let notifId = null;
    try {
        const registro = await prisma.notificacaoEnviada.create({
            data: {
                usuarioId: usuario.id,
                titulo,
                corpo,
                data: { screen: 'minhas', tarefa: tarefa.tipo, ocorrencia: tarefa.ocorrencia },
            },
        });
        notifId = registro.id;
    } catch (erro) {
        console.error('[tarefas] Nao gravei o historico do lembrete manual:', erro.message);
    }

    const resultado = await ExpoPushService.enviar(
        usuario.pushTokens.map(({ token }) => ({
            to: token,
            title: titulo,
            body: corpo,
            data: {
                screen: 'minhas',
                tarefa: tarefa.tipo,
                ocorrencia: tarefa.ocorrencia,
                ...(notifId ? { notifId } : {}),
            },
        })),
    );

    return { ok: true, enviados: resultado.enviados, falhas: resultado.falhas, nome: usuario.nome };
}

module.exports = {
    processarTarefas,
    processarTick,
    lembrarAgora,
    GRACA_MS,
    _internos: { chaveDaRegra },
};
