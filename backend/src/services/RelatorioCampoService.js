'use strict';

const prisma = require('../prisma');
const { relogioDaCongregacao } = require('./RegrasLembrete');
const { rotuloDoGrupo } = require('./DivisaoGruposService');
const { linkWhatsApp } = require('./ConfirmacaoDesignacaoService')._internos;

/**
 * Os grupos de campo e o relatorio de servico de campo.
 *
 * Quem ve: o dirigente e o ajudante, so o proprio grupo; o admin geral e o secretario (o
 * irmao escolhido em Config.secretarioIrmaoId), todos. No comeco de cada mes o dirigente pede o relatorio do
 * mes anterior, anota o de cada irmao e, quando o grupo inteiro entregou, o secretario e
 * avisado. Com todos os grupos, o relatorio da congregacao fica pronto na propria tela.
 *
 * As regras puras ficam no topo (testadas em scripts/verificarRelatorioCampo.js).
 */

const MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * O primeiro mes pedido pelo app (o de outubro, pedido em novembro de 2026). Os anteriores ja
 * foram entregues no papel: sem isto, todo dirigente abriria o app com setembro "atrasado".
 */
const PRIMEIRO_MES = '2026-10';

/** Dia do mes a partir do qual o pedido do relatorio passa a estar atrasado. */
const DIA_LIMITE = 10;
/** Hora (no relogio da congregacao) do lembrete do dia 1. */
const HORA_DO_LEMBRETE = 9;

// ---------------------------------------------------------------------------
// Regras puras
// ---------------------------------------------------------------------------

const ehMes = (mes) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ''));

/** "2026-11-03" -> "2026-10": no comeco do mes se pede o relatorio do mes que passou. */
function mesDeReferencia(hojeISO) {
    const [ano, mes] = String(hojeISO).split('-').map(Number);
    const total = ano * 12 + (mes - 1) - 1;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** "2026-10" -> "outubro de 2026" (curto: "outubro"). */
function nomeDoMes(mes, curto = false) {
    const [ano, numero] = String(mes).split('-').map(Number);
    const nome = MESES[numero - 1] || mes;
    return curto ? nome : `${nome} de ${ano}`;
}

/**
 * O relatorio que o dirigente anotou, limpo e conferido. Pioneiro (regular pelo cadastro ou
 * auxiliar marcado no mes) relata horas e estudos e conta como quem participou; publicador
 * relata se participou e quantos estudos. Devolve { relatorio } ou { erro }.
 */
function normalizarRelatorio(corpo, { pioneiroRegular }) {
    const c = corpo || {};
    const pioneiroAuxiliar = !pioneiroRegular && c.pioneiroAuxiliar === true;
    const pioneiro = pioneiroRegular || pioneiroAuxiliar;
    const estudos = Math.round(Number(c.estudos) || 0);
    if (estudos < 0 || estudos > 100) return { erro: 'Estudos bíblicos: informe um número entre 0 e 100.' };

    let horas = null;
    if (pioneiro) {
        horas = Math.round(Number(c.horas));
        if (!Number.isFinite(horas) || horas < 0 || horas > 400) return { erro: 'Horas: informe um número entre 0 e 400.' };
    } else if (typeof c.participou !== 'boolean') {
        return { erro: 'Diga se o irmão participou no ministério.' };
    }
    const participou = pioneiro ? horas > 0 || c.participou === true : c.participou;
    const observacao = String(c.observacao || '').trim().slice(0, 300) || null;
    return {
        relatorio: {
            participou,
            // Quem nao participou nao tem estudo no relatorio: o S-1 so conta os de quem relatou.
            estudos: participou ? estudos : 0,
            horas,
            pioneiroAuxiliar,
            pioneiroRegular: !!pioneiroRegular,
            observacao,
        },
    };
}

/**
 * O relatorio da congregacao (como no S-1): publicadores que participaram e os estudos deles;
 * auxiliares e regulares com quantidade, horas e estudos; e quem nao participou.
 */
function resumir(relatorios) {
    const vazio = () => ({ quantidade: 0, horas: 0, estudos: 0 });
    const r = { publicadores: vazio(), auxiliares: vazio(), regulares: vazio(), naoParticiparam: 0, entregues: relatorios.length };
    for (const rel of relatorios) {
        const alvo = rel.pioneiroRegular ? r.regulares : rel.pioneiroAuxiliar ? r.auxiliares : rel.participou ? r.publicadores : null;
        if (!alvo) {
            r.naoParticiparam += 1;
            continue;
        }
        alvo.quantidade += 1;
        alvo.estudos += rel.estudos || 0;
        if (rel.pioneiroRegular || rel.pioneiroAuxiliar) alvo.horas += rel.horas || 0;
    }
    delete r.publicadores.horas;
    return r;
}

/**
 * A mensagem pronta para pedir o relatorio no WhatsApp: no grupo (sem `nome`) ou a um irmao,
 * e para ele so o que ele relata (`pioneiro`: horas; publicador: se participou).
 */
function textoDoPedido({ grupo, mes, nome, pioneiro }) {
    const doMes = `*${nomeDoMes(mes, true)}*`;
    if (nome) {
        return [
            `Olá, ${nome.split(/\s+/)[0]}!`,
            `Já pode me passar o seu relatório de ${doMes}?`,
            pioneiro
                ? 'Quantas horas e quantos estudos bíblicos.'
                : 'Se participou no ministério (sim ou não) e quantos estudos bíblicos.',
            '',
            'Obrigado!',
        ].join('\n');
    }
    return [
        `Olá, irmãos do ${String(grupo).replace(/^Grupo/, 'grupo')}!`,
        `Já podem me passar o relatório de ${doMes}?`,
        '',
        '• Publicadores: se participou no ministério (sim ou não) e quantos estudos bíblicos.',
        '• Pioneiros: quantas horas e quantos estudos bíblicos.',
        '',
        'Obrigado!',
    ].join('\n');
}

/** O intervalo de datas (ISO) de cada filtro da tela: este mes, 3 meses ou o ano de servico. */
function periodo(nome, hojeISO) {
    const [ano, mes] = String(hojeISO).split('-').map(Number);
    const primeiroDia = (a, m) => `${a}-${String(m).padStart(2, '0')}-01`;
    if (nome === 'mes') return { inicioISO: primeiroDia(ano, mes), fimISO: hojeISO };
    if (nome === 'ano') {
        // Ano de servico: de setembro a agosto.
        return { inicioISO: primeiroDia(mes >= 9 ? ano : ano - 1, 9), fimISO: hojeISO };
    }
    const total = ano * 12 + (mes - 1) - 2;
    return { inicioISO: primeiroDia(Math.floor(total / 12), (total % 12) + 1), fimISO: hojeISO };
}

/** "2026-10" + 2 -> "2026-12" */
function somarMeses(mes, delta) {
    const [ano, numero] = String(mes).split('-').map(Number);
    const total = ano * 12 + (numero - 1) + delta;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Os ultimos `n` meses de relatorio de um irmao, do mais antigo ao mais novo, ate `ate`. Antes
 * do primeiro mes do app o relatorio foi no papel: `antesDoApp`, e nao "sem relatorio".
 */
function historicoDeRelatorios(relatorios, ate, n = 12) {
    const meses = Array.from({ length: n }, (_, i) => somarMeses(ate, i - n + 1)).map((mes) => {
        const r = relatorios.find((x) => x.mes === mes);
        return {
            mes,
            nome: nomeDoMes(mes, true),
            antesDoApp: mes < PRIMEIRO_MES,
            relatorio: r
                ? { participou: r.participou, estudos: r.estudos, horas: r.horas, pioneiroAuxiliar: r.pioneiroAuxiliar, pioneiroRegular: r.pioneiroRegular }
                : null,
        };
    });
    const doApp = meses.filter((m) => !m.antesDoApp);
    return {
        meses,
        mesesNoApp: doApp.length,
        comRelatorio: doApp.filter((m) => m.relatorio).length,
        participou: doApp.filter((m) => m.relatorio && m.relatorio.participou).length,
    };
}

/** "16/10/2026" -> "2026-10-16" (null se ilegivel). */
function isoDeBR(data) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(data || ''));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * O que o irmao fez no periodo: designacoes do quadro (mecanicas), partes da reuniao, saidas
 * como dirigente e reunioes assistidas pelo Zoom. So o que ja aconteceu conta.
 */
function estatisticas(compromissos, datasZoom, { inicioISO, fimISO }) {
    const dentro = (iso) => !!iso && iso >= inicioISO && iso <= fimISO;
    const doTipo = (tipo) => compromissos.filter((c) => c.tipo === tipo && dentro(c.dataISO));
    const e = {
        mecanicas: doTipo('designacao').length,
        reuniao: doTipo('reuniao').length,
        // Por dia: a mesma saida aparece na escala de dirigentes e no territorio designado.
        dirigente: new Set(doTipo('dirigente').map((c) => c.dataISO)).size,
        zoom: datasZoom.filter(dentro).length,
    };
    return { ...e, designacoes: e.mecanicas + e.reuniao + e.dirigente };
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

const hojeISO = (agora = new Date()) => relogioDaCongregacao(agora).toISOString().slice(0, 10);

/** O irmao secretario, ou null. Um so: e ele quem junta o relatorio da congregacao. */
async function secretarioIrmaoId() {
    const c = await prisma.config.findFirst({ select: { secretarioIrmaoId: true } });
    return (c && c.secretarioIrmaoId) || null;
}

/** Admin geral ou o secretario: veem todos os grupos e o total da congregacao. */
async function veTodos(usuario) {
    if (!usuario) return false;
    if (usuario.isAdmin) return true;
    const sec = await secretarioIrmaoId();
    return !!sec && usuario.irmaoId === sec;
}

/** Os ids dos grupos que o irmao do usuario dirige ou ajuda. */
async function gruposQueLidera(irmaoId) {
    if (!irmaoId) return [];
    const grupos = await prisma.grupoCampo.findMany({
        where: { ativo: true, OR: [{ dirigenteId: irmaoId }, { ajudanteId: irmaoId }] },
        select: { id: true },
    });
    return grupos.map((g) => g.id);
}

const GRUPO_SELECT = {
    id: true,
    nome: true,
    numero: true,
    local: true,
    dirigente: { select: { id: true, nome: true } },
    ajudante: { select: { id: true, nome: true } },
    publicadores: {
        where: { ativo: true },
        select: { id: true, nome: true, pioneiro: true, privilegio: true, telefone: true, genero: true },
        orderBy: { nome: 'asc' },
    },
};

function cabecalho(g) {
    return {
        id: g.id,
        rotulo: rotuloDoGrupo(g.dirigente && g.dirigente.nome, g.nome),
        nome: g.nome,
        numero: g.numero,
        local: g.local,
        dirigente: g.dirigente,
        ajudante: g.ajudante,
    };
}

/**
 * A lista de grupos que o usuario pode abrir, com o andamento do relatorio do mes.
 * `soOsMeus`: so os que ele lidera, mesmo sendo admin ou secretario (a tarefa de pedir).
 */
async function painel(usuario, mesPedido, { soOsMeus = false } = {}) {
    const mes = ehMes(mesPedido) ? mesPedido : mesDeReferencia(hojeISO());
    const todos = !soOsMeus && (await veTodos(usuario));
    const meus = todos ? null : await gruposQueLidera(usuario.irmaoId);
    const grupos = await prisma.grupoCampo.findMany({
        where: { ativo: true, ...(todos ? {} : { id: { in: meus } }) },
        select: { ...GRUPO_SELECT, relatoriosConcluidos: { where: { mes }, select: { concluidoEm: true } } },
        orderBy: [{ numero: 'asc' }, { ordem: 'asc' }, { nome: 'asc' }],
    });
    const ids = grupos.flatMap((g) => g.publicadores.map((p) => p.id));
    const entregues = new Set(
        (await prisma.relatorioCampo.findMany({ where: { mes, irmaoId: { in: ids } }, select: { irmaoId: true } })).map((r) => r.irmaoId),
    );
    const sec = todos ? await secretarioIrmaoId() : null;
    return {
        mes,
        nomeMes: nomeDoMes(mes),
        veTodos: todos,
        // Para o admin ver (e trocar) quem e o secretario.
        secretario: sec ? await prisma.irmao.findUnique({ where: { id: sec }, select: { id: true, nome: true } }) : null,
        // O pedido do mes esta valendo (a tarefa e o aviso da tela).
        pedir: mes === mesDeReferencia(hojeISO()) && mes >= PRIMEIRO_MES,
        grupos: grupos.map((g) => ({
            ...cabecalho(g),
            membros: g.publicadores.length,
            entregues: g.publicadores.filter((p) => entregues.has(p.id)).length,
            concluidoEm: g.relatoriosConcluidos[0] ? g.relatoriosConcluidos[0].concluidoEm : null,
        })),
    };
}

/** Pode mexer neste grupo? (o lider dele, ou quem ve todos) */
async function podeNoGrupo(usuario, grupoId) {
    if (await veTodos(usuario)) return true;
    return (await gruposQueLidera(usuario.irmaoId)).includes(grupoId);
}

/** O grupo com os irmaos, o relatorio do mes de cada um e o que cada um fez no periodo. */
async function detalhe(usuario, grupoId, { mes: mesPedido, periodo: nomePeriodo } = {}) {
    if (!(await podeNoGrupo(usuario, grupoId))) return { erro: 403 };
    const mes = ehMes(mesPedido) ? mesPedido : mesDeReferencia(hojeISO());
    const g = await prisma.grupoCampo.findFirst({
        where: { id: grupoId, ativo: true },
        select: { ...GRUPO_SELECT, relatoriosConcluidos: { where: { mes }, select: { concluidoEm: true } } },
    });
    if (!g) return { erro: 404 };

    const ids = g.publicadores.map((p) => p.id);
    const intervalo = periodo(nomePeriodo === 'mes' || nomePeriodo === 'ano' ? nomePeriodo : '3m', hojeISO());
    const [relatorios, presencas, doRelatorioZoom] = await Promise.all([
        prisma.relatorioCampo.findMany({ where: { mes, irmaoId: { in: ids } } }),
        prisma.presencaZoom.findMany({
            where: { irmaoId: { in: ids } },
            select: { irmaoId: true, assistencia: { select: { data: true } } },
        }),
        // As reunioes do relatorio do Zoom (API ou CSV) contam mesmo sem a lista da assistencia.
        prisma.zoomParticipante.findMany({
            where: { irmaoId: { in: ids }, status: { not: 'in_waiting_room' } },
            select: { irmaoId: true, reuniao: { select: { inicio: true } } },
        }),
    ]);
    const diaDoZoom = (inicio) => (inicio ? relogioDaCongregacao(inicio).toISOString().slice(0, 10) : null);
    const { listarPorIrmao } = require('./MinhasDesignacoesService');
    const compromissos = await Promise.all(g.publicadores.map((p) => listarPorIrmao(p).catch(() => [])));

    const membros = g.publicadores.map((p, i) => ({
        id: p.id,
        nome: p.nome,
        pioneiro: p.pioneiro,
        privilegio: p.privilegio,
        lider: g.dirigente && g.dirigente.id === p.id ? 'dirigente' : g.ajudante && g.ajudante.id === p.id ? 'ajudante' : null,
        relatorio: relatorios.find((r) => r.irmaoId === p.id) || null,
        whatsapp: linkWhatsApp(p.telefone, textoDoPedido({ mes, nome: p.nome, pioneiro: !!p.pioneiro })),
        estatisticas: estatisticas(
            compromissos[i],
            // Um dia por reuniao: a mesma pode estar na lista da assistencia e no relatorio do Zoom.
            [...new Set([
                ...presencas.filter((z) => z.irmaoId === p.id).map((z) => isoDeBR(z.assistencia.data)),
                ...doRelatorioZoom.filter((z) => z.irmaoId === p.id).map((z) => diaDoZoom(z.reuniao.inicio)),
            ])],
            intervalo,
        ),
    }));
    const rotulo = rotuloDoGrupo(g.dirigente && g.dirigente.nome, g.nome);
    return {
        grupo: cabecalho(g),
        mes,
        nomeMes: nomeDoMes(mes),
        periodo: { nome: nomePeriodo || '3m', ...intervalo },
        membros,
        entregues: membros.filter((m) => m.relatorio).length,
        concluidoEm: g.relatoriosConcluidos[0] ? g.relatoriosConcluidos[0].concluidoEm : null,
        textoPedido: textoDoPedido({ grupo: rotulo, mes }),
    };
}

/**
 * A ficha de um irmao do grupo, para o dirigente: relatorios dos ultimos 12 meses, reunioes
 * pelo Zoom, designacoes (proximas, recentes e o total do ano de servico) e o contato.
 */
async function membro(usuario, grupoId, irmaoId) {
    if (!(await podeNoGrupo(usuario, grupoId))) return { erro: 403 };
    const p = await prisma.irmao.findFirst({
        where: { id: irmaoId, grupoId, ativo: true },
        select: { id: true, nome: true, privilegio: true, pioneiro: true, genero: true, telefone: true },
    });
    if (!p) return { erro: 404 };
    const g = await prisma.grupoCampo.findUnique({
        where: { id: grupoId },
        select: { id: true, nome: true, dirigenteId: true, ajudanteId: true, dirigente: { select: { nome: true } } },
    });
    const hoje = hojeISO();
    const mesAtual = hoje.slice(0, 7);
    const anoServico = periodo('ano', hoje);
    const [relatorios, presencas, doRelatorioZoom] = await Promise.all([
        prisma.relatorioCampo.findMany({ where: { irmaoId, mes: { gte: somarMeses(mesAtual, -12), lte: mesAtual } } }),
        prisma.presencaZoom.findMany({ where: { irmaoId }, select: { assistencia: { select: { data: true } } } }),
        prisma.zoomParticipante.findMany({
            where: { irmaoId, status: { not: 'in_waiting_room' } },
            select: { reuniao: { select: { inicio: true } } },
        }),
    ]);
    const umAnoAtras = `${somarMeses(hoje.slice(0, 7), -11)}-01`;
    const datasZoom = [...new Set([
        ...presencas.map((z) => isoDeBR(z.assistencia.data)),
        ...doRelatorioZoom.map((z) => (z.reuniao.inicio ? relogioDaCongregacao(z.reuniao.inicio).toISOString().slice(0, 10) : null)),
    ])]
        .filter((d) => d && d >= umAnoAtras && d <= hoje)
        .sort()
        .reverse();

    const { listarPorIrmao } = require('./MinhasDesignacoesService');
    const compromissos = await listarPorIrmao(p).catch(() => []);
    const curto = (c) => ({ tipo: c.tipo, titulo: c.titulo, detalhe: c.detalhe, papel: c.papel, dataISO: c.dataISO, local: c.local, horario: c.horario });
    // Ate o mes que se pede agora (o anterior), ou o atual se o dirigente ja anotou ele.
    const ate = relatorios.some((r) => r.mes === mesAtual) ? mesAtual : mesDeReferencia(hoje);
    const historico = historicoDeRelatorios(relatorios, ate);
    const doAno = relatorios.filter((r) => r.mes >= anoServico.inicioISO.slice(0, 7));

    return {
        irmao: {
            id: p.id,
            nome: p.nome,
            privilegio: p.privilegio,
            pioneiro: p.pioneiro,
            genero: p.genero,
            telefone: p.telefone || null,
            whatsapp: linkWhatsApp(p.telefone, ''),
        },
        grupo: { id: g.id, rotulo: rotuloDoGrupo(g.dirigente && g.dirigente.nome, g.nome) },
        lider: g.dirigenteId === p.id ? 'dirigente' : g.ajudanteId === p.id ? 'ajudante' : null,
        relatorios: {
            ...historico,
            // So do pioneiro: as horas relatadas no ano de servico.
            horasAnoServico: p.pioneiro === 'regular' ? doAno.reduce((s, r) => s + (r.horas || 0), 0) : null,
        },
        zoom: {
            datas: datasZoom,
            anoServico: datasZoom.filter((d) => d >= anoServico.inicioISO).length,
            ultimos3Meses: datasZoom.filter((d) => d >= periodo('3m', hoje).inicioISO).length,
        },
        designacoes: {
            anoServico: { inicioISO: anoServico.inicioISO, ...estatisticas(compromissos, datasZoom, anoServico) },
            proximas: compromissos.filter((c) => c.dataISO && c.dataISO >= hoje).sort((a, b) => a.dataISO.localeCompare(b.dataISO)).slice(0, 6).map(curto),
            recentes: compromissos.filter((c) => c.dataISO && c.dataISO < hoje).sort((a, b) => b.dataISO.localeCompare(a.dataISO)).slice(0, 8).map(curto),
        },
    };
}

/** Push para uma lista de usuarios, com copia na central de notificacoes de cada um. */
async function enviarPush(usuarios, titulo, corpo, data) {
    const ExpoPushService = require('./ExpoPushService');
    const mensagens = [];
    for (const u of usuarios) {
        const registro = await prisma.notificacaoEnviada.create({ data: { usuarioId: u.id, titulo, corpo, data } });
        for (const { token } of u.pushTokens || []) {
            mensagens.push({ to: token, title: titulo, body: corpo, data: { ...data, notifId: registro.id } });
        }
    }
    if (mensagens.length) await ExpoPushService.enviar(mensagens);
}

/**
 * Se o grupo acabou de entregar o mes inteiro, registra e avisa o secretario (quem tem a area
 * "relatorios"). Quando o ultimo grupo fecha, avisa que o mes da congregacao esta completo.
 */
async function conferirConclusao(grupoId, mes) {
    const g = await prisma.grupoCampo.findUnique({
        where: { id: grupoId },
        select: { id: true, nome: true, ativo: true, dirigente: { select: { nome: true } }, publicadores: { where: { ativo: true }, select: { id: true } } },
    });
    if (!g || !g.ativo || g.publicadores.length === 0) return;
    const entregues = await prisma.relatorioCampo.count({ where: { mes, irmaoId: { in: g.publicadores.map((p) => p.id) } } });
    if (entregues < g.publicadores.length) return;

    const ja = await prisma.relatorioGrupoMes.findUnique({ where: { grupoId_mes: { grupoId, mes } } });
    if (ja) return;
    await prisma.relatorioGrupoMes.create({ data: { grupoId, mes } });

    const sec = await secretarioIrmaoId();
    const secretarios = sec
        ? await prisma.usuario.findMany({ where: { irmaoId: sec }, select: { id: true, pushTokens: { select: { token: true } } } })
        : [];
    if (secretarios.length === 0) return;
    const rotulo = rotuloDoGrupo(g.dirigente && g.dirigente.nome, g.nome);
    const data = { screen: 'grupos', mes };
    await enviarPush(
        secretarios,
        `${rotulo} concluiu o relatório`,
        `Todos os ${g.publicadores.length} irmãos do grupo entregaram o relatório de ${nomeDoMes(mes, true)}.`,
        data,
    );

    const ativos = await prisma.grupoCampo.count({ where: { ativo: true } });
    const concluidos = await prisma.relatorioGrupoMes.count({ where: { mes, grupo: { ativo: true } } });
    if (concluidos >= ativos) {
        await enviarPush(
            secretarios,
            `Relatório de ${nomeDoMes(mes, true)} completo`,
            `Os ${ativos} grupos entregaram. O total da congregação está pronto no app.`,
            data,
        );
    }
}

/** Anota (ou corrige) o relatorio de um irmao num mes. */
async function salvarRelatorio(usuario, corpo) {
    const irmaoId = Number(corpo && corpo.irmaoId);
    const mes = corpo && corpo.mes;
    if (!Number.isInteger(irmaoId) || !ehMes(mes)) return { erro: 400, mensagem: 'Irmão ou mês inválido.' };
    const irmao = await prisma.irmao.findUnique({ where: { id: irmaoId }, select: { id: true, grupoId: true, pioneiro: true } });
    if (!irmao) return { erro: 404, mensagem: 'Irmão não encontrado.' };
    if (!irmao.grupoId || !(await podeNoGrupo(usuario, irmao.grupoId))) {
        return { erro: 403, mensagem: 'Só o dirigente ou o ajudante do grupo podem anotar este relatório.' };
    }
    const { relatorio, erro } = normalizarRelatorio(corpo, { pioneiroRegular: irmao.pioneiro === 'regular' });
    if (erro) return { erro: 400, mensagem: erro };

    const salvo = await prisma.relatorioCampo.upsert({
        where: { irmaoId_mes: { irmaoId, mes } },
        update: { ...relatorio, grupoId: irmao.grupoId, registradoPorId: usuario.id },
        create: { ...relatorio, irmaoId, mes, grupoId: irmao.grupoId, registradoPorId: usuario.id },
    });
    // O aviso nao pode derrubar o salvamento: o relatorio ja esta gravado.
    await conferirConclusao(irmao.grupoId, mes).catch((e) => console.error('[relatorio] aviso de conclusão:', e));
    return { relatorio: salvo };
}

/** Desfaz uma anotacao (anotada no irmao errado, por exemplo). */
async function apagarRelatorio(usuario, id) {
    const rel = await prisma.relatorioCampo.findUnique({ where: { id }, select: { id: true, mes: true, irmao: { select: { grupoId: true } } } });
    if (!rel) return { erro: 404 };
    if (!rel.irmao.grupoId || !(await podeNoGrupo(usuario, rel.irmao.grupoId))) return { erro: 403 };
    await prisma.relatorioCampo.delete({ where: { id } });
    // O grupo deixou de estar completo: some a marca, e o aviso volta a valer quando fechar de novo.
    await prisma.relatorioGrupoMes.deleteMany({ where: { grupoId: rel.irmao.grupoId, mes: rel.mes } });
    return { ok: true };
}

// ---------------------------------------------------------------------------
// O relatorio que o proprio irmao manda ("Registrar o campo", no "+" do app)
// ---------------------------------------------------------------------------

/** Quantos meses para tras o irmao ainda corrige: o do mes que passou e o anterior a ele. */
const MESES_PARA_TRAS = 2;

/** O cadastro ligado a conta, num mes que ainda da para relatar. */
async function irmaoDaConta(usuario, mes) {
    if (!usuario || !usuario.irmaoId) {
        return { erro: 403, mensagem: 'Sua conta não está ligada ao seu cadastro. Fale com o secretário.' };
    }
    const atual = hojeISO().slice(0, 7);
    if (!ehMes(mes) || mes > atual || mes < somarMeses(atual, -MESES_PARA_TRAS)) return { erro: 400, mensagem: 'Mês inválido.' };
    const irmao = await prisma.irmao.findUnique({ where: { id: usuario.irmaoId }, select: { id: true, grupoId: true, pioneiro: true } });
    if (!irmao) return { erro: 404, mensagem: 'Cadastro não encontrado.' };
    return { irmao };
}

/** O relatorio dele no mes (null se ainda nao mandou), para o app abrir ja preenchido. */
async function meuRelatorio(usuario, mes) {
    const r = await irmaoDaConta(usuario, mes);
    if (r.erro) return r;
    const relatorio = await prisma.relatorioCampo.findUnique({
        where: { irmaoId_mes: { irmaoId: r.irmao.id, mes } },
        select: { participou: true, estudos: true, horas: true, pioneiroAuxiliar: true, observacao: true, updatedAt: true },
    });
    return { mes, nomeMes: nomeDoMes(mes), pioneiroRegular: r.irmao.pioneiro === 'regular', relatorio };
}

/**
 * O publicador manda o proprio relatorio: cai no relatorio do grupo, como o que o dirigente
 * anota (e o dirigente ainda pode corrigir). O pioneiro regular manda pelo Ministerio, com as
 * horas lancadas.
 */
async function enviarMeuRelatorio(usuario, corpo) {
    const c = corpo || {};
    const r = await irmaoDaConta(usuario, c.mes);
    if (r.erro) return r;
    const { irmao } = r;
    if (irmao.pioneiro === 'regular') {
        return { erro: 400, mensagem: 'Pioneiro regular manda o relatório pelo Ministério, com as horas lançadas.' };
    }
    const { relatorio, erro } = normalizarRelatorio(c, { pioneiroRegular: false });
    if (erro) return { erro: 400, mensagem: erro };
    const salvo = await prisma.relatorioCampo.upsert({
        where: { irmaoId_mes: { irmaoId: irmao.id, mes: c.mes } },
        update: { ...relatorio, grupoId: irmao.grupoId, registradoPorId: usuario.id },
        create: { ...relatorio, irmaoId: irmao.id, mes: c.mes, grupoId: irmao.grupoId, registradoPorId: usuario.id },
    });
    if (irmao.grupoId) {
        await conferirConclusao(irmao.grupoId, c.mes).catch((e) => console.error('[relatorio] aviso de conclusão:', e));
    }
    return { relatorio: salvo };
}

/** O relatorio da congregacao no mes (so quem ve todos os grupos). */
async function resumoDoMes(usuario, mesPedido) {
    if (!(await veTodos(usuario))) return { erro: 403 };
    const mes = ehMes(mesPedido) ? mesPedido : mesDeReferencia(hojeISO());
    const [relatorios, quadro] = await Promise.all([
        prisma.relatorioCampo.findMany({ where: { mes } }),
        painel(usuario, mes),
    ]);
    const entreguesPorIrmao = new Set(relatorios.map((r) => r.irmaoId));
    const grupos = await prisma.grupoCampo.findMany({
        where: { ativo: true },
        select: { id: true, publicadores: { where: { ativo: true }, select: { id: true, nome: true } } },
    });
    return {
        mes,
        nomeMes: nomeDoMes(mes),
        totais: resumir(relatorios),
        grupos: quadro.grupos.map((g) => ({
            ...g,
            pendentes: (grupos.find((x) => x.id === g.id)?.publicadores || [])
                .filter((p) => !entreguesPorIrmao.has(p.id))
                .map((p) => p.nome),
        })),
        completo: quadro.grupos.length > 0 && quadro.grupos.every((g) => g.concluidoEm),
    };
}

/**
 * A tarefa "Pedir o relatorio" da tela de inicio, para o dirigente e o ajudante: do dia 1 ate
 * o grupo entregar o mes inteiro. Atrasa depois do dia DIA_LIMITE.
 */
async function tarefasDoUsuario(usuario, hoje) {
    const ids = await gruposQueLidera(usuario && usuario.irmaoId);
    if (ids.length === 0) return [];
    const mes = mesDeReferencia(hoje);
    if (mes < PRIMEIRO_MES) return [];
    const quadro = await painel(usuario, mes, { soOsMeus: true });
    const Regras = require('./RegrasTarefas');
    const vencimentoISO = `${hoje.slice(0, 7)}-${String(DIA_LIMITE).padStart(2, '0')}`;
    const dias = Regras.diasAte(vencimentoISO, hoje);
    const situacao = Regras.situacaoDe(dias, null);
    return quadro.grupos
        .filter((g) => !g.concluidoEm && g.membros > 0)
        .map((g) => ({
            id: `relatorioGrupo|${mes}-01|${g.id}`,
            tipo: 'relatorioGrupo',
            label: 'Relatório do grupo',
            icone: 'document-text-outline',
            cadencia: 'mes',
            cadenciaLabel: 'Todo mês',
            conclusao: 'relatorio',
            concluivel: false,
            acao: { titulo: 'Abrir o grupo', destino: 'grupos', id: g.id },
            ocorrencia: `${mes}-01`,
            titulo: `Pedir o relatório de ${nomeDoMes(mes, true)} ao ${g.rotulo.replace(/^Grupo/, 'grupo')}`,
            detalhe: `${g.entregues} de ${g.membros} já entregaram`,
            referencia: nomeDoMes(mes),
            vencimentoISO,
            prazo: Regras.rotuloDoPrazo(vencimentoISO, hoje),
            diasAteVencer: dias,
            situacao,
            atrasada: situacao === 'atrasada',
            grupo: { id: g.id, nome: g.nome },
        }));
}

/**
 * No dia 1, a partir das 9h, um push para o dirigente e o ajudante de cada grupo: "peca o
 * relatorio". Uma vez por mes por pessoa (LembreteEnviado segura o repetido entre tiques e
 * restarts).
 */
async function avisarDirigentes(agora = new Date()) {
    const relogio = relogioDaCongregacao(agora);
    if (relogio.getUTCDate() !== 1 || relogio.getUTCHours() < HORA_DO_LEMBRETE) return;
    const hoje = hojeISO(agora);
    const mes = mesDeReferencia(hoje);
    if (mes < PRIMEIRO_MES) return;
    const regra = 'relatorio-campo';

    const grupos = await prisma.grupoCampo.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, dirigenteId: true, ajudanteId: true, dirigente: { select: { nome: true } } },
    });
    for (const g of grupos) {
        const lideres = [g.dirigenteId, g.ajudanteId].filter(Boolean);
        if (lideres.length === 0) continue;
        const usuarios = await prisma.usuario.findMany({
            where: { irmaoId: { in: lideres } },
            select: { id: true, pushTokens: { select: { token: true } } },
        });
        const avisados = new Set(
            (await prisma.lembreteEnviado.findMany({ where: { dataISO: hoje, regra, usuarioId: { in: usuarios.map((u) => u.id) } } })).map(
                (l) => l.usuarioId,
            ),
        );
        const pendentes = usuarios.filter((u) => !avisados.has(u.id));
        if (pendentes.length === 0) continue;
        await prisma.lembreteEnviado.createMany({
            data: pendentes.map((u) => ({ usuarioId: u.id, dataISO: hoje, regra })),
            skipDuplicates: true,
        });
        const rotulo = rotuloDoGrupo(g.dirigente && g.dirigente.nome, g.nome);
        await enviarPush(
            pendentes,
            `Relatório de ${nomeDoMes(mes, true)}`,
            `Hora de pedir o relatório de ${nomeDoMes(mes, true)} ao ${rotulo.replace(/^Grupo/, 'grupo')}. A mensagem pronta está no app.`,
            { screen: 'grupos', grupoId: g.id, mes },
        );
    }
}

module.exports = {
    painel,
    detalhe,
    membro,
    salvarRelatorio,
    apagarRelatorio,
    meuRelatorio,
    enviarMeuRelatorio,
    resumoDoMes,
    tarefasDoUsuario,
    avisarDirigentes,
    gruposQueLidera,
    secretarioIrmaoId,
    // Para a area de pioneiros: o relatorio que o proprio pioneiro manda conta para o grupo.
    conferirConclusao,
    enviarPush,
    _internos: { mesDeReferencia, nomeDoMes, normalizarRelatorio, resumir, textoDoPedido, periodo, estatisticas, isoDeBR, somarMeses, historicoDeRelatorios },
};
