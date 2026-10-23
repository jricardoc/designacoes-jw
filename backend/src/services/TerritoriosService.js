'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');
const { relogioDaCongregacao } = require('./RegrasLembrete');
const MyMaps = require('./MyMapsService');

/**
 * Regras dos territorios que nao sao HTTP: situacao no ciclo, "onde paramos", a sincronia com o
 * My Maps, o painel e o S-13. As funcoes puras ficam exportadas em `_internos` para
 * scripts/verificarTerritorios.js.
 */

/** Casa "Nao bater" precisa ser reconfirmada depois disto. */
const DIAS_RECONFIRMAR = 90;
/** Territorio parado ha mais que isto entra no alerta. */
const DIAS_ALERTA = 30;

const TIPOS_MARCACAO = ['parada', 'proximo', 'concluido', 'nao_bater', 'observacao'];
const CASA_TRABALHADA = ['sim', 'nao', 'incerto', 'outro_lugar'];
const TIPOS_AVISO = ['acesso_impedido', 'entrada_outra_rua', 'trecho_pendente', 'outro'];

/** Cores das areas que ninguem escolheu ainda, na ordem. As mesmas do seletor do app. */
const PALETA_AREAS = ['#E53935', '#1E88E5', '#43A047', '#8E24AA', '#FB8C00', '#00ACC1', '#D81B60', '#6D4C41'];

/**
 * { nome: cor } de cada area em uso: a escolhida, ou a proxima cor da paleta que nenhuma outra
 * area usa — assim a area ja aparece colorida no mapa antes de alguem escolher. As areas vao na
 * ordem do primeiro numero, a mesma da lista do app.
 */
function coresDasAreas(territorios, salvas) {
    const escolhidas = salvas || {};
    const nomes = [...new Set(
        [...territorios]
            .sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }))
            .map(t => t.area)
            .filter(Boolean),
    )];
    const usadas = new Set(nomes.map(n => escolhidas[n]).filter(Boolean));
    const livres = PALETA_AREAS.filter(c => !usadas.has(c));
    return Object.fromEntries(nomes.map((nome, i) => [nome, escolhidas[nome] || livres.shift() || PALETA_AREAS[i % PALETA_AREAS.length]]));
}

/** A linha de Config. Instalacao nova pode nao ter: cria com o mesmo padrao do GET /config. */
async function configAtual() {
    return (await prisma.config.findFirst())
        || prisma.config.create({ data: { titulo: 'Quadro de Designações', subtitulo: '', mes: 'JAN' } });
}

/** YYYY-MM-DD de hoje no fuso da congregacao. */
const hojeISO = (agora = new Date()) => relogioDaCongregacao(agora).toISOString().slice(0, 10);

const diasEntre = (deISO, ateISO) =>
    Math.round((Date.parse(`${ateISO}T12:00:00Z`) - Date.parse(`${deISO}T12:00:00Z`)) / 864e5);

const somarDias = (iso, dias) => new Date(Date.parse(`${iso}T12:00:00Z`) + dias * 864e5).toISOString().slice(0, 10);

/** "1" -> "01", "6a" -> "06A", "  12 " -> "12"; texto que nao e numero fica como veio. */
function normalizarNumero(valor) {
    const t = String(valor ?? '').trim().toUpperCase();
    const m = /^0*(\d+)([A-Z]*)$/.exec(t);
    return m ? `${m[1].padStart(2, '0')}${m[2]}` : t;
}

// --- cartoes em imagem (o "cartao original") --------------------------------
//
// Imagens estaticas, uma pasta por instalacao (volume em producao), casadas pelo numero. Sem a
// pasta, nenhum territorio tem cartao — e tudo continua funcionando.

const PASTA_CARTOES = path.join(__dirname, '..', '..', 'public', 'territorios');
const BASE_ARQUIVOS = '/territorios/arquivos';
let cacheCartoes = null;

function cartoes() {
    if (cacheCartoes) return cacheCartoes;
    const manifesto = path.join(PASTA_CARTOES, 'territorios.json');
    const lista = fs.existsSync(manifesto) ? JSON.parse(fs.readFileSync(manifesto, 'utf-8')).territorios : [];
    // Versao por CONTEUDO na URL: o cache de imagem do Android indexa pela URL e nao revalida,
    // entao um cartao re-extraido com o mesmo nome nunca chegaria a quem ja o viu.
    const versao = (arq) => {
        try {
            return crypto.createHash('md5').update(fs.readFileSync(path.join(PASTA_CARTOES, arq))).digest('hex').slice(0, 8);
        } catch {
            return '0';
        }
    };
    const url = (arq) => (arq ? `${BASE_ARQUIVOS}/${arq}?v=${versao(arq)}` : null);
    cacheCartoes = new Map(lista.map((t) => [normalizarNumero(t.numero), {
        localidade: t.localidade,
        imagens: { mapa: url(t.arquivos.mapa), satelite: url(t.arquivos.satelite), thumb: url(t.arquivos.thumb) },
    }]));
    return cacheCartoes;
}

// --- situacao no ciclo --------------------------------------------------------

/**
 * "concluido" | "andamento" | "nao_iniciado" | "sem_registro".
 * So conta o que foi registrado depois de `cicloDesde` e nao foi descartado na revisao.
 */
function situacao(territorio, saidasDoCiclo, temMarcacaoNoCiclo) {
    if (territorio.naoIniciado) return 'nao_iniciado';
    if (saidasDoCiclo.some(s => s.concluiu)) return 'concluido';
    if (saidasDoCiclo.length > 0 || temMarcacaoNoCiclo) return 'andamento';
    return 'sem_registro';
}

/**
 * Onde o grupo parou: a saida mais recente de cada parte (quadra, ou o territorio inteiro),
 * contando so o que veio depois da ultima conclusao. Saida que concluiu zera tudo. Registro em
 * conflito so passa a valer depois que o responsavel o aceita na Revisao.
 * `saidas` em qualquer ordem; devolve da mais recente para a mais antiga.
 */
function ondeParamos(saidas) {
    const ordem = [...saidas]
        .filter(s => s.status === 'ativa')
        .sort((a, b) => b.dia.localeCompare(a.dia) || new Date(b.createdAt) - new Date(a.createdAt));
    const porParte = new Map();
    for (const s of ordem) {
        if (s.concluiu) break;
        const parte = s.quadraId ?? 0;
        if (!porParte.has(parte)) porParte.set(parte, s);
    }
    return [...porParte.values()];
}

/** Nao bater vencida: reconfirmada (ou registrada) ha mais de 90 dias. */
const precisaReconfirmar = (m, agora = new Date()) =>
    m.tipo === 'nao_bater' && agora - new Date(m.reconfirmadaEm || m.marcadaEm) > DIAS_RECONFIRMAR * 864e5;

// --- leitura -------------------------------------------------------------------

const AUTOR = { select: { id: true, nome: true } };

/** Tudo que a lista precisa, numa leitura por tabela (sem N+1). */
async function listar() {
    const [territorios, saidas, marcacoes, designacoes] = await Promise.all([
        prisma.territorio.findMany({
            where: { ativo: true },
            include: { _count: { select: { quadras: { where: { ativo: true } } } } },
        }),
        prisma.registroSaida.findMany({
            where: { status: { not: 'descartada' } },
            select: { territorioId: true, dia: true, concluiu: true, status: true, createdAt: true, autor: AUTOR },
            orderBy: [{ dia: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.marcacao.findMany({
            where: { ativo: true },
            select: { territorioId: true, tipo: true, marcadaEm: true, reconfirmadaEm: true, createdAt: true },
        }),
        prisma.designacaoTerritorio.findMany({
            where: { dia: { gte: hojeISO() } },
            include: { irmao: { select: { id: true, nome: true } } },
            orderBy: { dia: 'asc' },
        }),
    ]);

    const hoje = hojeISO();
    const cards = cartoes();
    const lista = territorios.map((t) => {
        const doTerritorio = saidas.filter(s => s.territorioId === t.id);
        const noCiclo = doTerritorio.filter(s => new Date(s.createdAt) >= t.cicloDesde);
        const marcas = marcacoes.filter(m => m.territorioId === t.id);
        const ultima = doTerritorio[0] || null;
        const naoBater = marcas.filter(m => m.tipo === 'nao_bater');
        const designacao = designacoes.find(d => d.territorioId === t.id);
        return {
            id: t.id,
            numero: t.numero,
            nome: t.nome,
            area: t.area,
            apelidos: t.apelidos,
            // A descricao do cartao: aparece embaixo do titulo na lista.
            observacoes: t.observacoes,
            cor: t.cor,
            quadras: t._count.quadras,
            situacao: situacao(t, noCiclo, marcas.some(m => m.tipo !== 'nao_bater' && new Date(m.createdAt) >= t.cicloDesde)),
            ultimaSaida: ultima ? { dia: ultima.dia, concluiu: ultima.concluiu, autor: ultima.autor?.nome ?? null } : null,
            // Nunca trabalhado conta desde o cadastro: "0 territorios parados" com territorio que
            // ninguem nunca abriu seria mentira.
            diasSemTrabalho: diasEntre(ultima ? ultima.dia : hojeISO(t.createdAt), hoje),
            naoBater: { total: naoBater.length, vencidas: naoBater.filter(m => precisaReconfirmar(m)).length },
            conflitos: doTerritorio.filter(s => s.status === 'conflito').length,
            designacao: designacao ? { id: designacao.id, dia: designacao.dia, dirigente: designacao.irmao.nome } : null,
            imagens: cards.get(normalizarNumero(t.numero))?.imagens ?? null,
        };
    });
    return lista.sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));
}

/** Instalacao que ainda nao importou do My Maps: a lista sai dos cartoes, como antes. */
function listarSoCartoes() {
    return [...cartoes()].map(([numero, c]) => ({
        id: null, numero, nome: c.localidade, area: null, apelidos: null, cor: null, quadras: 0,
        situacao: 'sem_registro', ultimaSaida: null, diasSemTrabalho: null,
        naoBater: { total: 0, vencidas: 0 }, conflitos: 0, designacao: null, imagens: c.imagens,
    })).sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));
}

async function detalhe(numero) {
    const t = await prisma.territorio.findFirst({
        where: { numero: normalizarNumero(numero), ativo: true },
        include: {
            quadras: { where: { ativo: true }, orderBy: [{ ordem: 'asc' }, { id: 'asc' }] },
            avisos: { where: { ativo: true }, orderBy: { createdAt: 'desc' } },
            designacoes: {
                where: { dia: { gte: somarDias(hojeISO(), -60) } },
                include: { irmao: { select: { id: true, nome: true } } },
                orderBy: { dia: 'desc' },
            },
        },
    });
    if (!t) return null;

    const [saidas, marcacoes] = await Promise.all([
        prisma.registroSaida.findMany({
            where: { territorioId: t.id, status: { not: 'descartada' } },
            include: { autor: AUTOR, quadra: { select: { id: true, nome: true } } },
            orderBy: [{ dia: 'desc' }, { createdAt: 'desc' }],
            take: 200,
        }),
        prisma.marcacao.findMany({
            where: {
                territorioId: t.id,
                ativo: true,
                // Os pontos do trabalho valem so no ciclo; o Nao bater vale ate ser retirado.
                OR: [{ tipo: 'nao_bater' }, { createdAt: { gte: t.cicloDesde } }],
            },
            include: { autor: AUTOR },
            orderBy: { marcadaEm: 'desc' },
        }),
    ]);

    const noCiclo = saidas.filter(s => new Date(s.createdAt) >= t.cicloDesde);
    const agora = new Date();
    return {
        id: t.id,
        numero: t.numero,
        nome: t.nome,
        area: t.area,
        apelidos: t.apelidos,
        observacoes: t.observacoes,
        cor: t.cor,
        mymaps: t.mymapsMid ? { mid: t.mymapsMid, camada: t.mymapsCamada } : null,
        cicloDesde: t.cicloDesde,
        naoIniciado: t.naoIniciado,
        situacao: situacao(t, noCiclo, marcacoes.some(m => m.tipo !== 'nao_bater')),
        quadras: t.quadras.map(q => ({ id: q.id, nome: q.nome, cor: q.cor, pontos: q.pontos })),
        ultimaSaida: saidas[0] ? formatarSaida(saidas[0]) : null,
        ondeParamos: ondeParamos(noCiclo).map(formatarSaida),
        marcacoes: marcacoes.map(m => ({
            id: m.id,
            clientKey: m.clientKey,
            tipo: m.tipo,
            lat: m.lat,
            lng: m.lng,
            precisao: m.precisao,
            texto: m.texto,
            quadraId: m.quadraId,
            marcadaEm: m.marcadaEm,
            autor: m.autor,
            reconfirmadaEm: m.reconfirmadaEm,
            precisaReconfirmar: precisaReconfirmar(m, agora),
        })),
        avisos: t.avisos.map(a => ({ id: a.id, tipo: a.tipo, texto: a.texto, createdAt: a.createdAt })),
        designacoes: t.designacoes.map(d => ({ id: d.id, dia: d.dia, concluidoEm: d.concluidoEm, dirigente: d.irmao })),
        conflitos: saidas.filter(s => s.status === 'conflito').length,
        imagens: cartoes().get(normalizarNumero(t.numero))?.imagens ?? null,
    };
}

function formatarSaida(s) {
    return {
        id: s.id,
        dia: s.dia,
        concluiu: s.concluiu,
        ondeParou: s.ondeParou,
        casaTrabalhada: s.casaTrabalhada,
        proximoInicio: s.proximoInicio,
        pendente: s.pendente,
        lat: s.lat,
        lng: s.lng,
        quadra: s.quadra ? { id: s.quadra.id, nome: s.quadra.nome } : null,
        autor: s.autor,
        status: s.status,
        createdAt: s.createdAt,
    };
}

async function historico(territorioId) {
    const [saidas, marcacoes] = await Promise.all([
        prisma.registroSaida.findMany({
            where: { territorioId },
            include: { autor: AUTOR, quadra: { select: { id: true, nome: true } } },
            orderBy: [{ dia: 'desc' }, { createdAt: 'desc' }],
            take: 200,
        }),
        // So as que continuam valendo: removida por engano ou cancelada nao e historia do territorio.
        prisma.marcacao.findMany({
            where: { territorioId, ativo: true },
            include: { autor: AUTOR },
            orderBy: { marcadaEm: 'desc' },
            take: 300,
        }),
    ]);
    return {
        saidas: saidas.map(formatarSaida),
        marcacoes: marcacoes.map(m => ({
            id: m.id, tipo: m.tipo, texto: m.texto, lat: m.lat, lng: m.lng, marcadaEm: m.marcadaEm,
            ativo: m.ativo, autor: m.autor,
        })),
    };
}

// --- My Maps ----------------------------------------------------------------------

/**
 * Atualiza as quadras de um territorio a partir de uma camada, casando POR NOME: quadra que
 * continua no mapa e so atualizada (as saidas e marcacoes ligadas a ela continuam ligadas),
 * quadra nova e criada, quadra que sumiu do mapa e desativada.
 */
async function sincronizarQuadras(tx, territorioId, camada) {
    const atuais = await tx.quadra.findMany({ where: { territorioId } });
    const vistas = new Set();
    for (const [ordem, q] of camada.quadras.entries()) {
        const existente = atuais.find(a => a.nome === q.nome && !vistas.has(a.id));
        if (existente) {
            vistas.add(existente.id);
            await tx.quadra.update({ where: { id: existente.id }, data: { pontos: q.pontos, cor: q.cor, ordem, ativo: true } });
        } else {
            await tx.quadra.create({ data: { territorioId, nome: q.nome, cor: q.cor, pontos: q.pontos, ordem } });
        }
    }
    const sumiram = atuais.filter(a => !vistas.has(a.id) && a.ativo).map(a => a.id);
    if (sumiram.length) await tx.quadra.updateMany({ where: { id: { in: sumiram } }, data: { ativo: false } });
}

/** Baixa e le cada mapa uma vez. Devolve Map mid -> { nomeMapa, camadas } ou { erro }. */
async function lerMapas(mids) {
    const lidos = new Map();
    await Promise.all([...new Set(mids)].map(async (mid) => {
        try {
            lidos.set(mid, MyMaps.lerKml(await MyMaps.baixarKml(mid)));
        } catch (erro) {
            lidos.set(mid, { erro: erro.name === 'TimeoutError' ? 'O Google demorou demais para responder.' : erro.message });
        }
    }));
    return lidos;
}

/** "Atualizar do My Maps": rele todos os mapas de onde algum territorio veio. */
async function atualizarDoMyMaps() {
    const territorios = await prisma.territorio.findMany({ where: { mymapsMid: { not: null } } });
    const mapas = await lerMapas(territorios.map(t => t.mymapsMid));
    const resultado = { atualizados: [], naoEncontrados: [], erros: [] };
    for (const t of territorios) {
        const mapa = mapas.get(t.mymapsMid);
        if (mapa.erro) {
            resultado.erros.push({ numero: t.numero, erro: mapa.erro });
            continue;
        }
        const camada = mapa.camadas.find(c => c.nome === t.mymapsCamada);
        if (!camada) {
            resultado.naoEncontrados.push(t.numero);
            continue;
        }
        await prisma.$transaction(async (tx) => {
            await sincronizarQuadras(tx, t.id, camada);
            await tx.territorio.update({ where: { id: t.id }, data: { cor: camada.cor } });
        });
        resultado.atualizados.push(t.numero);
    }
    return resultado;
}

// --- painel e S-13 ---------------------------------------------------------------

/** Ano de servico: setembro do ano anterior a agosto de `ano`. */
const anoDeServico = (ano) => ({ de: `${ano - 1}-09-01`, ate: `${ano}-08-31` });

async function s13(ano) {
    const { de, ate } = anoDeServico(ano);
    const [territorios, designacoes, conclusoes] = await Promise.all([
        prisma.territorio.findMany({ where: { ativo: true }, select: { id: true, numero: true, nome: true } }),
        prisma.designacaoTerritorio.findMany({
            where: { dia: { gte: de, lte: ate } },
            include: { irmao: { select: { nome: true } } },
            orderBy: { dia: 'asc' },
        }),
        prisma.registroSaida.findMany({
            where: { concluiu: true, status: { not: 'descartada' }, dia: { lt: de } },
            select: { territorioId: true, dia: true },
            orderBy: { dia: 'desc' },
        }),
    ]);
    return {
        ano,
        de,
        ate,
        territorios: territorios
            .sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }))
            .map(t => ({
                numero: t.numero,
                nome: t.nome,
                ultimaConclusao: conclusoes.find(c => c.territorioId === t.id)?.dia ?? null,
                designacoes: designacoes
                    .filter(d => d.territorioId === t.id)
                    .map(d => ({ dirigente: d.irmao.nome, dia: d.dia, concluidoEm: d.concluidoEm })),
            })),
    };
}

async function painel(dias) {
    const hoje = hojeISO();
    const desde = somarDias(hoje, -dias);
    const [lista, saidas, proximas] = await Promise.all([
        listar(),
        prisma.registroSaida.findMany({
            where: { status: { not: 'descartada' }, dia: { gte: somarDias(hoje, -365) } },
            select: { territorioId: true, dia: true, concluiu: true, autor: AUTOR },
        }),
        prisma.designacaoTerritorio.count({ where: { dia: { gte: hoje, lte: somarDias(hoje, 7) } } }),
    ]);
    const noPeriodo = saidas.filter(s => s.dia >= desde);
    const porNumero = new Map(lista.map(t => [t.id, t]));

    // Um dia de trabalho conta uma vez por territorio, mesmo com dois registros no dia.
    const diasTrabalhados = new Map();
    for (const s of noPeriodo) {
        const chave = s.territorioId;
        if (!diasTrabalhados.has(chave)) diasTrabalhados.set(chave, new Set());
        diasTrabalhados.get(chave).add(s.dia);
    }

    const dirigentes = new Map();
    for (const s of noPeriodo) {
        if (!s.autor) continue;
        const d = dirigentes.get(s.autor.id) || { nome: s.autor.nome, saidas: new Set(), territorios: new Set(), ultima: s.dia };
        d.saidas.add(`${s.territorioId}|${s.dia}`);
        d.territorios.add(s.territorioId);
        if (s.dia > d.ultima) d.ultima = s.dia;
        dirigentes.set(s.autor.id, d);
    }

    const porMes = new Map();
    for (const s of saidas) {
        const mes = s.dia.slice(0, 7);
        porMes.set(mes, (porMes.get(mes) || new Set()).add(`${s.territorioId}|${s.dia}`));
    }
    const meses = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.parse(`${hoje.slice(0, 7)}-15T12:00:00Z`));
        d.setUTCMonth(d.getUTCMonth() - i);
        const mes = d.toISOString().slice(0, 7);
        meses.push({ mes, saidas: porMes.get(mes)?.size ?? 0 });
    }

    return {
        dias,
        resumo: {
            total: lista.length,
            trabalhados: diasTrabalhados.size,
            concluidosNoCiclo: lista.filter(t => t.situacao === 'concluido').length,
            designacoesProximos7: proximas,
            naoBaterVencidas: lista.reduce((s, t) => s + t.naoBater.vencidas, 0),
            parados: lista.filter(t => t.diasSemTrabalho >= DIAS_ALERTA).length,
            conflitos: lista.reduce((s, t) => s + t.conflitos, 0),
        },
        maisTrabalhados: [...diasTrabalhados]
            .map(([id, diasSet]) => ({ numero: porNumero.get(id)?.numero, nome: porNumero.get(id)?.nome, dias: diasSet.size }))
            .filter(t => t.numero)
            .sort((a, b) => b.dias - a.dias),
        maisTempoParados: [...lista]
            .sort((a, b) => (b.diasSemTrabalho ?? 0) - (a.diasSemTrabalho ?? 0))
            .map(t => ({ numero: t.numero, nome: t.nome, dias: t.diasSemTrabalho, nunca: !t.ultimaSaida })),
        dirigentes: [...dirigentes.values()]
            .map(d => ({ nome: d.nome, saidas: d.saidas.size, territorios: d.territorios.size, ultima: d.ultima }))
            .sort((a, b) => b.saidas - a.saidas),
        concluidos: noPeriodo
            .filter(s => s.concluiu)
            .map(s => ({ numero: porNumero.get(s.territorioId)?.numero, nome: porNumero.get(s.territorioId)?.nome, dia: s.dia, autor: s.autor?.nome ?? null }))
            .filter(c => c.numero)
            .sort((a, b) => b.dia.localeCompare(a.dia)),
        porMes: meses,
    };
}

// --- aviso diario para quem cuida dos territorios ------------------------------------

const HORA_DO_AVISO = 8;

/**
 * Uma vez por dia, a partir das 8h da congregacao: "N territorios parados ha 30+ dias, M casas
 * Nao bater para reconfirmar", para o admin geral e quem tem a area de territorios. Sem nada a
 * avisar, nao manda nada. A trava de LembreteEnviado (regra "territorios") segura o repetido
 * entre os tiques e entre restarts do container.
 */
async function avisarResponsaveis(agora = new Date()) {
    if (relogioDaCongregacao(agora).getUTCHours() < HORA_DO_AVISO) return;
    const hoje = hojeISO(agora);

    const lista = await listar();
    const parados = lista.filter(t => t.diasSemTrabalho >= DIAS_ALERTA).length;
    const vencidas = lista.reduce((s, t) => s + t.naoBater.vencidas, 0);
    const conflitos = lista.reduce((s, t) => s + t.conflitos, 0);
    if (!parados && !vencidas && !conflitos) return;

    const responsaveis = await prisma.usuario.findMany({
        where: { OR: [{ isAdmin: true }, { escopos: { has: 'territorios' } }] },
        select: { id: true, pushTokens: { select: { token: true } } },
    });
    const avisados = new Set((await prisma.lembreteEnviado.findMany({
        where: { dataISO: hoje, regra: 'territorios' },
        select: { usuarioId: true },
    })).map(l => l.usuarioId));

    const partes = [
        parados && `${parados} território${parados > 1 ? 's' : ''} sem trabalho há ${DIAS_ALERTA} dias ou mais`,
        vencidas && `${vencidas} casa${vencidas > 1 ? 's' : ''} "Não bater" para reconfirmar`,
        conflitos && `${conflitos} registro${conflitos > 1 ? 's' : ''} aguardando revisão`,
    ].filter(Boolean);
    const titulo = 'Territórios';
    const corpo = `${partes.join(' · ')}.`;

    const ExpoPushService = require('./ExpoPushService');
    const mensagens = [];
    const marcar = [];
    for (const u of responsaveis) {
        if (avisados.has(u.id)) continue;
        const registro = await prisma.notificacaoEnviada.create({
            data: { usuarioId: u.id, titulo, corpo, data: { screen: 'territorio' } },
        });
        for (const { token } of u.pushTokens) {
            mensagens.push({ to: token, title: titulo, body: corpo, data: { screen: 'territorio', notifId: registro.id } });
        }
        marcar.push({ usuarioId: u.id, dataISO: hoje, regra: 'territorios' });
    }
    if (marcar.length === 0) return;
    await prisma.lembreteEnviado.createMany({ data: marcar, skipDuplicates: true });
    if (mensagens.length) await ExpoPushService.enviar(mensagens);
}

// --- Aviso de marcacao -------------------------------------------------------------------

/** Id do tipo nas preferencias de notificacao (RegrasLembrete.TIPOS). */
const TIPO_AVISO_MARCACAO = 'territorio';

/** Os mesmos rotulos do app (mobile/src/territorios/constantes.ts). */
const ROTULOS_MARCACAO = {
    parada: 'Paramos aqui',
    proximo: 'Próximo começa aqui',
    concluido: 'Trecho concluído',
    nao_bater: 'Não bater',
    observacao: 'Observação',
};

/** "Rua Vila Romana, 120 - Itapuã, Salvador - CEP 41635-152", a partir do `address` do Nominatim. */
function formatarEndereco(a) {
    if (!a) return null;
    const rua = a.road || a.pedestrian || a.footway || a.residential || null;
    const ruaENumero = rua && a.house_number ? `${rua}, ${a.house_number}` : rua;
    const regiao = [a.suburb || a.neighbourhood || a.quarter || a.city_district, a.city || a.town || a.village]
        .filter(Boolean)
        .join(', ');
    const endereco = ruaENumero && regiao ? `${ruaENumero} - ${regiao}` : ruaENumero || regiao || null;
    return endereco && a.postcode ? `${endereco} - CEP ${a.postcode}` : endereco;
}

/**
 * Endereco de um ponto pelo Nominatim (OpenStreetMap): sem chave, mas a regra de uso e no
 * maximo um pedido por segundo e identificar o app. Os pedidos entram numa fila; uma fila de
 * marcacoes offline que sobe de uma vez nao estoura o limite. Falhou ou demorou: null, e o
 * aviso sai sem a rua.
 */
let filaEnderecos = Promise.resolve();
function enderecoDoPonto(lat, lng) {
    const pedido = filaEnderecos
        .then(async () => {
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=pt-BR&lat=${lat}&lon=${lng}`;
            const r = await fetch(url, {
                headers: { 'User-Agent': 'ServirMais/1.0 (github.com/jricardoc/designacoes-jw)' },
                signal: AbortSignal.timeout(5000),
            });
            return r.ok ? formatarEndereco((await r.json()).address) : null;
        })
        .catch(() => null);
    filaEnderecos = pedido.then(() => new Promise(fim => setTimeout(fim, 1100)));
    return pedido;
}

/**
 * Titulo e corpo do push. No "Nao bater" o endereco e o que o irmao digitou (1a linha do
 * texto; a 2a e a descricao); nos outros, o da rua do ponto.
 */
function montarAvisoMarcacao({ tipo, numero, nomeTerritorio, endereco, quadra, autor, texto }) {
    const [primeira, ...resto] = String(texto || '').split('\n');
    const naoBater = tipo === 'nao_bater';
    const onde = (naoBater && primeira.trim()) || endereco || quadra || 'ponto no mapa';
    const detalhe = (naoBater ? resto.join(' ') : String(texto || '')).trim();
    const linha1 = `${ROTULOS_MARCACAO[tipo] || 'Marcação'}: ${onde}${quadra && quadra !== onde ? ` (${quadra})` : ''}`;
    const linha2 = [autor && `Por ${autor}`, detalhe && `“${detalhe}”`].filter(Boolean).join(' · ');
    return {
        titulo: `Território ${numero}${nomeTerritorio ? ` · ${nomeTerritorio}` : ''}`,
        corpo: linha2 ? `${linha1}\n${linha2}` : linha1,
    };
}

/**
 * Push para quem pode marcar no territorio (admin, area de territorios, dirigentes), menos
 * quem marcou e quem desligou "Marcacoes no territorio" nas preferencias. O toque abre o
 * territorio no ponto marcado.
 */
async function avisarMarcacao(marcacaoId) {
    const m = await prisma.marcacao.findUnique({
        where: { id: marcacaoId },
        include: {
            territorio: { select: { numero: true, nome: true } },
            quadra: { select: { nome: true } },
            autor: { select: { nome: true } },
        },
    });
    if (!m) return;

    const destinatarios = (await prisma.usuario.findMany({
        where: {
            ...(m.autorId ? { id: { not: m.autorId } } : {}),
            OR: [
                { isAdmin: true },
                { escopos: { has: 'territorios' } },
                { irmao: { is: { funcoes: { has: 'dirigente' } } } },
            ],
        },
        select: { id: true, pushTokens: { select: { token: true } }, prefNotificacao: { select: { tipos: true } } },
    })).filter(u => !u.prefNotificacao || u.prefNotificacao.tipos.includes(TIPO_AVISO_MARCACAO));
    if (destinatarios.length === 0) return;

    const endereco = m.tipo !== 'nao_bater' && m.lat !== null ? await enderecoDoPonto(m.lat, m.lng) : null;
    const { titulo, corpo } = montarAvisoMarcacao({
        tipo: m.tipo,
        numero: m.territorio.numero,
        nomeTerritorio: m.territorio.nome,
        endereco,
        quadra: m.quadra ? m.quadra.nome : null,
        autor: m.autor ? m.autor.nome : null,
        texto: m.texto,
    });
    const data = { screen: 'territorio', numero: m.territorio.numero, marcacao: m.id, lat: m.lat, lng: m.lng };

    const ExpoPushService = require('./ExpoPushService');
    const mensagens = [];
    for (const u of destinatarios) {
        const registro = await prisma.notificacaoEnviada.create({ data: { usuarioId: u.id, titulo, corpo, data } });
        for (const { token } of u.pushTokens) {
            mensagens.push({ to: token, title: titulo, body: corpo, data: { ...data, notifId: registro.id } });
        }
    }
    if (mensagens.length) await ExpoPushService.enviar(mensagens);
}

module.exports = {
    DIAS_ALERTA,
    TIPOS_MARCACAO,
    CASA_TRABALHADA,
    TIPOS_AVISO,
    hojeISO,
    normalizarNumero,
    cartoes,
    listar,
    listarSoCartoes,
    detalhe,
    historico,
    lerMapas,
    sincronizarQuadras,
    atualizarDoMyMaps,
    painel,
    s13,
    avisarResponsaveis,
    avisarMarcacao,
    TIPO_AVISO_MARCACAO,
    coresDasAreas,
    configAtual,
    _internos: { situacao, ondeParamos, precisaReconfirmar, diasEntre, somarDias, anoDeServico, formatarEndereco, montarAvisoMarcacao },
};
