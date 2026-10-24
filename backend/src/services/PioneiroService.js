'use strict';

const prisma = require('../prisma');
const { relogioDaCongregacao } = require('./RegrasLembrete');
const { instanteDoCelular } = require('../utils/datas');

/**
 * A area de pioneiros: o proprio pioneiro registra as horas (cronometro ou a mao), acompanha a
 * meta, cuida das revisitas e dos estudos e manda o relatorio do mes direto para o grupo.
 *
 * Tudo no servidor (trocar ou perder o celular nao perde nada) e cada um so mexe no que e seu:
 * a chave e sempre o irmao do usuario logado, nunca um id de irmao vindo do app. Quem usa:
 * o pioneiro do cadastro (regular ou auxiliar) e o admin geral.
 *
 * As regras puras ficam no topo (testadas em scripts/verificarPioneiros.js).
 */

/** A meta do mes pelo tipo de pioneiro do cadastro (o admin que nao e pioneiro fica com a do regular). */
const metaPadrao = (pioneiro) => (pioneiro === 'auxiliar' ? 30 : 50);
const ehPioneiro = (pioneiro) => pioneiro === 'regular' || pioneiro === 'auxiliar';
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

const TIPOS_VISITA = ['conversa', 'estudo', 'nao_em_casa'];
const ehHora = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));

/**
 * A situacao de um contato, para a cor do pino e o selo: `atrasada` (a visita marcada ja
 * passou), `hoje`, `breve` (ate 3 dias), `marcada` ou `semData`.
 */
function situacaoDoContato(r, hoje) {
    if (!r.proximaVisita) return 'semData';
    const dia = hojeISO(new Date(r.proximaVisita));
    if (dia < hoje) return 'atrasada';
    if (dia === hoje) return 'hoje';
    const limite = new Date(`${hoje}T00:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() + 3);
    return dia <= limite.toISOString().slice(0, 10) ? 'breve' : 'marcada';
}

/** Os niveis: bronze, prata e ouro a partir de quanto. */
const NIVEIS = ['bronze', 'prata', 'ouro'];
function nivelDe(valor, limites) {
    let nivel = null;
    limites.forEach((l, i) => {
        if (valor >= l) nivel = NIVEIS[i];
    });
    const proximo = limites.findIndex((l) => valor < l);
    return { nivel, proximo: proximo >= 0 ? { nivel: NIVEIS[proximo], falta: limites[proximo] - valor } : null };
}

/**
 * Os emblemas (como no WitnessWork: comemorar meses constantes, nao horas). `mesesComMeta` vai
 * do mais antigo ao mes atual; a sequencia conta do fim para tras (o mes atual so entra quando
 * ja bateu a meta).
 */
function emblemas({ mesesComMeta, visitas, estudos, dias }) {
    let sequencia = 0;
    for (let i = mesesComMeta.length - 1; i >= 0; i -= 1) {
        if (mesesComMeta[i]) sequencia += 1;
        else if (i === mesesComMeta.length - 1) continue; // o mes atual ainda pode bater a meta
        else break;
    }
    const lista = [
        { id: 'constancia', nome: 'Meses constantes', icone: 'calendar', valor: sequencia, unidade: 'meses seguidos com a meta', limites: [1, 3, 6] },
        { id: 'regando', nome: 'Regando', icone: 'water', valor: visitas, unidade: 'revisitas no mês', limites: [5, 15, 30] },
        { id: 'estudos', nome: 'Ensinando', icone: 'book', valor: estudos, unidade: 'estudos dirigidos no mês', limites: [2, 6, 12] },
        { id: 'pronto', nome: 'Pronto para sair', icone: 'briefcase', valor: dias, unidade: 'dias no ministério no mês', limites: [4, 8, 12] },
    ];
    return lista.map(({ limites, ...e }) => ({ ...e, ...nivelDe(e.valor, limites) }));
}

/** O mes no ano de servico: `meta` batida, `parcial`, `vazio` ou `futuro`. */
function statusDoMes({ mes, minutos, meta, mesAtual }) {
    if (mes > mesAtual) return 'futuro';
    if (minutos >= meta * 60) return 'meta';
    return minutos > 0 ? 'parcial' : 'vazio';
}

/** Plano de saida: dia (de hoje ate 60 dias), hora, duracao de 15 min a 12 h. */
function normalizarPlano(corpo, hoje) {
    const c = corpo || {};
    if (!ehDia(c.data) || c.data < hoje) return { erro: 'Escolha um dia de hoje em diante.' };
    if (!ehHora(c.hora)) return { erro: 'Hora inválida.' };
    const duracaoMin = Math.round(Number(c.duracaoMin ?? 120));
    if (!Number.isFinite(duracaoMin) || duracaoMin < 15 || duracaoMin > 720) return { erro: 'Duração de 15 minutos a 12 horas.' };
    const texto = (v, max) => String(v || '').trim().slice(0, max) || null;
    return { plano: { data: c.data, hora: c.hora, duracaoMin, local: texto(c.local, 120), nota: texto(c.nota, 300) } };
}

/** Viagem: dia ate hoje, km (0,1 a 2.000) e o gasto com combustivel (opcional). */
function normalizarViagem(corpo, hoje) {
    const c = corpo || {};
    if (!ehDia(c.data) || c.data > hoje) return { erro: 'Escolha um dia até hoje.' };
    const km = Math.round(Number(String(c.km ?? '').replace(',', '.')) * 10) / 10;
    if (!Number.isFinite(km) || km < 0.1 || km > 2000) return { erro: 'Informe a distância em km.' };
    let custo = null;
    if (c.custo !== undefined && c.custo !== null && c.custo !== '') {
        custo = Math.round(Number(String(c.custo).replace(',', '.')) * 100) / 100;
        if (!Number.isFinite(custo) || custo < 0 || custo > 10000) return { erro: 'Gasto inválido.' };
    }
    return { viagem: { data: c.data, km, custo, nota: String(c.nota || '').trim().slice(0, 200) || null } };
}

/** Texto de um campo do iCalendar (RFC 5545): barra, ponto e virgula, virgula e quebra escapados. */
const textoIcs = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Instante -> "20261025T180000Z" */
const dataIcs = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Linha longa dobrada em pedacos de 74 caracteres (as seguintes comecam com espaco). Array.from nao parte emoji ao meio. */
function dobrar(linha) {
    const c = Array.from(linha);
    const partes = [];
    for (let i = 0; i < c.length; i += 74) partes.push((i ? ' ' : '') + c.slice(i, i + 74).join(''));
    return partes.join('\r\n');
}

/**
 * O calendario assinado pelo celular (webcal): um evento por visita marcada e por plano de
 * saida. `eventos`: [{ uid, inicio, fim, titulo, local, descricao }].
 */
function montarIcs(eventos, { agora = new Date(), nome = 'Ministério' } = {}) {
    const linhas = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Servir Mais//Ministerio//PT',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${textoIcs(nome)}`,
        'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
        'X-PUBLISHED-TTL:PT1H',
    ];
    for (const e of eventos) {
        linhas.push(
            'BEGIN:VEVENT',
            `UID:${e.uid}@servirmais`,
            `DTSTAMP:${dataIcs(agora)}`,
            `DTSTART:${dataIcs(e.inicio)}`,
            `DTEND:${dataIcs(e.fim)}`,
            `SUMMARY:${textoIcs(e.titulo)}`,
            ...(e.local ? [`LOCATION:${textoIcs(e.local)}`] : []),
            ...(e.descricao ? [`DESCRIPTION:${textoIcs(e.descricao)}`] : []),
            'END:VEVENT',
        );
    }
    linhas.push('END:VCALENDAR');
    return `${linhas.map(dobrar).join('\r\n')}\r\n`;
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

/** O irmao do usuario, se ele pode usar a area (pioneiro, regular ou auxiliar, ou admin geral). */
async function contexto(usuario) {
    if (!usuario || !usuario.irmaoId) {
        return { erro: 403, mensagem: 'Sua conta precisa estar ligada ao seu cadastro de publicador. Fale com um administrador.' };
    }
    const irmao = await prisma.irmao.findUnique({ where: { id: usuario.irmaoId }, select: { id: true, nome: true, pioneiro: true, grupoId: true } });
    if (!irmao) return { erro: 403, mensagem: 'Cadastro não encontrado.' };
    if (!usuario.isAdmin && !ehPioneiro(irmao.pioneiro)) return { erro: 403, mensagem: 'Esta área é dos pioneiros.' };
    return { irmao };
}

/** Meia-noite (no relogio da congregacao) de um dia "2026-10-23", como instante. */
function inicioDoDia(dia, agora = new Date()) {
    // Arredondado ao minuto: o relogio da congregacao vem sem os milissegundos do instante.
    const deslocamento = Math.round((relogioDaCongregacao(agora).getTime() - agora.getTime()) / 60000) * 60000;
    return new Date(Date.parse(`${dia}T00:00:00Z`) - deslocamento);
}

/** "2026-10" -> "2026-11" (e o contrario com -1). */
function somarMes(mes, delta) {
    const [ano, numero] = mes.split('-').map(Number);
    const total = ano * 12 + (numero - 1) + delta;
    return `${Math.floor(total / 12)}-${dois((total % 12) + 1)}`;
}

const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0];

const perfilDe = (irmao) =>
    prisma.pioneiroPerfil.upsert({ where: { irmaoId: irmao.id }, create: { irmaoId: irmao.id, metaMensal: metaPadrao(irmao.pioneiro) }, update: {} });

/**
 * Trocou o tipo de pioneiro (no cadastro ou pela lista de grupos): a meta volta ao padrao do tipo
 * novo. Depois cada um ajusta a sua no Perfil.
 */
const metaDoTipo = (db, irmaoIds, pioneiro) =>
    db.pioneiroPerfil.updateMany({ where: { irmaoId: { in: irmaoIds } }, data: { metaMensal: metaPadrao(pioneiro) } });

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
        perfilDe(irmao),
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

    // As conversas de hoje: as marcadas para hoje e as que ja tiveram visita hoje (feitas).
    const inicio = inicioDoDia(hoje);
    const fim = new Date(inicio.getTime() + 86400000);
    const visitasHoje = await prisma.revisitaVisita.findMany({
        where: { revisita: { irmaoId: irmao.id }, data: { gte: inicio, lt: fim } },
        select: { revisitaId: true, tipo: true },
        orderBy: { data: 'asc' },
    });
    const feitas = new Map(visitasHoje.map((v) => [v.revisitaId, v.tipo]));
    const doDia = revisitas.filter((r) => (r.proximaVisita && hojeISO(new Date(r.proximaVisita)) === hoje) || feitas.has(r.id));
    return {
        mes,
        nomeMes: nomeDoMes(mes),
        hoje,
        nome: primeiroNome(irmao.nome),
        compartilharPlanos: perfil.compartilharPlanos,
        // Ja gerou o link do calendario: o app para de convidar a assinar.
        calendario: !!perfil.calendarioToken,
        conversasHoje: {
            total: doDia.length,
            feitas: doDia.filter((r) => feitas.has(r.id)).length,
            itens: doDia.map((r) => ({ ...r, feita: feitas.get(r.id) || null })),
        },
        aSeguir: revisitas
            .filter((r) => r.proximaVisita && new Date(r.proximaVisita) >= fim)
            .slice(0, 5)
            .map((r) => ({ ...r, situacao: situacaoDoContato(r, hoje) })),
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
 *
 * Sem internet, o celular guarda a acao e manda depois com `em`, a hora em que ela foi feita:
 * e essa hora que conta. Reenviar a mesma acao nao muda nada (iniciar rodando, pausar parado).
 */
async function cronometro(usuario, acao, agora = new Date(), em) {
    const quando = instanteDoCelular(em, agora);
    if (quando.erro) return { erro: 400, mensagem: quando.erro };
    const { instante } = quando;
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const irmaoId = ctx.irmao.id;
    const perfil = await perfilDe(ctx.irmao);
    const segundos = segundosDoCronometro(perfil, instante);
    const mudancas = {
        iniciar: perfil.cronometroInicio ? null : { cronometroInicio: instante },
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
                data: { irmaoId, data: hojeISO(instante), minutos: Math.round(segundos / 60), origem: 'cronometro' },
            });
        }
    }
    return { cronometro: estadoDoCronometro(await perfilDe(ctx.irmao)), registro };
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
    await perfilDe(ctx.irmao);
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
    const tipo = TIPOS_VISITA.includes(c.tipo) ? c.tipo : 'conversa';
    const { revisita: proxima, erro } = normalizarRevisita({ proximaVisita: c.proximaVisita ?? null }, { parcial: true });
    if (erro) return { erro: 400, mensagem: erro };
    await prisma.$transaction([
        prisma.revisitaVisita.create({ data: { revisitaId: id, data, tipo, observacao: String(c.observacao || '').trim().slice(0, 1000) || null } }),
        prisma.revisita.update({ where: { id }, data: proxima }),
    ]);
    return revisita(usuario, id);
}

/** Meta e privacidade (os companheiros veem os planos de saida). So o que veio. */
async function atualizarPerfil(usuario, corpo) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const c = corpo || {};
    const dados = {};
    if (c.metaMensal !== undefined) {
        const meta = Math.round(Number(c.metaMensal));
        if (!Number.isFinite(meta) || meta < 1 || meta > 200) return { erro: 400, mensagem: 'Meta de 1 a 200 horas por mês.' };
        dados.metaMensal = meta;
    }
    if (c.compartilharPlanos !== undefined) dados.compartilharPlanos = c.compartilharPlanos === true;
    await perfilDe(ctx.irmao);
    const perfil = await prisma.pioneiroPerfil.update({ where: { irmaoId: ctx.irmao.id }, data: dados });
    return { metaMensal: perfil.metaMensal, compartilharPlanos: perfil.compartilharPlanos };
}

/**
 * A agenda de um periodo (ate 62 dias): as visitas marcadas, os planos de saida (os dele e os
 * dos companheiros pioneiros que compartilham) e as saidas de campo publicadas da congregacao.
 */
async function agenda(usuario, { de, ate } = {}) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    if (!ehDia(de) || !ehDia(ate) || de > ate) return { erro: 400, mensagem: 'Período inválido.' };
    if ((Date.parse(ate) - Date.parse(de)) / 86400000 > 62) return { erro: 400, mensagem: 'Período de até 2 meses.' };
    const irmaoId = ctx.irmao.id;
    const hoje = hojeISO();
    const [visitas, planos, escalas] = await Promise.all([
        prisma.revisita.findMany({
            where: { irmaoId, ativa: true, proximaVisita: { gte: inicioDoDia(de), lt: new Date(inicioDoDia(ate).getTime() + 86400000) } },
            select: { id: true, nome: true, endereco: true, estudo: true, proximaVisita: true },
            orderBy: { proximaVisita: 'asc' },
        }),
        prisma.pioneiroPlano.findMany({
            where: {
                data: { gte: de, lte: ate },
                // Sem perfil salvo ainda vale o padrao (compartilhar).
                OR: [
                    { irmaoId },
                    { irmao: { pioneiro: { in: ['regular', 'auxiliar'] }, OR: [{ pioneiroPerfil: { is: null } }, { pioneiroPerfil: { is: { compartilharPlanos: true } } }] } },
                ],
            },
            include: { irmao: { select: { nome: true } } },
            orderBy: [{ data: 'asc' }, { hora: 'asc' }],
        }),
        prisma.escalaDirigente.findMany({
            where: { removido: false, quadro: { status: 'publicado', ano: { gte: Number(de.slice(0, 4)) - 1, lte: Number(ate.slice(0, 4)) } } },
            select: { id: true, data: true, principal: true, quadro: { select: { ano: true, mes: true } }, saidaCampo: { select: { horario: true, local: true } } },
        }),
    ]);
    const saidas = escalas
        .map((e) => {
            const [d, m] = String(e.data).split('/').map(Number);
            if (!d || !m) return null;
            // Quadro de dezembro com dias de janeiro: o ano vira.
            const ano = m < e.quadro.mes ? e.quadro.ano + 1 : e.quadro.ano;
            return {
                id: e.id,
                data: `${ano}-${dois(m)}-${dois(d)}`,
                hora: e.saidaCampo ? e.saidaCampo.horario : null,
                local: e.saidaCampo ? e.saidaCampo.local : null,
                dirigente: e.principal || null,
            };
        })
        .filter((e) => e && e.data >= de && e.data <= ate)
        .sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));
    return {
        de,
        ate,
        hoje,
        visitas: visitas.map((r) => ({ ...r, situacao: situacaoDoContato(r, hoje) })),
        planos: planos.map(({ irmao, irmaoId: dono, createdAt: _c, ...p }) => ({ ...p, meu: dono === irmaoId, nome: dono === irmaoId ? null : primeiroNome(irmao.nome) })),
        saidas,
    };
}

async function criarPlano(usuario, corpo) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const { plano, erro } = normalizarPlano(corpo, hojeISO());
    if (erro) return { erro: 400, mensagem: erro };
    return { plano: await prisma.pioneiroPlano.create({ data: { ...plano, irmaoId: ctx.irmao.id } }) };
}

async function apagarPlano(usuario, id) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const { count } = await prisma.pioneiroPlano.deleteMany({ where: { id, irmaoId: ctx.irmao.id } });
    return count ? { ok: true } : { erro: 404, mensagem: 'Plano não encontrado.' };
}

/** As viagens do mes, com os totais (km, gasto) e o km de cada dia para o grafico. */
async function viagens(usuario, mesPedido) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const hoje = hojeISO();
    const mes = ehMes(mesPedido) && mesPedido <= hoje.slice(0, 7) ? mesPedido : hoje.slice(0, 7);
    const lista = await prisma.pioneiroViagem.findMany({
        where: { irmaoId: ctx.irmao.id, data: { gte: `${mes}-01`, lte: `${mes}-31` } },
        orderBy: [{ data: 'desc' }, { id: 'desc' }],
    });
    const porDia = {};
    for (const v of lista) porDia[v.data] = Math.round(((porDia[v.data] || 0) + v.km) * 10) / 10;
    return {
        mes,
        viagens: lista,
        quantidade: lista.length,
        km: Math.round(lista.reduce((s, v) => s + v.km, 0) * 10) / 10,
        custo: Math.round(lista.reduce((s, v) => s + (v.custo || 0), 0) * 100) / 100,
        porDia,
    };
}

async function criarViagem(usuario, corpo) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const { viagem, erro } = normalizarViagem(corpo, hojeISO());
    if (erro) return { erro: 400, mensagem: erro };
    return { viagem: await prisma.pioneiroViagem.create({ data: { ...viagem, irmaoId: ctx.irmao.id } }) };
}

async function apagarViagem(usuario, id) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const { count } = await prisma.pioneiroViagem.deleteMany({ where: { id, irmaoId: ctx.irmao.id } });
    return count ? { ok: true } : { erro: 404, mensagem: 'Viagem não encontrada.' };
}

/**
 * O progresso: o ano de servico mes a mes (horas, status e relatorio), os emblemas e a
 * quilometragem do mes.
 */
async function progresso(usuario, mesPedido) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const irmaoId = ctx.irmao.id;
    const hoje = hojeISO();
    const mesAtual = hoje.slice(0, 7);
    const mes = ehMes(mesPedido) && mesPedido <= mesAtual ? mesPedido : mesAtual;
    const anoServico = mesesDoAnoDeServico(mes);
    const ultimos12 = Array.from({ length: 12 }, (_, i) => somarMes(mes, i - 11));
    const desde = ultimos12[0] < anoServico[0] ? ultimos12[0] : anoServico[0];
    const [perfil, horas, relatorios, visitasMes, viagensMes] = await Promise.all([
        perfilDe(ctx.irmao),
        prisma.pioneiroHoras.findMany({ where: { irmaoId, data: { gte: `${desde}-01`, lte: `${anoServico[11]}-31` } }, select: { data: true, minutos: true } }),
        prisma.relatorioCampo.findMany({ where: { irmaoId, mes: { in: anoServico } }, select: { mes: true } }),
        prisma.revisitaVisita.findMany({
            where: { revisita: { irmaoId }, data: { gte: inicioDoDia(`${mes}-01`), lt: inicioDoDia(`${somarMes(mes, 1)}-01`) } },
            select: { tipo: true },
        }),
        prisma.pioneiroViagem.findMany({ where: { irmaoId, data: { gte: `${mes}-01`, lte: `${mes}-31` } }, select: { km: true, custo: true } }),
    ]);
    const minutosDe = (m) => horas.filter((h) => h.data.startsWith(m)).reduce((s, h) => s + h.minutos, 0);
    const meta = perfil.metaMensal;
    const { nomeDoMes } = require('./RelatorioCampoService')._internos;
    return {
        mes,
        nomeMes: nomeDoMes(mes),
        meta,
        metaAno: meta * 12,
        minutosMes: minutosDe(mes),
        minutosAno: anoServico.filter((m) => m <= mes).reduce((s, m) => s + minutosDe(m), 0),
        porMes: anoServico.map((m) => ({
            mes: m,
            minutos: minutosDe(m),
            status: statusDoMes({ mes: m, minutos: minutosDe(m), meta, mesAtual }),
            relatorio: relatorios.some((r) => r.mes === m),
        })),
        emblemas: emblemas({
            mesesComMeta: ultimos12.map((m) => minutosDe(m) >= meta * 60),
            visitas: visitasMes.filter((v) => v.tipo !== 'nao_em_casa').length,
            estudos: visitasMes.filter((v) => v.tipo === 'estudo').length,
            dias: new Set(horas.filter((h) => h.data.startsWith(mes)).map((h) => h.data)).size,
        }),
        viagens: {
            quantidade: viagensMes.length,
            km: Math.round(viagensMes.reduce((s, v) => s + v.km, 0) * 10) / 10,
            custo: Math.round(viagensMes.reduce((s, v) => s + (v.custo || 0), 0) * 100) / 100,
        },
    };
}

/** O link do calendario do pioneiro (cria na primeira vez; `trocar` derruba o antigo). */
async function linkCalendario(usuario, { trocar = false } = {}) {
    const ctx = await contexto(usuario);
    if (ctx.erro) return ctx;
    const perfil = await perfilDe(ctx.irmao);
    if (perfil.calendarioToken && !trocar) return { token: perfil.calendarioToken };
    const token = require('crypto').randomBytes(24).toString('hex');
    await prisma.pioneiroPerfil.update({ where: { irmaoId: ctx.irmao.id }, data: { calendarioToken: token } });
    return { token };
}

/**
 * O calendario de um token (rota sem login: quem tem o link tem o calendario). Visitas marcadas
 * e planos de saida de uma semana atras ate 3 meses para frente. Null quando o token nao existe.
 */
async function calendarioIcs(token, agora = new Date()) {
    if (!/^[a-f0-9]{48}$/.test(String(token || ''))) return null;
    const perfil = await prisma.pioneiroPerfil.findFirst({ where: { calendarioToken: token }, select: { irmaoId: true } });
    if (!perfil) return null;
    const de = new Date(agora.getTime() - 7 * 86400000);
    const ate = new Date(agora.getTime() + 90 * 86400000);
    const [visitas, planos] = await Promise.all([
        prisma.revisita.findMany({
            where: { irmaoId: perfil.irmaoId, ativa: true, proximaVisita: { gte: de, lte: ate } },
            select: { id: true, nome: true, endereco: true, estudo: true, proximaVisita: true },
        }),
        prisma.pioneiroPlano.findMany({ where: { irmaoId: perfil.irmaoId, data: { gte: hojeISO(de), lte: hojeISO(ate) } } }),
    ]);
    const eventos = [
        ...visitas.map((r) => ({
            uid: `revisita-${r.id}`,
            inicio: r.proximaVisita,
            fim: new Date(new Date(r.proximaVisita).getTime() + 30 * 60000),
            titulo: `${r.estudo ? 'Estudo' : 'Revisita'}: ${r.nome}`,
            local: r.endereco,
        })),
        ...planos.map((p) => {
            const [h, m] = p.hora.split(':').map(Number);
            const inicio = new Date(inicioDoDia(p.data, agora).getTime() + (h * 60 + m) * 60000);
            return {
                uid: `plano-${p.id}`,
                inicio,
                fim: new Date(inicio.getTime() + p.duracaoMin * 60000),
                titulo: 'Ministério',
                local: p.local,
                descricao: p.nota,
            };
        }),
    ];
    return montarIcs(eventos, { agora });
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
    atualizarPerfil,
    agenda,
    criarPlano,
    apagarPlano,
    viagens,
    criarViagem,
    apagarViagem,
    progresso,
    linkCalendario,
    calendarioIcs,
    metaDoTipo,
    _internos: {
        montarIcs,
        textoIcs,
        mesesDoAnoDeServico,
        segundosDoCronometro,
        normalizarHoras,
        normalizarRevisita,
        devoAvisar,
        horaDaCongregacao,
        situacaoDoContato,
        nivelDe,
        emblemas,
        statusDoMes,
        normalizarPlano,
        normalizarViagem,
        inicioDoDia,
        metaPadrao,
    },
};
