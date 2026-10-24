'use strict';

const prisma = require('../prisma');
const { relogioDaCongregacao } = require('./RegrasLembrete');

/**
 * O estudo pessoal: o programa de leitura da Biblia, os trechos lidos, a lista do que estudar,
 * as sessoes de estudo e a rotina com aviso.
 *
 * E de cada USUARIO, nao do cadastro de irmao (quem nao tem cadastro ligado tambem estuda), e so
 * o dono ve: a chave e sempre o usuario logado, nunca um id vindo do app.
 *
 * Os programas de leitura (o do jw.org, o "Comece sua leitura da Biblia" e os capitulos de cada
 * livro) sao dados fixos do app. Aqui fica so o que cada um escolheu e marcou. As regras puras
 * ficam no topo (testadas em scripts/verificarEstudo.js).
 */

const PLANOS = ['jw', 'comece', 'reuniao', 'livre'];
const TIPOS_ASSUNTO = ['assunto', 'pergunta', 'reuniao', 'relato', 'oracao', 'video', 'campo', 'criacao'];
const TIPOS_ROTINA = ['leitura', 'estudo', 'familia', 'reuniao'];
const AVISOS = [0, 15, 30, 60];
/** O agendador acorda de 15 em 15 minutos; a janela cobre um tique perdido (reinicio, deploy). */
const JANELA_MIN = 30;
const MAX_MINUTOS = 600;
const HOSTS = ['jw.org', 'www.jw.org', 'wol.jw.org'];
/** Quantos capitulos tem cada livro (Genesis = posicao 0): confere a leitura livre ("43:3"). */
const CAPITULOS = [
    50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4,
    28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
];

const ehDia = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const ehHora = (v) => /^([01]\d|2[0-3]):(00|15|30|45)$/.test(String(v || ''));
const ehItem = (v) => /^[0-9a-z.:-]{1,30}$/.test(String(v || ''));
/** Na leitura livre o trecho e um capitulo de verdade: "43:3" sim, "99:999" nao. */
function ehCapitulo(v) {
    const m = String(v || '').match(/^(\d{1,2}):(\d{1,3})$/);
    return !!m && Number(m[1]) >= 1 && Number(m[1]) <= 66 && Number(m[2]) >= 1 && Number(m[2]) <= CAPITULOS[Number(m[1]) - 1];
}
const hojeISO = (agora = new Date()) => relogioDaCongregacao(agora).toISOString().slice(0, 10);
const minutosDe = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
/** Texto limpo e cortado; vazio vira null. */
const texto = (v, max) => String(v ?? '').trim().slice(0, max) || null;

/**
 * Link do jw.org ou da Biblioteca On-line, so https. Vazio = sem link (null); de outro site =
 * `false`, que o chamador recusa. A regra do ambiente e nunca sair desses dois sites.
 */
function linkDoJw(valor) {
    const t = String(valor || '').trim();
    if (!t) return null;
    if (t.length > 500) return false;
    try {
        const url = new URL(t);
        return url.protocol === 'https:' && HOSTS.includes(url.hostname) ? url.toString() : false;
    } catch {
        return false;
    }
}

/** "tudo", "vermelho", "azul" ou "cat:0" a "cat:10" (as 11 categorias do programa do jw.org). */
const ehOpcao = (v) => ['tudo', 'vermelho', 'azul'].includes(v) || /^cat:(\d|10)$/.test(String(v || ''));

/**
 * O perfil limpo: so o que veio (`undefined` mantem). Devolve { dados } ou { erro }.
 */
function normalizarPerfil(corpo) {
    const c = corpo || {};
    const dados = {};
    if (c.plano !== undefined) {
        if (!PLANOS.includes(c.plano)) return { erro: 'Programa de leitura inválido.' };
        dados.plano = c.plano;
    }
    if (c.opcao !== undefined) {
        if (!ehOpcao(c.opcao)) return { erro: 'Opção do programa inválida.' };
        dados.opcao = c.opcao;
    }
    if (c.inicio !== undefined) {
        if (c.inicio !== null && !ehDia(c.inicio)) return { erro: 'Data de início inválida.' };
        dados.inicio = c.inicio;
    }
    if (c.ritmo !== undefined) {
        if (![1, 2, 3].includes(c.ritmo)) return { erro: 'Ritmo de 1, 2 ou 3 dias por trecho.' };
        dados.ritmo = c.ritmo;
    }
    if (c.planoB !== undefined) {
        if (c.planoB !== null && !ehHora(c.planoB)) return { erro: 'Horário do plano B inválido.' };
        dados.planoB = c.planoB;
    }
    return { dados };
}

/** Um item da rotina limpo. Devolve { dados } ou { erro }. */
function normalizarRotina(corpo) {
    const c = corpo || {};
    if (!TIPOS_ROTINA.includes(c.tipo)) return { erro: 'Tipo de rotina inválido.' };
    const dias = Array.isArray(c.dias) ? [...new Set(c.dias)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort() : [];
    if (!dias.length) return { erro: 'Escolha pelo menos um dia da semana.' };
    if (!ehHora(c.hora)) return { erro: 'Horário de 15 em 15 minutos.' };
    const avisoMin = c.avisoMin === null || c.avisoMin === undefined ? null : c.avisoMin;
    if (avisoMin !== null && !AVISOS.includes(avisoMin)) return { erro: 'Aviso de 0, 15, 30 ou 60 minutos antes.' };
    return { dados: { tipo: c.tipo, dias, hora: c.hora, avisoMin } };
}

/** Um assunto da lista limpo. `parcial` aceita so os campos que vieram. Devolve { dados } ou { erro }. */
function normalizarAssunto(corpo, { parcial = false } = {}) {
    const c = corpo || {};
    const dados = {};
    if (!parcial || c.titulo !== undefined) {
        const titulo = texto(c.titulo, 200);
        if (!titulo) return { erro: 'Escreva o assunto.' };
        dados.titulo = titulo;
    }
    if (!parcial || c.tipo !== undefined) {
        const tipo = c.tipo === undefined ? 'assunto' : c.tipo;
        if (!TIPOS_ASSUNTO.includes(tipo)) return { erro: 'Tipo de assunto inválido.' };
        dados.tipo = tipo;
    }
    if (!parcial || c.link !== undefined) {
        const link = linkDoJw(c.link);
        if (link === false) return { erro: 'Só links do jw.org ou da Biblioteca On-line.' };
        dados.link = link;
    }
    if (!parcial || c.nota !== undefined) dados.nota = texto(c.nota, 1000);
    return { dados };
}

/**
 * A rotina venceu agora? O alvo (a hora menos o aviso) caiu nos ultimos `JANELA_MIN` minutos.
 * Alvo antes da meia-noite (ex.: 00:00 com aviso de 15) fica sem aviso: e raro e cairia no dia
 * anterior.
 */
function venceu(hora, avisoMin, minutoAgora) {
    const alvo = minutosDe(hora) - (avisoMin || 0);
    return alvo >= 0 && alvo <= minutoAgora && alvo > minutoAgora - JANELA_MIN;
}

const TITULOS = {
    leitura: 'Hora da leitura da Bíblia',
    estudo: 'Hora do estudo pessoal',
    familia: 'Hora da adoração em família',
    reuniao: 'Hora de preparar a reunião',
};

/**
 * O texto do aviso, com uma dica dos artigos do jw.org. O do estudo lembra o assunto da vez (o
 * mais antigo da lista): o assunto se escolhe antes, para nao gastar a hora do estudo nisso.
 */
function avisoDaRotina(r, assunto = null) {
    const quando = `Às ${r.hora}.`;
    if (r.tipo === 'leitura') return { titulo: TITULOS.leitura, corpo: `${quando} Ore antes de ler e leia sem pressa.` };
    if (r.tipo === 'estudo') {
        return { titulo: TITULOS.estudo, corpo: `${quando} ${assunto ? `Assunto: ${assunto}. ` : ''}Sem vontade? Comece com 10 minutos.` };
    }
    return { titulo: TITULOS[r.tipo], corpo: quando };
}

/**
 * Ao salvar uma rotina (ou o plano B), o aviso de hoje que ja passou conta como dado. Sem isso,
 * editar as 19:50 o estudo das 20:00 avisaria de novo no tique seguinte.
 */
function avisoDeHojePassou(dias, hora, avisoMin, agora = new Date()) {
    const local = relogioDaCongregacao(agora);
    return dias.includes(local.getUTCDay()) && local.getUTCHours() * 60 + local.getUTCMinutes() >= minutosDe(hora) - (avisoMin || 0);
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

const PERFIL_PADRAO = { plano: 'jw', opcao: 'tudo', inicio: null, ritmo: 1, planoB: null, sessaoInicio: null, sessaoAssuntoId: null };

const publico = (p) => ({
    plano: p.plano,
    opcao: p.opcao,
    inicio: p.inicio,
    ritmo: p.ritmo,
    planoB: p.planoB,
    sessaoInicio: p.sessaoInicio,
    sessaoAssuntoId: p.sessaoAssuntoId,
});

/** Tudo do ambiente de uma vez: e pouco (os trechos lidos sao no maximo alguns milhares). */
async function estado(usuario) {
    const usuarioId = usuario.id;
    const [perfil, leituras, assuntos, sessoes, rotina] = await Promise.all([
        prisma.estudoPerfil.findUnique({ where: { usuarioId } }),
        prisma.leituraFeita.findMany({ where: { usuarioId }, select: { plano: true, item: true, dia: true, nota: true }, orderBy: { id: 'asc' } }),
        prisma.estudoAssunto.findMany({
            where: { usuarioId },
            select: { id: true, titulo: true, tipo: true, link: true, nota: true, estudadoEm: true, createdAt: true },
            orderBy: { id: 'desc' },
        }),
        prisma.estudoSessao.findMany({
            where: { usuarioId },
            select: { id: true, dia: true, minutos: true, assuntoId: true, titulo: true, resumo: true, aplicacao: true },
            orderBy: [{ dia: 'desc' }, { id: 'desc' }],
            take: 60,
        }),
        prisma.estudoRotina.findMany({ where: { usuarioId }, select: { id: true, tipo: true, dias: true, hora: true, avisoMin: true }, orderBy: [{ hora: 'asc' }, { id: 'asc' }] }),
    ]);
    return { hoje: hojeISO(), perfil: perfil ? publico(perfil) : PERFIL_PADRAO, leituras, assuntos, sessoes, rotina };
}

async function atualizarPerfil(usuario, corpo, agora = new Date()) {
    const { dados, erro } = normalizarPerfil(corpo);
    if (erro) return { erro: 400, mensagem: erro };
    if (dados.planoB !== undefined) dados.planoBEm = dados.planoB && avisoDeHojePassou([0, 1, 2, 3, 4, 5, 6], dados.planoB, 0, agora) ? hojeISO(agora) : null;
    const perfil = await prisma.estudoPerfil.upsert({ where: { usuarioId: usuario.id }, create: { usuarioId: usuario.id, ...dados }, update: dados });
    return { perfil: publico(perfil) };
}

/**
 * Marca (ou desmarca) trechos lidos de um programa, em lote. A `nota` (a joia espiritual) vale
 * para um trecho so, e marca ele como lido se ainda nao estava.
 */
async function marcarLeituras(usuario, corpo) {
    const c = corpo || {};
    if (!PLANOS.includes(c.plano)) return { erro: 400, mensagem: 'Programa de leitura inválido.' };
    const itens = Array.isArray(c.itens) ? [...new Set(c.itens)] : [];
    if (!itens.length || itens.length > 200 || !itens.every(c.plano === 'livre' ? ehCapitulo : ehItem)) return { erro: 400, mensagem: 'Trechos inválidos.' };
    const usuarioId = usuario.id;
    if (c.lido === false) {
        await prisma.leituraFeita.deleteMany({ where: { usuarioId, plano: c.plano, item: { in: itens } } });
        return { ok: true };
    }
    const dia = hojeISO();
    if (c.nota !== undefined) {
        if (itens.length !== 1) return { erro: 400, mensagem: 'A anotação é de um trecho só.' };
        const nota = texto(c.nota, 1000);
        await prisma.leituraFeita.upsert({
            where: { usuarioId_plano_item: { usuarioId, plano: c.plano, item: itens[0] } },
            create: { usuarioId, plano: c.plano, item: itens[0], dia, nota },
            update: { nota },
        });
        return { ok: true };
    }
    await prisma.leituraFeita.createMany({ data: itens.map((item) => ({ usuarioId, plano: c.plano, item, dia })), skipDuplicates: true });
    return { ok: true };
}

/** O assunto, se e do usuario. */
const assuntoDele = (usuario, id) => prisma.estudoAssunto.findFirst({ where: { id, usuarioId: usuario.id } });

async function criarAssunto(usuario, corpo) {
    const { dados, erro } = normalizarAssunto(corpo);
    if (erro) return { erro: 400, mensagem: erro };
    const assunto = await prisma.estudoAssunto.create({ data: { ...dados, usuarioId: usuario.id } });
    return { assunto };
}

async function atualizarAssunto(usuario, id, corpo) {
    if (!(await assuntoDele(usuario, id))) return { erro: 404, mensagem: 'Assunto não encontrado.' };
    const { dados, erro } = normalizarAssunto(corpo, { parcial: true });
    if (erro) return { erro: 400, mensagem: erro };
    if (corpo && corpo.estudado !== undefined) dados.estudadoEm = corpo.estudado ? new Date() : null;
    const assunto = await prisma.estudoAssunto.update({ where: { id }, data: dados });
    return { assunto };
}

async function apagarAssunto(usuario, id) {
    const { count } = await prisma.estudoAssunto.deleteMany({ where: { id, usuarioId: usuario.id } });
    return count ? { ok: true } : { erro: 404, mensagem: 'Assunto não encontrado.' };
}

/** Os assuntos novos que surgiram no fim de uma sessao ("acrescente novas ideias"). */
async function novasIdeias(usuario, ideias) {
    const titulos = (Array.isArray(ideias) ? ideias : []).map((t) => texto(t, 200)).filter(Boolean).slice(0, 10);
    if (titulos.length) await prisma.estudoAssunto.createMany({ data: titulos.map((titulo) => ({ usuarioId: usuario.id, titulo })) });
    return titulos.length;
}

/**
 * O estudo pelo cronometro: iniciar, concluir (vira uma sessao, com o resumo) ou descartar.
 * Concluir so vale uma vez: dois toques nao gravam a sessao duas vezes.
 */
async function sessao(usuario, corpo, agora = new Date()) {
    const c = corpo || {};
    const usuarioId = usuario.id;
    if (c.acao === 'iniciar') {
        const assuntoId = Number.isInteger(c.assuntoId) && (await assuntoDele(usuario, c.assuntoId)) ? c.assuntoId : null;
        const atual = await prisma.estudoPerfil.findUnique({ where: { usuarioId } });
        if (atual && atual.sessaoInicio) return { perfil: publico(atual) };
        const perfil = await prisma.estudoPerfil.upsert({
            where: { usuarioId },
            create: { usuarioId, sessaoInicio: agora, sessaoAssuntoId: assuntoId },
            update: { sessaoInicio: agora, sessaoAssuntoId: assuntoId },
        });
        return { perfil: publico(perfil) };
    }
    if (c.acao === 'descartar') {
        await prisma.estudoPerfil.updateMany({ where: { usuarioId }, data: { sessaoInicio: null, sessaoAssuntoId: null } });
        return { ok: true };
    }
    if (c.acao !== 'concluir') return { erro: 400, mensagem: 'Ação inválida.' };
    const perfil = await prisma.estudoPerfil.findUnique({ where: { usuarioId } });
    if (!perfil || !perfil.sessaoInicio) return { erro: 409, mensagem: 'Nenhum estudo em andamento.' };
    const { count } = await prisma.estudoPerfil.updateMany({
        where: { usuarioId, sessaoInicio: perfil.sessaoInicio },
        data: { sessaoInicio: null, sessaoAssuntoId: null },
    });
    if (!count) return { erro: 409, mensagem: 'Este estudo já foi concluído.' };
    const decorridos = Math.max(1, Math.round((agora.getTime() - perfil.sessaoInicio.getTime()) / 60000));
    // O app pode corrigir para menos (esqueceu o cronometro rodando), nunca para mais.
    const minutos = Math.min(Number.isInteger(c.minutos) && c.minutos > 0 ? Math.min(c.minutos, decorridos) : decorridos, MAX_MINUTOS);
    const assunto = perfil.sessaoAssuntoId ? await assuntoDele(usuario, perfil.sessaoAssuntoId) : null;
    const criada = await prisma.estudoSessao.create({
        data: {
            usuarioId,
            dia: hojeISO(perfil.sessaoInicio),
            minutos,
            assuntoId: assunto ? assunto.id : null,
            titulo: assunto ? assunto.titulo : null,
            resumo: texto(c.resumo, 1000),
            aplicacao: texto(c.aplicacao, 1000),
        },
    });
    if (assunto && c.estudado === true) await prisma.estudoAssunto.update({ where: { id: assunto.id }, data: { estudadoEm: agora } });
    const ideias = await novasIdeias(usuario, c.ideias);
    return { sessao: criada, ideias };
}

/** Um estudo ja feito, registrado a mao (sem o cronometro). */
async function registrarSessao(usuario, corpo) {
    const c = corpo || {};
    if (!ehDia(c.dia) || c.dia > hojeISO()) return { erro: 400, mensagem: 'Dia inválido.' };
    if (!Number.isInteger(c.minutos) || c.minutos < 1 || c.minutos > MAX_MINUTOS) return { erro: 400, mensagem: 'De 1 a 600 minutos.' };
    const assunto = Number.isInteger(c.assuntoId) ? await assuntoDele(usuario, c.assuntoId) : null;
    const criada = await prisma.estudoSessao.create({
        data: {
            usuarioId: usuario.id,
            dia: c.dia,
            minutos: c.minutos,
            assuntoId: assunto ? assunto.id : null,
            titulo: assunto ? assunto.titulo : texto(c.titulo, 200),
            resumo: texto(c.resumo, 1000),
            aplicacao: texto(c.aplicacao, 1000),
        },
    });
    return { sessao: criada };
}

async function apagarSessao(usuario, id) {
    const { count } = await prisma.estudoSessao.deleteMany({ where: { id, usuarioId: usuario.id } });
    return count ? { ok: true } : { erro: 404, mensagem: 'Estudo não encontrado.' };
}

async function criarRotina(usuario, corpo, agora = new Date()) {
    const { dados, erro } = normalizarRotina(corpo);
    if (erro) return { erro: 400, mensagem: erro };
    if ((await prisma.estudoRotina.count({ where: { usuarioId: usuario.id } })) >= 20) return { erro: 400, mensagem: 'São no máximo 20 itens na rotina.' };
    const avisadoEm = avisoDeHojePassou(dados.dias, dados.hora, dados.avisoMin, agora) ? hojeISO(agora) : null;
    const rotina = await prisma.estudoRotina.create({ data: { ...dados, avisadoEm, usuarioId: usuario.id } });
    return { rotina };
}

async function atualizarRotina(usuario, id, corpo, agora = new Date()) {
    const { dados, erro } = normalizarRotina(corpo);
    if (erro) return { erro: 400, mensagem: erro };
    const avisadoEm = avisoDeHojePassou(dados.dias, dados.hora, dados.avisoMin, agora) ? hojeISO(agora) : null;
    const { count } = await prisma.estudoRotina.updateMany({ where: { id, usuarioId: usuario.id }, data: { ...dados, avisadoEm } });
    return count ? { ok: true } : { erro: 404, mensagem: 'Item da rotina não encontrado.' };
}

async function apagarRotina(usuario, id) {
    const { count } = await prisma.estudoRotina.deleteMany({ where: { id, usuarioId: usuario.id } });
    return count ? { ok: true } : { erro: 404, mensagem: 'Item da rotina não encontrado.' };
}

const aindaNaoHoje = (campo, hoje) => ({ OR: [{ [campo]: null }, { [campo]: { not: hoje } }] });

/**
 * O tique do agendador: os avisos da rotina que venceram e o plano B de quem ainda nao leu hoje.
 * Marca o dia antes de mandar, como o aviso de revisita: um tique no meio nao repete.
 */
async function avisarRotina(agora = new Date()) {
    const local = relogioDaCongregacao(agora);
    const hoje = local.toISOString().slice(0, 10);
    const minutoAgora = local.getUTCHours() * 60 + local.getUTCMinutes();
    const { enviarPush } = require('./RelatorioCampoService');
    const tokensDe = (usuarioId) => prisma.usuario.findMany({ where: { id: usuarioId }, select: { id: true, pushTokens: { select: { token: true } } } });
    let avisos = 0;

    const itens = await prisma.estudoRotina.findMany({
        where: { dias: { has: local.getUTCDay() }, avisoMin: { not: null }, ...aindaNaoHoje('avisadoEm', hoje) },
        select: { id: true, usuarioId: true, tipo: true, hora: true, avisoMin: true },
    });
    const leuHoje = (usuarioId) => prisma.leituraFeita.count({ where: { usuarioId, dia: hoje } });
    for (const r of itens.filter((x) => venceu(x.hora, x.avisoMin, minutoAgora))) {
        const { count } = await prisma.estudoRotina.updateMany({ where: { id: r.id, ...aindaNaoHoje('avisadoEm', hoje) }, data: { avisadoEm: hoje } });
        // Quem ja leu hoje nao precisa do lembrete da leitura (o dia fica marcado do mesmo jeito).
        if (!count || (r.tipo === 'leitura' && (await leuHoje(r.usuarioId)))) continue;
        const assunto =
            r.tipo === 'estudo'
                ? await prisma.estudoAssunto.findFirst({ where: { usuarioId: r.usuarioId, estudadoEm: null }, orderBy: { id: 'asc' }, select: { titulo: true } })
                : null;
        const { titulo, corpo } = avisoDaRotina(r, assunto && assunto.titulo);
        await enviarPush(await tokensDe(r.usuarioId), titulo, corpo, { screen: 'estudo' });
        avisos += 1;
    }

    const perfis = await prisma.estudoPerfil.findMany({
        where: { planoB: { not: null }, ...aindaNaoHoje('planoBEm', hoje) },
        select: { usuarioId: true, planoB: true },
    });
    for (const p of perfis.filter((x) => venceu(x.planoB, 0, minutoAgora))) {
        const { count } = await prisma.estudoPerfil.updateMany({ where: { usuarioId: p.usuarioId, ...aindaNaoHoje('planoBEm', hoje) }, data: { planoBEm: hoje } });
        // Ja leu hoje: o plano B do dia esta resolvido (marcado acima), sem aviso.
        if (!count || (await leuHoje(p.usuarioId))) continue;
        await enviarPush(await tokensDe(p.usuarioId), 'Ainda dá tempo de ler hoje', 'Para o dia não passar sem a leitura da Bíblia.', { screen: 'estudo' });
        avisos += 1;
    }
    return { avisos };
}

module.exports = {
    estado,
    atualizarPerfil,
    marcarLeituras,
    criarAssunto,
    atualizarAssunto,
    apagarAssunto,
    sessao,
    registrarSessao,
    apagarSessao,
    criarRotina,
    atualizarRotina,
    apagarRotina,
    avisarRotina,
    _internos: { linkDoJw, normalizarPerfil, normalizarRotina, normalizarAssunto, venceu, avisoDaRotina, avisoDeHojePassou, ehItem, ehCapitulo, CAPITULOS },
};
