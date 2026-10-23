'use strict';

const prisma = require('../prisma');
const { relogioDaCongregacao } = require('./RegrasLembrete');

/**
 * A area de pioneiros: o proprio pioneiro registra as horas (cronometro ou a mao), acompanha a
 * meta, cuida das revisitas e dos estudos e manda o relatorio do mes direto para o grupo.
 *
 * Tudo no servidor (trocar ou perder o celular nao perde nada) e cada um so mexe no que e seu:
 * a chave e sempre o irmao do usuario logado, nunca um id de irmao vindo do app. Quem usa:
 * pioneiro regular (cadastro) e o admin geral.
 *
 * As regras puras ficam no topo (testadas em scripts/verificarPioneiros.js).
 */

const META_PADRAO = 50;
/** Quanto antes da visita marcada sai o aviso (o agendador acorda de 15 em 15 minutos). */
const AVISO_ANTES_MIN = 60;

// ---------------------------------------------------------------------------
// Regras puras
// ---------------------------------------------------------------------------

const dois = (n) => String(n).padStart(2, '0');
const ehDia = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const ehMes = (v) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || ''));
const hojeISO = (agora = new Date()) => relogioDaCongregacao(agora).toISOString().slice(0, 10);

/** Os 12 meses do ano de servico (setembro a agosto) em que `mes` cai. */
function mesesDoAnoDeServico(mes) {
    const [ano, numero] = String(mes).split('-').map(Number);
    const inicio = (numero >= 9 ? ano : ano - 1) * 12 + 8;
    return Array.from({ length: 12 }, (_, i) => `${Math.floor((inicio + i) / 12)}-${dois(((inicio + i) % 12) + 1)}`);
}

/** Segundos do cronometro agora: o que somou antes das pausas mais o trecho rodando. */
function segundosDoCronometro(perfil, agora = new Date()) {
    const rodando = perfil.cronometroInicio ? Math.max(0, Math.floor((agora - new Date(perfil.cronometroInicio)) / 1000)) : 0;
    return (perfil.cronometroSeg || 0) + rodando;
}

/** Horas lancadas a mao: um dia ate hoje (do ultimo ano), de 1 minuto a 24 horas. */
function normalizarHoras(corpo, hoje) {
    const c = corpo || {};
    if (!ehDia(c.data) || c.data > hoje) return { erro: 'Escolha um dia até hoje.' };
    const limite = new Date(`${hoje}T00:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() - 400);
    if (c.data < limite.toISOString().slice(0, 10)) return { erro: 'Só dá para lançar horas do último ano.' };
    const minutos = Math.round(Number(c.minutos));
    if (!Number.isFinite(minutos) || minutos < 1 || minutos > 24 * 60) return { erro: 'Informe de 1 minuto a 24 horas.' };
    return { horas: { data: c.data, minutos, observacao: String(c.observacao || '').trim().slice(0, 200) || null } };
}

/**
 * A revisita como pode ser gravada. `parcial`: so o que veio (edicao). Mudar a proxima visita
 * zera o aviso: a data nova avisa de novo.
 */
function normalizarRevisita(corpo, { parcial = false } = {}) {
    const c = corpo || {};
    const r = {};
    const texto = (v, max) => (v === undefined ? undefined : String(v || '').trim().slice(0, max) || null);
    if (!parcial || c.nome !== undefined) {
        const nome = texto(c.nome, 80);
        if (!nome) return { erro: 'Informe o nome.' };
        r.nome = nome;
    }
    for (const [campo, max] of [['endereco', 200], ['telefone', 30], ['observacao', 1000]]) {
        const v = texto(c[campo], max);
        if (v !== undefined) r[campo] = v;
    }
    if (c.estudo !== undefined) r.estudo = c.estudo === true;
    if (c.ativa !== undefined) r.ativa = c.ativa !== false;
    if (c.lat !== undefined || c.lng !== undefined) {
        const lat = Number(c.lat);
        const lng = Number(c.lng);
        const valida = c.lat !== null && c.lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        r.lat = valida ? lat : null;
        r.lng = valida ? lng : null;
    }
    if (c.proximaVisita !== undefined) {
        if (c.proximaVisita === null || c.proximaVisita === '') r.proximaVisita = null;
        else {
            const d = new Date(c.proximaVisita);
            if (Number.isNaN(d.getTime())) return { erro: 'Data da próxima visita inválida.' };
            r.proximaVisita = d;
        }
        r.lembreteEm = null;
    }
    return { revisita: r };
}

/** A visita marcada pede aviso agora? Falta ate 1 hora (ou passou ate 2) e ainda nao avisou. */
function devoAvisar(r, agora = new Date()) {
    if (!r.ativa || !r.proximaVisita || r.lembreteEm) return false;
    const falta = new Date(r.proximaVisita) - agora;
    return falta <= AVISO_ANTES_MIN * 60000 && falta >= -2 * 3600000;
}

/** "15:30" no relogio da congregacao. */
function horaDaCongregacao(data) {
    const d = relogioDaCongregacao(new Date(data));
    return `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`;
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

/** O irmao do usuario, se ele pode usar a area (pioneiro regular ou admin geral). */
async function contexto(usuario) {
    if (!usuario || !usuario.irmaoId) {
        return { erro: 403, mensagem: 'Sua conta precisa estar ligada ao seu cadastro de publicador. Fale com um administrador.' };
    }
    const irmao = await prisma.irmao.findUnique({ where: { id: usuario.irmaoId }, select: { id: true, nome: true, pioneiro: true, grupoId: true } });
    if (!irmao) return { erro: 403, mensagem: 'Cadastro não encontrado.' };
    if (!usuario.isAdmin && irmao.pioneiro !== 'regular') return { erro: 403, mensagem: 'Esta área é dos pioneiros regulares.' };
    return { irmao };
}

const perfilDe = (irmaoId) =>
    prisma.pioneiroPerfil.upsert({ where: { irmaoId }, create: { irmaoId, metaMensal: META_PADRAO }, update: {} });

const estadoDoCronometro = (perfil) => ({
    rodando: !!perfil.cronometroInicio,
    inicio: perfil.cronometroInicio,
    acumuladoSeg: perfil.cronometroSeg,
});

/** O mes do pioneiro: cronometro, horas (do mes e do ano de servico), meta, estudos e o relatorio. */
async function painel(usuario, mesPedido) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const { irmao } = ctx;
    const hoje = hojeISO();
    const mes = ehMes(mesPedido) && mesPedido <= hoje.slice(0, 7) ? mesPedido : hoje.slice(0, 7);
    const anoServico = mesesDoAnoDeServico(mes);
    const [perfil, horas, revisitas, relatorio] = await Promise.all([
        perfilDe(irmao.id),
        prisma.pioneiroHoras.findMany({
            where: { irmaoId: irmao.id, data: { gte: `${anoServico[0]}-01`, lte: `${anoServico[11]}-31` } },
            orderBy: [{ data: 'desc' }, { id: 'desc' }],
        }),
        prisma.revisita.findMany({
            where: { irmaoId: irmao.id, ativa: true },
            select: { id: true, nome: true, estudo: true, proximaVisita: true, endereco: true },
            orderBy: [{ proximaVisita: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }],
        }),
        prisma.relatorioCampo.findUnique({ where: { irmaoId_mes: { irmaoId: irmao.id, mes } } }),
    ]);
    const soma = (lista) => lista.reduce((s, h) => s + h.minutos, 0);
    const { nomeDoMes } = require('./RelatorioCampoService')._internos;
    return {
        mes,
        nomeMes: nomeDoMes(mes),
        hoje,
        regular: irmao.pioneiro === 'regular',
        meta: perfil.metaMensal,
        metaAno: perfil.metaMensal * 12,
        cronometro: estadoDoCronometro(perfil),
        minutosMes: soma(horas.filter((h) => h.data.startsWith(mes))),
        // O ano de servico ate o mes escolhido.
        minutosAno: soma(horas.filter((h) => h.data.slice(0, 7) <= mes)),
        porMes: anoServico.map((m) => ({ mes: m, minutos: soma(horas.filter((h) => h.data.startsWith(m))) })),
        registros: horas.filter((h) => h.data.startsWith(mes)),
        estudos: revisitas.filter((r) => r.estudo).length,
        revisitas: revisitas.length,
        proximas: revisitas.filter((r) => r.proximaVisita && new Date(r.proximaVisita) >= new Date(Date.now() - 2 * 3600000)).slice(0, 3),
        relatorio,
    };
}

/**
 * O cronometro: iniciar, pausar, parar (vira horas de hoje) ou descartar. A troca so vale se
 * ninguem mexeu no meio (dois toques ou dois aparelhos): sem isso, "parar" duas vezes lancaria
 * as horas duas vezes.
 */
async function cronometro(usuario, acao, agora = new Date()) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const irmaoId = ctx.irmao.id;
    const perfil = await perfilDe(irmaoId);
    const segundos = segundosDoCronometro(perfil, agora);
    const mudancas = {
        iniciar: perfil.cronometroInicio ? null : { cronometroInicio: agora },
        pausar: perfil.cronometroInicio ? { cronometroInicio: null, cronometroSeg: segundos } : null,
        parar: { cronometroInicio: null, cronometroSeg: 0 },
        descartar: { cronometroInicio: null, cronometroSeg: 0 },
    };
    if (!Object.prototype.hasOwnProperty.call(mudancas, acao)) return { erro: 400, mensagem: 'Ação inválida.' };
    let registro = null;
    if (mudancas[acao]) {
        const { count } = await prisma.pioneiroPerfil.updateMany({ where: { irmaoId, updatedAt: perfil.updatedAt }, data: mudancas[acao] });
        if (count === 1 && acao === 'parar' && segundos >= 60) {
            registro = await prisma.pioneiroHoras.create({
                data: { irmaoId, data: hojeISO(agora), minutos: Math.round(segundos / 60), origem: 'cronometro' },
            });
        }
    }
    return { cronometro: estadoDoCronometro(await perfilDe(irmaoId)), registro };
}

async function lancarHoras(usuario, corpo) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const { horas, erro } = normalizarHoras(corpo, hojeISO());
    if (erro) return { erro: 400, mensagem: erro };
    return { registro: await prisma.pioneiroHoras.create({ data: { ...horas, irmaoId: ctx.irmao.id, origem: 'manual' } }) };
}

async function apagarHoras(usuario, id) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const { count } = await prisma.pioneiroHoras.deleteMany({ where: { id, irmaoId: ctx.irmao.id } });
    return count ? { ok: true } : { erro: 404, mensagem: 'Registro não encontrado.' };
}

async function definirMeta(usuario, valor) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const metaMensal = Math.round(Number(valor));
    if (!Number.isFinite(metaMensal) || metaMensal < 1 || metaMensal > 200) return { erro: 400, mensagem: 'Meta de 1 a 200 horas por mês.' };
    await perfilDe(ctx.irmao.id);
    await prisma.pioneiroPerfil.update({ where: { irmaoId: ctx.irmao.id }, data: { metaMensal } });
    return { metaMensal };
}

const REVISITA_LISTA = {
    id: true,
    nome: true,
    endereco: true,
    lat: true,
    lng: true,
    telefone: true,
    observacao: true,
    estudo: true,
    ativa: true,
    proximaVisita: true,
    updatedAt: true,
    visitas: { orderBy: { data: 'desc' }, take: 1, select: { data: true } },
    _count: { select: { visitas: true } },
};

async function listarRevisitas(usuario, { arquivadas = false } = {}) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const lista = await prisma.revisita.findMany({
        where: { irmaoId: ctx.irmao.id, ativa: !arquivadas },
        select: REVISITA_LISTA,
        orderBy: [{ proximaVisita: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }],
    });
    return {
        revisitas: lista.map(({ visitas, _count, ...r }) => ({ ...r, ultimaVisita: visitas[0] ? visitas[0].data : null, visitas: _count.visitas })),
    };
}

async function revisita(usuario, id) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const r = await prisma.revisita.findFirst({
        where: { id, irmaoId: ctx.irmao.id },
        include: { visitas: { orderBy: { data: 'desc' } } },
    });
    return r ? { revisita: r } : { erro: 404, mensagem: 'Revisita não encontrada.' };
}

async function criarRevisita(usuario, corpo) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const { revisita: dados, erro } = normalizarRevisita(corpo);
    if (erro) return { erro: 400, mensagem: erro };
    return { revisita: await prisma.revisita.create({ data: { ...dados, irmaoId: ctx.irmao.id } }) };
}

async function atualizarRevisita(usuario, id, corpo) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const { revisita: dados, erro } = normalizarRevisita(corpo, { parcial: true });
    if (erro) return { erro: 400, mensagem: erro };
    const { count } = await prisma.revisita.updateMany({ where: { id, irmaoId: ctx.irmao.id }, data: dados });
    if (!count) return { erro: 404, mensagem: 'Revisita não encontrada.' };
    return revisita(usuario, id);
}

async function apagarRevisita(usuario, id) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const { count } = await prisma.revisita.deleteMany({ where: { id, irmaoId: ctx.irmao.id } });
    return count ? { ok: true } : { erro: 404, mensagem: 'Revisita não encontrada.' };
}

/** Uma visita feita: fica no historico e troca a proxima visita marcada (ou tira, sem data). */
async function registrarVisita(usuario, id, corpo) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const r = await prisma.revisita.findFirst({ where: { id, irmaoId: ctx.irmao.id }, select: { id: true } });
    if (!r) return { erro: 404, mensagem: 'Revisita não encontrada.' };
    const c = corpo || {};
    const data = c.data ? new Date(c.data) : new Date();
    if (Number.isNaN(data.getTime()) || data > new Date(Date.now() + 60000)) return { erro: 400, mensagem: 'Data da visita inválida.' };
    const { revisita: proxima, erro } = normalizarRevisita({ proximaVisita: c.proximaVisita ?? null }, { parcial: true });
    if (erro) return { erro: 400, mensagem: erro };
    await prisma.$transaction([
        prisma.revisitaVisita.create({ data: { revisitaId: id, data, observacao: String(c.observacao || '').trim().slice(0, 1000) || null } }),
        prisma.revisita.update({ where: { id }, data: proxima }),
    ]);
    return revisita(usuario, id);
}

/**
 * O relatorio do mes, mandado pelo proprio pioneiro: as horas lancadas (horas cheias, como no
 * relatorio) e os estudos. Cai no relatorio do grupo, como se o dirigente tivesse anotado, e
 * conta para o grupo concluir.
 */
async function enviarRelatorio(usuario, corpo) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const { irmao } = ctx;
    const c = corpo || {};
    if (!ehMes(c.mes) || c.mes > hojeISO().slice(0, 7)) return { erro: 400, mensagem: 'Mês inválido.' };
    const regular = irmao.pioneiro === 'regular';
    if (!regular && c.pioneiroAuxiliar !== true) {
        return { erro: 400, mensagem: 'Só pioneiro manda relatório por aqui: marque se você foi pioneiro auxiliar neste mês.' };
    }
    const lancadas = await prisma.pioneiroHoras.findMany({ where: { irmaoId: irmao.id, data: { gte: `${c.mes}-01`, lte: `${c.mes}-31` } }, select: { minutos: true } });
    const minutos = lancadas.reduce((s, h) => s + h.minutos, 0);
    const Relatorio = require('./RelatorioCampoService');
    const { relatorio, erro } = Relatorio._internos.normalizarRelatorio(
        { horas: Math.floor(minutos / 60), estudos: c.estudos, pioneiroAuxiliar: !regular, observacao: c.observacao },
        { pioneiroRegular: regular },
    );
    if (erro) return { erro: 400, mensagem: erro };
    const salvo = await prisma.relatorioCampo.upsert({
        where: { irmaoId_mes: { irmaoId: irmao.id, mes: c.mes } },
        update: { ...relatorio, grupoId: irmao.grupoId, registradoPorId: usuario.id },
        create: { ...relatorio, irmaoId: irmao.id, mes: c.mes, grupoId: irmao.grupoId, registradoPorId: usuario.id },
    });
    if (irmao.grupoId) {
        await Relatorio.conferirConclusao(irmao.grupoId, c.mes).catch((e) => console.error('[pioneiro] aviso de conclusão:', e.message));
    }
    return { relatorio: salvo, minutosQueSobram: minutos % 60 };
}

/**
 * O aviso das visitas marcadas (no tique do agendador): uma vez por data marcada, para o
 * pioneiro dono da revisita.
 */
async function avisarVisitas(agora = new Date()) {
    const candidatas = await prisma.revisita.findMany({
        where: {
            ativa: true,
            lembreteEm: null,
            proximaVisita: { gte: new Date(agora.getTime() - 2 * 3600000), lte: new Date(agora.getTime() + AVISO_ANTES_MIN * 60000) },
        },
        select: { id: true, irmaoId: true, nome: true, endereco: true, proximaVisita: true, ativa: true, lembreteEm: true },
    });
    const { enviarPush } = require('./RelatorioCampoService');
    let avisadas = 0;
    for (const r of candidatas.filter((x) => devoAvisar(x, agora))) {
        // Marca antes de mandar: um tique que caia no meio nao repete o aviso.
        const { count } = await prisma.revisita.updateMany({ where: { id: r.id, lembreteEm: null }, data: { lembreteEm: agora } });
        if (!count) continue;
        const usuarios = await prisma.usuario.findMany({ where: { irmaoId: r.irmaoId }, select: { id: true, pushTokens: { select: { token: true } } } });
        if (usuarios.length === 0) continue;
        await enviarPush(usuarios, `Revisita às ${horaDaCongregacao(r.proximaVisita)}`, [r.nome, r.endereco].filter(Boolean).join(' · '), {
            screen: 'revisita',
            revisitaId: r.id,
        });
        avisadas += 1;
    }
    return { avisadas };
}

module.exports = {
    painel,
    cronometro,
    lancarHoras,
    apagarHoras,
    definirMeta,
    listarRevisitas,
    revisita,
    criarRevisita,
    atualizarRevisita,
    apagarRevisita,
    registrarVisita,
    enviarRelatorio,
    avisarVisitas,
    _internos: { mesesDoAnoDeServico, segundosDoCronometro, normalizarHoras, normalizarRevisita, devoAvisar, horaDaCongregacao, META_PADRAO },
};
