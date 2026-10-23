'use strict';

const prisma = require('../prisma');
const Sync = require('./ZoomSincronizacaoService');

/**
 * O relatorio de uso do Zoom exportado em CSV (zoom.us › Relatorios › Uso › participantes ›
 * Exportar, com os dados da reuniao): uma linha por entrada de participante, com os dados da
 * reuniao repetidos em cada uma.
 *
 * E por aqui que os participantes chegam enquanto a conta nao tem o app da API (criar o app
 * exige admin da conta do Zoom). Cada reuniao vira uma ZoomReuniao como as da API (a chave e
 * "csv:<numero>:<inicio>"), e reimportar o mesmo arquivo nao duplica nada.
 *
 * As regras puras ficam no topo (testadas em scripts/verificarZoom.js).
 */

/** Reuniao com menos pessoas que isto e teste ou sala aberta sem ninguem: fica de fora. */
const MINIMO_PARTICIPANTES = 5;
/** ponytail: horario de Brasilia fixo (o relatorio sai no fuso da conta, e a congregacao nao tem horario de verao). */
const FUSO = '-03:00';

// ---------------------------------------------------------------------------
// Regras puras
// ---------------------------------------------------------------------------

/** CSV (RFC 4180): aspas, aspas dobradas e quebra de linha dentro de aspas. Sem linhas vazias. */
function lerCsv(texto) {
    const t = String(texto || '').replace(/^﻿/, '');
    const linhas = [];
    let linha = [];
    let campo = '';
    let aspas = false;
    for (let i = 0; i < t.length; i += 1) {
        const c = t[i];
        if (aspas) {
            if (c === '"' && t[i + 1] === '"') {
                campo += '"';
                i += 1;
            } else if (c === '"') aspas = false;
            else campo += c;
        } else if (c === '"') aspas = true;
        else if (c === ',') {
            linha.push(campo);
            campo = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && t[i + 1] === '\n') i += 1;
            linha.push(campo);
            linhas.push(linha);
            linha = [];
            campo = '';
        } else campo += c;
    }
    if (campo || linha.length) {
        linha.push(campo);
        linhas.push(linha);
    }
    return linhas.filter((l) => l.some((v) => v.trim()));
}

const chave = (t) =>
    String(t || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();

/** As colunas que importam, em portugues e em ingles (o relatorio sai no idioma da conta). */
const COLUNAS = {
    topico: ['topico', 'topic'],
    numero: ['id', 'meeting id'],
    anfitriao: ['nome do anfitriao', 'host name', 'host'],
    anfitriaoEmail: ['e-mail do anfitriao', 'host email'],
    inicio: ['hora de inicio', 'start time'],
    fim: ['hora de fim', 'end time'],
    nome: ['nome (nome original)', 'name (original name)', 'nome', 'name'],
    entrada: ['ingressar na hora', 'hora de entrada', 'join time'],
    saida: ['hora de saida', 'leave time'],
    salaDeEspera: ['na sala de espera', 'in waiting room'],
};

/**
 * Onde cada coluna esta. "Duracao (minutos)" aparece duas vezes: a primeira e a da reuniao, a
 * ultima a do participante.
 */
function mapearColunas(cabecalho) {
    const nomes = cabecalho.map(chave);
    const mapa = {};
    for (const [campo, opcoes] of Object.entries(COLUNAS)) {
        mapa[campo] = nomes.findIndex((n) => opcoes.includes(n));
    }
    const duracoes = nomes.map((n, i) => (/^(duracao \(minutos\)|duration \(minutes\))$/.test(n) ? i : -1)).filter((i) => i >= 0);
    mapa.duracao = duracoes.length ? duracoes[duracoes.length - 1] : -1;
    mapa.ingles = nomes.includes('topic');
    const faltando = ['numero', 'inicio', 'nome', 'entrada', 'saida'].filter((c) => mapa[c] < 0);
    return { mapa, faltando };
}

/**
 * "30/04/2026 07:13:55 PM" (dd/MM, do relatorio em portugues) ou "04/30/2026 ..." (MM/dd, em
 * ingles), 12 ou 24 horas, no fuso da congregacao.
 */
function dataDoRelatorio(valor, { ingles = false } = {}) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(String(valor || '').trim());
    if (!m) return null;
    const [dia, mes] = ingles ? [m[2], m[1]] : [m[1], m[2]];
    let hora = Number(m[4]);
    if (m[7]) {
        const pm = m[7].toUpperCase() === 'PM';
        hora = hora === 12 ? (pm ? 12 : 0) : pm ? hora + 12 : hora;
    }
    const dois = (n) => String(n).padStart(2, '0');
    const d = new Date(`${m[3]}-${dois(mes)}-${dois(dia)}T${dois(hora)}:${m[5]}:${m[6] || '00'}${FUSO}`);
    return Number.isNaN(d.getTime()) ? null : d;
}

const ROTULO = /\(\s*(host|co-?host|anfitri[aã]o|coanfitri[aã]o)\s*\)\s*$/i;

/**
 * O nome como o Zoom mostra e o original (quando a pessoa trocou: "Maria ( Maria Souza )"),
 * sem o rotulo de anfitriao. Os dois servem para achar a pessoa no cadastro.
 */
function nomesDaLinha(bruto) {
    const sem = String(bruto || '').replace(ROTULO, '').trim();
    const original = /\(([^)]*)\)\s*$/.exec(sem);
    return {
        exibido: Sync._internos.limparNomeZoom(sem) || sem,
        original: original ? original[1].trim() : null,
        anfitriao: ROTULO.test(String(bruto || '')),
    };
}

/**
 * As reunioes do relatorio: as linhas agrupadas por numero e horario de inicio, cada uma com as
 * entradas dos participantes. A linha da propria conta (o anfitriao) nao e pessoa e sai.
 */
function reunioesDoRelatorio(linhas) {
    if (linhas.length < 2) return { reunioes: [], erro: 'Arquivo vazio.' };
    const { mapa, faltando } = mapearColunas(linhas[0]);
    if (faltando.length) return { reunioes: [], erro: 'Não parece o relatório de uso do Zoom (exportado com os participantes).' };
    const col = (l, campo) => (mapa[campo] >= 0 && mapa[campo] < l.length ? l[mapa[campo]].trim() : '');
    const porReuniao = new Map();
    for (const l of linhas.slice(1)) {
        const numero = col(l, 'numero').replace(/\D/g, '');
        const inicio = dataDoRelatorio(col(l, 'inicio'), mapa);
        if (!numero || !inicio) continue;
        const k = `${numero}|${inicio.toISOString()}`;
        if (!porReuniao.has(k)) {
            porReuniao.set(k, {
                meetingId: numero,
                topico: col(l, 'topico') || null,
                anfitriao: col(l, 'anfitriao') || null,
                hostEmail: col(l, 'anfitriaoEmail') || null,
                inicio,
                fim: dataDoRelatorio(col(l, 'fim'), mapa),
                entradas: [],
            });
        }
        const r = porReuniao.get(k);
        const bruto = col(l, 'nome');
        const nomes = nomesDaLinha(bruto);
        // A conta que abriu a reuniao (a da congregacao) nao e um participante.
        if (nomes.anfitriao && r.anfitriao && Sync._internos.limparNomeZoom(bruto).toLowerCase() === Sync._internos.limparNomeZoom(r.anfitriao).toLowerCase()) continue;
        const minutos = Number(col(l, 'duracao').replace(',', '.'));
        r.entradas.push({
            nome: bruto.replace(ROTULO, '').trim() || '(sem nome)',
            nomes,
            entrada: dataDoRelatorio(col(l, 'entrada'), mapa),
            saida: dataDoRelatorio(col(l, 'saida'), mapa),
            duracaoSeg: Number.isFinite(minutos) ? Math.round(minutos * 60) : null,
            // "Na sala de espera: Sim" e o tempo antes de ser admitido: nao e presenca.
            status: /^(sim|yes)$/i.test(col(l, 'salaDeEspera')) ? 'in_waiting_room' : 'in_meeting',
        });
    }
    const reunioes = [...porReuniao.values()].map((r) => ({
        ...r,
        duracaoMin: r.fim ? Math.round((r.fim - r.inicio) / 60000) : null,
        // Pessoas que entraram de fato (fora da sala de espera), pelo nome.
        pessoas: new Set(r.entradas.filter((e) => e.status === 'in_meeting').map((e) => e.nomes.exibido.toLowerCase())).size,
    }));
    return { reunioes };
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

/** O irmao pelo nome exibido e, se nao achar, pelo nome original da conta do Zoom. */
function casar(nomes, cadastro, acharPessoa) {
    for (const n of [nomes.exibido, nomes.original && Sync._internos.limparNomeZoom(nomes.original)].filter(Boolean)) {
        const achado = acharPessoa(n, cadastro);
        if (achado) return achado.pessoa.id;
    }
    return null;
}

/**
 * Importa os arquivos ({ nome, buffer }): grava cada reuniao com os participantes e junta quem
 * participou em "quem assistiu pelo Zoom" da assistencia daquele dia, quando a contagem ja foi
 * registrada (sem contagem, nao cria assistencia zerada: ela entraria na media do mes).
 */
async function importar(arquivos) {
    const { acharPessoa } = require('./DivisaoGruposService')._internos;
    const cadastro = await Sync._internos.cadastroParaCasar();
    const config = await prisma.config.findFirst({ select: { zoom: true } });
    const resultado = { reunioes: [], ignoradas: [], erros: [] };

    for (const arquivo of arquivos) {
        const { reunioes, erro } = reunioesDoRelatorio(lerCsv(arquivo.buffer.toString('utf8')));
        if (erro) {
            resultado.erros.push(`${arquivo.nome}: ${erro}`);
            continue;
        }
        for (const r of reunioes) {
            const quando = Sync._internos.reuniaoDaCongregacao(r, config && config.zoom);
            if (r.pessoas < MINIMO_PARTICIPANTES) {
                resultado.ignoradas.push({ ...quando, pessoas: r.pessoas, motivo: 'poucos participantes' });
                continue;
            }
            if (!(await Sync._internos.ehReuniaoDaCongregacao(r.meetingId))) {
                resultado.ignoradas.push({ ...quando, pessoas: r.pessoas, motivo: 'fora das reuniões de Ajustes › Zoom' });
                continue;
            }
            const uuid = `csv:${r.meetingId}:${r.inicio.toISOString()}`;
            const dados = { meetingId: r.meetingId, topico: r.topico, hostEmail: r.hostEmail, inicio: r.inicio, fim: r.fim, duracaoMin: r.duracaoMin };
            const linhas = r.entradas.map((e) => ({
                nome: e.nome.slice(0, 120),
                entrada: e.entrada,
                saida: e.saida,
                duracaoSeg: e.duracaoSeg,
                status: e.status,
                irmaoId: casar(e.nomes, cadastro, acharPessoa),
            }));
            const reuniao = await prisma.zoomReuniao.upsert({ where: { uuid }, create: { uuid, ...dados }, update: dados });
            // A lista inteira de novo: reimportar nao duplica ninguem.
            await prisma.$transaction([
                prisma.zoomParticipante.deleteMany({ where: { reuniaoId: reuniao.id } }),
                prisma.zoomParticipante.createMany({ data: linhas.map((l) => ({ ...l, reuniaoId: reuniao.id })) }),
                prisma.zoomReuniao.update({
                    where: { id: reuniao.id },
                    data: {
                        participantesQtd: Sync._internos.consolidarParticipantes(linhas.filter((l) => l.status === 'in_meeting')).length,
                        sincronizadoEm: new Date(),
                    },
                }),
            ]);
            const assistencia = await Sync.levarParaAssistencia(reuniao.id, { soSeExistir: true });
            resultado.reunioes.push({
                id: reuniao.id,
                ...quando,
                pessoas: r.pessoas,
                doCadastro: new Set(linhas.filter((l) => l.irmaoId && l.status === 'in_meeting').map((l) => l.irmaoId)).size,
                assistencia: assistencia.semContagem ? null : assistencia.erro ? null : { adicionados: assistencia.adicionados, total: assistencia.total },
            });
        }
    }
    resultado.reunioes.sort((a, b) => String(a.data).split('/').reverse().join('').localeCompare(String(b.data).split('/').reverse().join('')));
    return resultado;
}

module.exports = {
    importar,
    MINIMO_PARTICIPANTES,
    _internos: { lerCsv, mapearColunas, dataDoRelatorio, nomesDaLinha, reunioesDoRelatorio },
};
