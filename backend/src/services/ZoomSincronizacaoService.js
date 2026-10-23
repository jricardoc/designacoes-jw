'use strict';

const crypto = require('crypto');
const prisma = require('../prisma');
const Zoom = require('./ZoomApiService');
const { relogioDaCongregacao } = require('./RegrasLembrete');

/**
 * A sincronizacao com o Zoom: terminou a reuniao -> o Zoom avisa (webhook) -> o evento e
 * gravado -> a fila busca na API o resumo, os participantes e a transcricao -> o app mostra.
 *
 * A fila e o banco (ZoomSincronizacao, uma linha por reuniao e parte): sobrevive a restart e a
 * deploy, e o reprocessamento e idempotente (a reuniao e pelo UUID, os participantes sao
 * regravados inteiros, o resumo e sobrescrito com a versao mais nova). Quem anda com a fila e
 * o mesmo agendador dos lembretes (a cada 15 min), mais um disparo logo depois de cada evento
 * e um timer para a proxima tentativa marcada.
 *
 * As regras puras ficam no topo (testadas em scripts/verificarZoom.js).
 */

/**
 * O que cada evento poe na fila: parte -> minutos de espera antes da primeira tentativa.
 * `refazer`: a parte volta a pendente mesmo se ja estava pronta (o resumo foi editado, a
 * transcricao ficou pronta). O fim da reuniao so cria o que falta: o relatorio de
 * participantes leva alguns minutos para sair, e o resumo e a transcricao tem evento proprio
 * (a espera longa e so a rede de seguranca, para quando eles nao chegarem).
 */
const EVENTOS = {
    'meeting.ended': { partes: { participantes: 3, resumo: 20, transcricao: 30 }, refazer: false },
    'meeting.summary_completed': { partes: { resumo: 0 }, refazer: true },
    'meeting.summary_updated': { partes: { resumo: 0 }, refazer: true },
    'meeting.aic_transcript_completed': { partes: { transcricao: 0 }, refazer: true },
};

const PARTES = ['detalhes', 'resumo', 'participantes', 'transcricao'];
/** Falha temporaria (rede, 429, 5xx): ate aqui, depois vira erro. */
const LIMITE_TEMPORARIO = 12;
/** "Ainda nao existe" (relatorio, resumo ou transcricao nao saiu): ate aqui, depois indisponivel. */
const LIMITE_AGUARDANDO = 8;
const ESPERA_MAXIMA_MS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Regras puras
// ---------------------------------------------------------------------------

const digitos = (v) => String(v || '').replace(/\D/g, '');
const hmac = (segredo, texto) => crypto.createHmac('sha256', segredo).update(texto).digest('hex');

/**
 * O Zoom assina cada requisicao: HMAC-SHA256 de "v0:{timestamp}:{corpo cru}" com o secret
 * token do app, em hex, com "v0=" na frente. Sobre os BYTES recebidos: re-serializar o JSON
 * mudaria espacos e ordem e a assinatura nao bateria.
 */
function assinaturaValida(corpoCru, timestamp, assinatura, segredo) {
    if (!segredo || !timestamp || !assinatura || !corpoCru) return false;
    const esperada = Buffer.from(`v0=${hmac(segredo, `v0:${timestamp}:${corpoCru.toString('utf8')}`)}`);
    const recebida = Buffer.from(String(assinatura));
    return recebida.length === esperada.length && crypto.timingSafeEqual(recebida, esperada);
}

/** A resposta ao desafio endpoint.url_validation. */
const respostaValidacao = (plainToken, segredo) => ({ plainToken, encryptedToken: hmac(segredo, plainToken) });

const data = (v) => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
};

/**
 * O que importa de um evento: qual, de que ocorrencia (UUID), a chave que segura repeticao e
 * os dados da reuniao que ja vem nele. Os campos mudam de nome entre eventos (`uuid`/`topic`
 * no fim da reuniao, `meeting_uuid`/`meeting_topic` nos de resumo e transcricao).
 */
function interpretarEvento(corpo) {
    const evento = corpo && typeof corpo.event === 'string' ? corpo.event : '';
    const o = (corpo && corpo.payload && corpo.payload.object) || {};
    const uuid = o.uuid || o.meeting_uuid || null;
    const numero = o.id ?? o.meeting_id ?? null;
    const inicio = data(o.start_time || o.meeting_start_time);
    const fim = data(o.end_time || o.meeting_end_time);
    return {
        evento,
        conhecido: Object.prototype.hasOwnProperty.call(EVENTOS, evento),
        // O Zoom reenvia o MESMO corpo quando nao recebe resposta: mesmo evento, UUID e horario.
        chave: `${evento}|${uuid || '-'}|${(corpo && corpo.event_ts) || '-'}`,
        uuid,
        meetingId: numero !== null && numero !== undefined ? String(numero) : null,
        accountId: (corpo && corpo.payload && corpo.payload.account_id) || null,
        dados: {
            hostId: o.host_id || o.meeting_host_id || null,
            hostEmail: o.host_email || o.meeting_host_email || null,
            topico: o.topic || o.meeting_topic || null,
            inicio,
            fim,
            duracaoMin: inicio && fim ? Math.round((fim - inicio) / 60000) : null,
            fuso: o.timezone || null,
        },
    };
}

/** Espera antes da proxima tentativa: 1, 2, 4, 8... minutos, ate 6 horas. */
const proximaEspera = (tentativas) => Math.min(60_000 * 2 ** Math.max(0, tentativas - 1), ESPERA_MAXIMA_MS);

/**
 * O que fazer com uma falha. `temporario`: tenta de novo (rede, 429, 5xx). `aguardando`: o Zoom
 * ainda nao tem (404 logo depois da reuniao). `indisponivel`: nao vai ter (resumo desligado,
 * plano sem relatorio, reuniao de mais de um ano). `erro`: configuracao a corrigir (credencial,
 * escopo faltando) — volta so quando alguem pedir para sincronizar de novo.
 */
function classificar(erro) {
    if (!(erro instanceof Zoom.ErroZoom)) return 'temporario';
    if (erro.codigo === 'NAO_CONFIGURADO') return 'erro';
    if (erro.temporario) return 'temporario';
    if (erro.status === 404) return 'aguardando';
    if (erro.status === 400 && [200, 300, 3000, 12702].includes(Number(erro.codigo))) return 'indisponivel';
    if (erro.status === 403 && Number(erro.codigo) === 2305) return 'indisponivel';
    return 'erro';
}

/** Linhas de lista do Markdown ("- x", "* x", "1. x"), sem a marca e sem o negrito. */
const itemDeLista = (linha) => {
    const m = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(linha);
    return m ? m[1].replace(/\*\*(.+?)\*\*/g, '$1').trim() : null;
};
/** Item que e so um rotulo em negrito ("- **Conclusion**", "- **Fulano**"): abre um grupo. */
const rotuloDeLista = (linha) => {
    const m = /^\s*[-*+]\s+\*\*(.+?)\*\*:?\s*$/.exec(linha);
    return m ? m[1].trim() : null;
};

const RE_TOPICOS = /t[oó]picos|discuss|assuntos/i;
const RE_PASSOS = /pr[oó]xim|itens de a[cç][aã]o|a[cç][oõ]es|action items|next steps|tarefas/i;
const RE_DECISAO = /decis/i;
const RE_CONCLUSAO = /conclus|decis/i;

/**
 * O que a tela mostra separado, tirado do resumo SEM mexer no original (`summary_content`
 * continua guardado como veio). O Markdown do AI Companion vem em secoes "## ..." (no idioma
 * da reuniao): os topicos sao os "### ..." da secao de topicos discutidos; as decisoes, as
 * "Conclusao" de cada topico e qualquer secao de decisoes; os proximos passos, a secao de
 * itens de acao (ou o `next_steps` antigo da API), com o responsavel na frente.
 */
function extrairDoResumo(resumo) {
    const md = String((resumo && resumo.summary_content) || '');
    const secoes = [];
    let secao = null;
    let topico = null;
    let emConclusao = false;
    let responsavel = null;
    for (const linha of md.replace(/\r/g, '').split('\n')) {
        const h2 = /^##\s+(.+)$/.exec(linha);
        const h3 = /^###\s+(.+)$/.exec(linha);
        if (h2) {
            secao = { titulo: h2[1].trim(), linhas: [], topicos: [] };
            secoes.push(secao);
            topico = null;
            responsavel = null;
            continue;
        }
        if (!secao) continue;
        if (h3) {
            topico = { titulo: h3[1].trim(), descricao: null, itens: [], conclusoes: [] };
            secao.topicos.push(topico);
            emConclusao = false;
            continue;
        }
        const item = itemDeLista(linha);
        if (item === null) {
            if (topico && !topico.descricao && linha.trim()) topico.descricao = linha.trim();
            continue;
        }
        const rotulo = rotuloDeLista(linha);
        const recuo = linha.length - linha.trimStart().length;
        if (topico) {
            if (rotulo) emConclusao = RE_CONCLUSAO.test(rotulo);
            else (emConclusao ? topico.conclusoes : topico.itens).push(item);
            continue;
        }
        if (rotulo && recuo === 0) {
            responsavel = rotulo;
            continue;
        }
        if (recuo === 0) responsavel = null;
        secao.linhas.push(responsavel ? `${responsavel}: ${item}` : item);
    }

    const topicos = secoes.filter((s) => RE_TOPICOS.test(s.titulo)).flatMap((s) => s.topicos);
    const decisoes = [...topicos.flatMap((t) => t.conclusoes), ...secoes.filter((s) => RE_DECISAO.test(s.titulo)).flatMap((s) => s.linhas)];
    let proximosPassos = secoes.filter((s) => RE_PASSOS.test(s.titulo)).flatMap((s) => s.linhas);
    if (proximosPassos.length === 0 && Array.isArray(resumo && resumo.next_steps)) proximosPassos = resumo.next_steps.map(String);
    return { topicos: topicos.map(({ titulo, descricao, itens, conclusoes }) => ({ titulo, descricao, itens, conclusoes })), decisoes, proximosPassos };
}

const DISPOSITIVOS = /\b(iphone|ipad|galaxy|samsung|android|celular|tablet|redmi|xiaomi|motorola|moto\s?g\d*|zoom\s?rooms?)\b/gi;

/** O nome da conexao sem o aparelho: "iPhone de Carlos" -> "Carlos", "Ana (celular)" -> "Ana". */
function limparNomeZoom(nome) {
    return String(nome || '')
        .replace(/\(.*?\)|\[.*?\]/g, ' ')
        .replace(/['’]s\b/gi, ' ')
        .replace(DISPOSITIVOS, ' ')
        .replace(/\b\w*\d\w*\b/g, ' ') // modelo do aparelho ("A52", "13")
        .replace(/^\s*(de|do|da)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * A ocorrencia no calendario da congregacao: a data (dd/MM/yyyy, como em AssistenciaReuniao) e
 * se e do meio ou do fim de semana. Pelo numero do Zoom configurado em Ajustes quando os dois
 * sao diferentes; senao, pelo dia da semana (sabado e domingo, fim de semana).
 */
function reuniaoDaCongregacao({ inicio, meetingId }, zoomConfig) {
    if (!inicio) return null;
    const local = relogioDaCongregacao(new Date(inicio));
    const meio = digitos(zoomConfig && zoomConfig.meio && zoomConfig.meio.id);
    const fds = digitos(zoomConfig && zoomConfig.fds && zoomConfig.fds.id);
    const numero = digitos(meetingId);
    let tipo = null;
    if (meio !== fds) tipo = numero && numero === meio ? 'meio' : numero && numero === fds ? 'fds' : null;
    if (!tipo) tipo = [0, 6].includes(local.getUTCDay()) ? 'fds' : 'meio';
    const dois = (n) => String(n).padStart(2, '0');
    return { tipo, data: `${dois(local.getUTCDate())}/${dois(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}` };
}

/** Pessoa por pessoa: junta as entradas de quem saiu e voltou. */
function consolidarParticipantes(lista) {
    const porPessoa = new Map();
    for (const p of lista) {
        const chave = p.irmaoId ? `i${p.irmaoId}` : p.participanteId ? `z${p.participanteId}` : `n${limparNomeZoom(p.nome).toLowerCase()}`;
        const atual = porPessoa.get(chave);
        if (!atual) {
            porPessoa.set(chave, {
                nome: p.nome,
                nomeZoom: p.nomeZoom || p.nome,
                irmaoId: p.irmaoId || null,
                entrada: p.entrada,
                saida: p.saida,
                duracaoSeg: p.duracaoSeg || 0,
                entradas: 1,
                naSala: p.status !== 'in_waiting_room',
            });
            continue;
        }
        atual.entradas += 1;
        atual.duracaoSeg += p.duracaoSeg || 0;
        if (p.entrada && (!atual.entrada || p.entrada < atual.entrada)) atual.entrada = p.entrada;
        if (p.saida && (!atual.saida || p.saida > atual.saida)) atual.saida = p.saida;
        atual.naSala = atual.naSala || p.status !== 'in_waiting_room';
    }
    return [...porPessoa.values()].sort((a, b) => b.duracaoSeg - a.duracaoSeg || a.nome.localeCompare(b.nome));
}

/** Em que pe a reuniao esta, pelas partes da fila. */
function situacaoDe(sincronizacoes) {
    if (sincronizacoes.some((s) => s.status === 'pendente')) return 'sincronizando';
    if (sincronizacoes.some((s) => s.status === 'erro')) return 'erro';
    return 'ok';
}

// ---------------------------------------------------------------------------
// Banco: eventos e fila
// ---------------------------------------------------------------------------

/** Os numeros das reunioes cadastradas em Ajustes › Zoom (meio e fim de semana). */
async function numerosConfigurados() {
    const config = await prisma.config.findFirst({ select: { zoom: true } });
    const z = (config && config.zoom) || {};
    return new Set([z.meio && z.meio.id, z.fds && z.fds.id].map(digitos).filter(Boolean));
}

/**
 * A conta do Zoom pode ter outras reunioes (do anfitriao, de outra coisa): com os numeros
 * cadastrados em Ajustes, so essas entram. Sem nenhum cadastrado, entra tudo.
 */
async function ehReuniaoDaCongregacao(meetingId) {
    const numeros = await numerosConfigurados();
    return numeros.size === 0 || numeros.has(digitos(meetingId));
}

/** Cria (ou completa) a reuniao. So escreve o que veio preenchido: um evento nao apaga o outro. */
async function guardarReuniao({ uuid, meetingId, accountId, dados }) {
    const preenchidos = Object.fromEntries(Object.entries({ accountId, ...dados }).filter(([, v]) => v !== null && v !== undefined));
    return prisma.zoomReuniao.upsert({
        where: { uuid },
        create: { uuid, meetingId: meetingId || '', ...preenchidos },
        update: { ...(meetingId ? { meetingId } : {}), ...preenchidos },
    });
}

/** Poe partes na fila. `refazer`: volta a pendente mesmo o que ja estava pronto. */
async function enfileirar(reuniaoId, partes, { refazer = false, agora = new Date() } = {}) {
    for (const [parte, esperaMin] of Object.entries(partes)) {
        const proximaTentativa = new Date(agora.getTime() + (esperaMin || 0) * 60_000);
        const novo = { status: 'pendente', tentativas: 0, proximaTentativa, ultimoErro: null, concluidaEm: null };
        const existente = await prisma.zoomSincronizacao.findUnique({ where: { reuniaoId_parte: { reuniaoId, parte } } });
        if (!existente) await prisma.zoomSincronizacao.create({ data: { reuniaoId, parte, ...novo } });
        else if (refazer || existente.status === 'erro') await prisma.zoomSincronizacao.update({ where: { id: existente.id }, data: novo });
    }
    await prisma.zoomReuniao.update({ where: { id: reuniaoId }, data: { sincronizadoEm: null } });
}

/** Leva um evento gravado para a reuniao e a fila. Idempotente. */
async function aplicarEvento(registro, agora = new Date()) {
    const e = interpretarEvento(registro.payload);
    const reuniao = await guardarReuniao(e);
    const { partes, refazer } = EVENTOS[e.evento];
    await enfileirar(reuniao.id, partes, { refazer, agora });
    await prisma.zoomEvento.update({ where: { id: registro.id }, data: { status: 'aplicado', aplicadoEm: agora, ultimoErro: null } });
    return reuniao;
}

/**
 * Grava o evento recebido e, quando e um dos que interessam, aplica. O evento fica gravado
 * ANTES de qualquer outra coisa: se aplicar falhar, ele continua "recebido" e a fila tenta de
 * novo no proximo processamento.
 */
async function registrarEvento(corpo, { agora = new Date() } = {}) {
    const e = interpretarEvento(corpo);
    const daCongregacao = await ehReuniaoDaCongregacao(e.meetingId);
    const util = e.conhecido && !!e.uuid && daCongregacao;
    let registro;
    try {
        registro = await prisma.zoomEvento.create({
            data: {
                chave: e.chave.slice(0, 300),
                evento: e.evento.slice(0, 80) || '(sem nome)',
                meetingUuid: e.uuid,
                meetingId: e.meetingId,
                accountId: e.accountId,
                payload: corpo,
                status: util ? 'recebido' : 'ignorado',
                ultimoErro: e.conhecido && e.uuid && !daCongregacao ? 'Reunião fora das cadastradas em Ajustes › Zoom.' : null,
            },
        });
    } catch (erro) {
        if (erro && erro.code === 'P2002') return { duplicado: true };
        throw erro;
    }
    if (!util) return { ignorado: true };
    try {
        await aplicarEvento(registro, agora);
    } catch (erro) {
        console.error(`[zoom] evento ${e.evento} gravado, aplicação adiada: ${erro.message}`);
        await prisma.zoomEvento.update({ where: { id: registro.id }, data: { ultimoErro: String(erro.message).slice(0, 300) } }).catch(() => {});
    }
    return { registrado: true, evento: e.evento };
}

const CADASTRO_TTL_MS = 5 * 60_000;
let cadastroCache = null;

/** O cadastro preparado para casar nomes (cache curto: muda pouco e a fila roda em lote). */
async function cadastroParaCasar() {
    if (cadastroCache && cadastroCache.em > Date.now() - CADASTRO_TTL_MS) return cadastroCache.lista;
    const { prepararCadastro } = require('./DivisaoGruposService')._internos;
    const lista = prepararCadastro(await prisma.irmao.findMany({ where: { ativo: true }, select: { id: true, nome: true } }));
    cadastroCache = { em: Date.now(), lista };
    return lista;
}

/**
 * O que cada parte busca no Zoom e como grava. Devolve `true` (gravado), `null` (o Zoom ainda
 * nao tem: tenta mais tarde) ou um texto (nao vai ter: indisponivel, com o motivo).
 */
const BUSCAR = {
    async detalhes(r) {
        const d = await Zoom.reuniaoPassada(r.uuid);
        const inicio = data(d.start_time);
        const fim = data(d.end_time);
        await prisma.zoomReuniao.update({
            where: { id: r.id },
            data: {
                ...(d.topic ? { topico: d.topic } : {}),
                ...(inicio ? { inicio } : {}),
                ...(fim ? { fim } : {}),
                ...(d.host_id ? { hostId: d.host_id } : {}),
                ...(d.user_email ? { hostEmail: d.user_email } : {}),
                duracaoMin: Number.isFinite(Number(d.duration)) ? Number(d.duration) : inicio && fim ? Math.round((fim - inicio) / 60000) : null,
            },
        });
        return true;
    },

    async resumo(r) {
        const s = await Zoom.resumo(r.uuid);
        const extraido = extrairDoResumo(s);
        await prisma.zoomReuniao.update({
            where: { id: r.id },
            data: {
                resumoTitulo: s.summary_title || null,
                resumoMarkdown: s.summary_content || null,
                resumoBruto: s,
                resumoEditadoEm: data(s.summary_last_modified_time),
                resumoDocUrl: s.summary_doc_url || null,
                topicos: extraido.topicos,
                decisoes: extraido.decisoes,
                proximosPassos: extraido.proximosPassos,
                ...(r.topico ? {} : s.meeting_topic ? { topico: s.meeting_topic } : {}),
                ...(r.inicio ? {} : data(s.meeting_start_time) ? { inicio: data(s.meeting_start_time) } : {}),
                ...(r.fim ? {} : data(s.meeting_end_time) ? { fim: data(s.meeting_end_time) } : {}),
                ...(r.hostEmail ? {} : s.meeting_host_email ? { hostEmail: s.meeting_host_email } : {}),
            },
        });
        return true;
    },

    async participantes(r) {
        const lista = await Zoom.participantes(r.uuid);
        const { acharPessoa } = require('./DivisaoGruposService')._internos;
        const cadastro = await cadastroParaCasar();
        const linhas = lista.map((p) => {
            const nome = String(p.name || '').trim().slice(0, 120) || '(sem nome)';
            const achado = acharPessoa(limparNomeZoom(nome), cadastro);
            return {
                reuniaoId: r.id,
                zoomUserId: p.user_id ? String(p.user_id) : null,
                participanteId: p.participant_user_id || p.id || null,
                nome,
                entrada: data(p.join_time),
                saida: data(p.leave_time),
                duracaoSeg: Number.isFinite(Number(p.duration)) ? Number(p.duration) : null,
                status: p.status || null,
                irmaoId: achado ? achado.pessoa.id : null,
            };
        });
        // A lista inteira de novo: reprocessar nunca duplica ninguem.
        await prisma.$transaction([
            prisma.zoomParticipante.deleteMany({ where: { reuniaoId: r.id } }),
            ...(linhas.length ? [prisma.zoomParticipante.createMany({ data: linhas })] : []),
            prisma.zoomReuniao.update({ where: { id: r.id }, data: { participantesQtd: consolidarParticipantes(linhas).length } }),
        ]);
        return true;
    },

    async transcricao(r) {
        const { meta, texto } = await Zoom.transcricao(r.uuid);
        // O link de download nao vai para o banco: ele expira e so serve com o token.
        const { download_url: _url, ...semLink } = meta || {};
        if (!texto) {
            const motivo = meta && meta.download_restriction_reason;
            // NOT_READY (ou sem motivo): ainda vai sair. Os outros (apagada, sem dados, nao
            // suportada) nao mudam: indisponivel.
            return !motivo || motivo === 'NOT_READY' ? null : `Transcrição indisponível no Zoom (${motivo}).`;
        }
        await prisma.zoomReuniao.update({ where: { id: r.id }, data: { transcricao: texto, transcricaoBruta: semLink } });
        return true;
    },
};

/** Uma parte da fila: busca, grava e decide o proximo passo. */
async function executar(tarefa, agora = new Date()) {
    const tentativas = tarefa.tentativas + 1;
    const final = (status, ultimoErro = null) =>
        prisma.zoomSincronizacao.update({ where: { id: tarefa.id }, data: { status, tentativas, ultimoErro, concluidaEm: agora } });
    const reagendar = (ultimoErro, esperaMs) =>
        prisma.zoomSincronizacao.update({
            where: { id: tarefa.id },
            data: { tentativas, ultimoErro, proximaTentativa: new Date(agora.getTime() + Math.max(esperaMs || 0, proximaEspera(tentativas))) },
        });

    let pronto;
    try {
        pronto = await BUSCAR[tarefa.parte](tarefa.reuniao);
    } catch (erro) {
        const tipo = classificar(erro);
        const mensagem = String(erro.message || erro).slice(0, 300);
        console.error(`[zoom] ${tarefa.parte} da reunião ${tarefa.reuniaoId} (tentativa ${tentativas}): ${mensagem}`);
        if (tipo === 'temporario') return tentativas >= LIMITE_TEMPORARIO ? final('erro', mensagem) : reagendar(mensagem, erro.esperaMs);
        if (tipo === 'aguardando') {
            return tentativas >= LIMITE_AGUARDANDO
                ? final('indisponivel', `O Zoom não liberou depois de ${tentativas} tentativas. ${mensagem}`)
                : reagendar(`Ainda não disponível no Zoom. ${mensagem}`);
        }
        return final(tipo, mensagem);
    }
    if (typeof pronto === 'string') return final('indisponivel', pronto);
    if (pronto === null) {
        return tentativas >= LIMITE_AGUARDANDO
            ? final('indisponivel', `O Zoom não liberou depois de ${tentativas} tentativas.`)
            : reagendar('Ainda não disponível no Zoom.');
    }
    console.log(`[zoom] ${tarefa.parte} da reunião ${tarefa.reuniaoId} sincronizado.`);
    return final('ok');
}

let rodando = false;
let deNovo = false;
let timer = null;

/** Arma o timer para a proxima tentativa marcada (o tique de 15 min cobre o resto). */
async function agendarProxima() {
    const proxima = await prisma.zoomSincronizacao.findFirst({
        where: { status: 'pendente' },
        orderBy: { proximaTentativa: 'asc' },
        select: { proximaTentativa: true },
    });
    if (timer) clearTimeout(timer);
    timer = null;
    if (!proxima) return;
    const ms = Math.min(Math.max(proxima.proximaTentativa.getTime() - Date.now(), 1000), 15 * 60_000);
    timer = setTimeout(() => processarPendentes().catch((e) => console.error('[zoom] fila:', e.message)), ms);
    timer.unref();
}

/**
 * Anda com a fila: aplica evento que ficou para tras e executa as partes vencidas. Uma rodada
 * por vez (um processo so na API): o que chegar durante a rodada pede outra no fim.
 * ponytail: trava em memoria; com mais de uma instancia da API, trocar por claim no banco.
 */
async function processarPendentes({ agora, limite = 20, agendar = true } = {}) {
    if (rodando) {
        deNovo = true;
        return { ocupado: true };
    }
    rodando = true;
    let feitas = 0;
    try {
        const quando = agora || new Date();
        for (const registro of await prisma.zoomEvento.findMany({ where: { status: 'recebido' }, take: 50, orderBy: { id: 'asc' } })) {
            await aplicarEvento(registro, quando).catch((e) => console.error(`[zoom] evento ${registro.id}: ${e.message}`));
        }
        const tarefas = await prisma.zoomSincronizacao.findMany({
            where: { status: 'pendente', proximaTentativa: { lte: quando } },
            orderBy: { proximaTentativa: 'asc' },
            take: limite,
            include: { reuniao: true },
        });
        // `detalhes` antes das outras: o resumo usa o que ele preenche.
        tarefas.sort((a, b) => PARTES.indexOf(a.parte) - PARTES.indexOf(b.parte));
        for (const t of tarefas) {
            const atual = await prisma.zoomReuniao.findUnique({ where: { id: t.reuniaoId } });
            await executar({ ...t, reuniao: atual }, agora || new Date());
            feitas += 1;
        }
        const reunioes = [...new Set(tarefas.map((t) => t.reuniaoId))];
        for (const id of reunioes) {
            const partes = await prisma.zoomSincronizacao.findMany({ where: { reuniaoId: id }, select: { status: true } });
            if (situacaoDe(partes) !== 'sincronizando') await prisma.zoomReuniao.update({ where: { id }, data: { sincronizadoEm: agora || new Date() } });
        }
        return { feitas };
    } finally {
        rodando = false;
        if (agendar) await agendarProxima().catch(() => {});
        if (deNovo) {
            deNovo = false;
            setImmediate(() => processarPendentes({ agendar }).catch((e) => console.error('[zoom] fila:', e.message)));
        }
    }
}

const pararTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
};

// ---------------------------------------------------------------------------
// Banco: o que o app usa
// ---------------------------------------------------------------------------

const ehDia = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

/** "csv": veio do relatorio exportado (sem resumo nem transcricao); "api": do webhook e da API. */
const origemDe = (uuid) => (String(uuid).startsWith('csv:') ? 'csv' : 'api');

/**
 * Recupera reunioes anteriores: as ocorrencias de cada reuniao conhecida (as de Ajustes ›
 * Zoom e as que ja chegaram por webhook) no periodo, mes a mes, e poe na fila o que falta.
 * `forcar` busca de novo ate o que ja estava pronto.
 */
async function sincronizarPeriodo({ de, ate, forcar = false } = {}) {
    if (!Zoom.configurado()) return { erro: 503, mensagem: 'A integração com o Zoom ainda não foi configurada no servidor.' };
    if (!ehDia(de) || !ehDia(ate) || de > ate) return { erro: 400, mensagem: 'Período inválido (use AAAA-MM-DD).' };
    const configurados = await numerosConfigurados();
    const vistos = (await prisma.zoomReuniao.findMany({ distinct: ['meetingId'], select: { meetingId: true } })).map((r) => digitos(r.meetingId));
    // Com reunioes cadastradas, so elas; senao, as que ja chegaram por webhook.
    const numeros = configurados.size ? configurados : new Set(vistos.filter(Boolean));
    if (numeros.size === 0) return { erro: 400, mensagem: 'Nenhuma reunião do Zoom conhecida: cadastre o ID das reuniões em Ajustes › Zoom.' };

    // Janelas de ate um mes, como o Zoom recomenda para esta consulta.
    const janelas = [];
    for (let inicio = new Date(`${de}T00:00:00Z`); inicio <= new Date(`${ate}T00:00:00Z`); ) {
        const fim = new Date(Math.min(inicio.getTime() + 30 * 86400000, new Date(`${ate}T00:00:00Z`).getTime()));
        janelas.push([inicio.toISOString().slice(0, 10), fim.toISOString().slice(0, 10)]);
        inicio = new Date(fim.getTime() + 86400000);
    }

    const avisos = [];
    let encontradas = 0;
    let novas = 0;
    for (const numero of numeros) {
        for (const [d, a] of janelas) {
            let ocorrencias;
            try {
                ocorrencias = await Zoom.ocorrenciasPassadas(numero, { de: d, ate: a });
            } catch (erro) {
                avisos.push(`Reunião ${numero}: ${erro.message}`);
                break;
            }
            for (const o of ocorrencias) {
                if (!o.uuid) continue;
                encontradas += 1;
                let ja = await prisma.zoomReuniao.findUnique({ where: { uuid: o.uuid }, select: { id: true, topico: true } });
                const inicio = data(o.start_time);
                if (!ja && inicio) {
                    // A mesma ocorrencia importada antes pelo relatorio (CSV) ganha o UUID de verdade.
                    const doCsv = await prisma.zoomReuniao.findFirst({
                        where: { uuid: { startsWith: 'csv:' }, meetingId: numero, inicio: { gte: new Date(inicio.getTime() - 10 * 60_000), lte: new Date(inicio.getTime() + 10 * 60_000) } },
                        select: { id: true, topico: true },
                    });
                    if (doCsv) ja = await prisma.zoomReuniao.update({ where: { id: doCsv.id }, data: { uuid: o.uuid }, select: { id: true, topico: true } });
                }
                if (!ja) novas += 1;
                const r = await guardarReuniao({ uuid: o.uuid, meetingId: numero, dados: { inicio: data(o.start_time) } });
                await enfileirar(r.id, { ...(r.topico ? {} : { detalhes: 0 }), resumo: 0, participantes: 0, transcricao: 0 }, { refazer: forcar });
            }
        }
    }
    setImmediate(() => processarPendentes().catch((e) => console.error('[zoom] fila:', e.message)));
    return { encontradas, novas, avisos };
}

/** Busca de novo o que falta (ou tudo, com `forcar`) de uma reuniao. */
async function sincronizarReuniao(id, { forcar = false } = {}) {
    const r = await prisma.zoomReuniao.findUnique({ where: { id }, select: { id: true, topico: true } });
    if (!r) return { erro: 404 };
    const atuais = await prisma.zoomSincronizacao.findMany({ where: { reuniaoId: id } });
    const partes = { resumo: 0, participantes: 0, transcricao: 0, ...(r.topico ? {} : { detalhes: 0 }) };
    // Sem forcar: so o que nao ficou pronto.
    const alvo = forcar ? partes : Object.fromEntries(Object.entries(partes).filter(([p]) => !atuais.some((a) => a.parte === p && a.status === 'ok')));
    await enfileirar(id, alvo, { refazer: true });
    setImmediate(() => processarPendentes().catch((e) => console.error('[zoom] fila:', e.message)));
    return { ok: true, partes: Object.keys(alvo) };
}

const resumoDaFila = (sincronizacoes) => ({
    situacao: situacaoDe(sincronizacoes),
    partes: Object.fromEntries(sincronizacoes.map((s) => [s.parte, { status: s.status, tentativas: s.tentativas, ultimoErro: s.ultimoErro, proximaTentativa: s.status === 'pendente' ? s.proximaTentativa : null }])),
});

/** A lista do app: mais nova primeiro, com filtro de datas (AAAA-MM-DD) e busca no texto. */
async function listar({ de, ate, busca, pagina } = {}) {
    const where = {};
    // ponytail: fuso fixo de Brasilia nos limites do filtro (a congregacao nao tem horario de verao).
    if (ehDia(de) || ehDia(ate)) {
        where.inicio = {
            ...(ehDia(de) ? { gte: new Date(`${de}T00:00:00-03:00`) } : {}),
            ...(ehDia(ate) ? { lte: new Date(`${ate}T23:59:59-03:00`) } : {}),
        };
    }
    const termo = String(busca || '').trim().slice(0, 80);
    if (termo) {
        where.OR = [
            { topico: { contains: termo, mode: 'insensitive' } },
            { resumoTitulo: { contains: termo, mode: 'insensitive' } },
            { resumoMarkdown: { contains: termo, mode: 'insensitive' } },
            { participantes: { some: { nome: { contains: termo, mode: 'insensitive' } } } },
        ];
    }
    const porPagina = 30;
    const n = Math.max(0, parseInt(pagina, 10) || 0);
    const [total, reunioes] = await Promise.all([
        prisma.zoomReuniao.count({ where }),
        prisma.zoomReuniao.findMany({
            where,
            orderBy: [{ inicio: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
            skip: n * porPagina,
            take: porPagina,
            select: {
                id: true, uuid: true, meetingId: true, topico: true, inicio: true, fim: true, duracaoMin: true,
                resumoTitulo: true, participantesQtd: true, sincronizadoEm: true,
                resumoMarkdown: true,
                decisoes: true, proximosPassos: true,
                sincronizacoes: { select: { parte: true, status: true, tentativas: true, ultimoErro: true, proximaTentativa: true } },
            },
        }),
    ]);
    const config = await prisma.config.findFirst({ select: { zoom: true } });
    return {
        total,
        pagina: n,
        porPagina,
        reunioes: reunioes.map(({ sincronizacoes, resumoMarkdown, decisoes, proximosPassos, ...r }) => ({
            ...r,
            origem: origemDe(r.uuid),
            temResumo: !!resumoMarkdown,
            decisoes: Array.isArray(decisoes) ? decisoes.length : 0,
            proximosPassos: Array.isArray(proximosPassos) ? proximosPassos.length : 0,
            congregacao: reuniaoDaCongregacao(r, config && config.zoom),
            ...resumoDaFila(sincronizacoes),
        })),
    };
}

/** Uma reuniao inteira para a tela (a transcricao vem a parte: pode ser grande). */
async function detalhe(id) {
    const r = await prisma.zoomReuniao.findUnique({
        where: { id },
        include: {
            participantes: { orderBy: [{ entrada: 'asc' }], include: { irmao: { select: { id: true, nome: true } } } },
            sincronizacoes: true,
        },
    });
    if (!r) return null;
    const config = await prisma.config.findFirst({ select: { zoom: true } });
    const congregacao = reuniaoDaCongregacao(r, config && config.zoom);
    const assistencia = congregacao
        ? await prisma.assistenciaReuniao.findUnique({ where: { data_tipo: congregacao }, select: { id: true, presencial: true, zoom: true, _count: { select: { presencasZoom: true } } } })
        : null;
    const { participantes, sincronizacoes, resumoBruto: _bruto, transcricao, transcricaoBruta: _meta, ...dados } = r;
    return {
        ...dados,
        origem: origemDe(r.uuid),
        temTranscricao: !!transcricao,
        congregacao,
        assistencia: assistencia ? { id: assistencia.id, presencial: assistencia.presencial, zoom: assistencia.zoom, lista: assistencia._count.presencasZoom } : null,
        participantes: consolidarParticipantes(participantes.map((p) => ({ ...p, nomeZoom: p.nome, nome: p.irmao ? p.irmao.nome : p.nome }))),
        entradas: participantes.length,
        ...resumoDaFila(sincronizacoes),
    };
}

async function transcricaoDe(id) {
    const r = await prisma.zoomReuniao.findUnique({ where: { id }, select: { transcricao: true } });
    return r ? { texto: r.transcricao || null } : null;
}

/**
 * Leva os participantes para "quem assistiu pelo Zoom" da assistencia daquela reuniao (a data
 * e o tipo saem do horario e do numero da reuniao). JUNTA com a lista que ja existe: quem ja
 * estava fica como estava (pessoas e mao levantada), so entra quem faltava. `soSeExistir`: so
 * quando a contagem daquele dia ja foi registrada.
 */
async function levarParaAssistencia(id, { soSeExistir = false } = {}) {
    const r = await detalhe(id);
    if (!r) return { erro: 404 };
    if (!r.congregacao) return { erro: 400, mensagem: 'A reunião ainda não tem horário: sincronize de novo.' };
    const Assistencia = require('./AssistenciaService');
    const { data: dia, tipo } = r.congregacao;
    const atual = await prisma.assistenciaReuniao.findUnique({
        where: { data_tipo: { data: dia, tipo } },
        include: { presencasZoom: { select: { nome: true, irmaoId: true, pessoas: true, levantouMao: true } } },
    });
    // Na importacao em lote: sem contagem registrada, nao cria assistencia zerada (entraria na media).
    if (!atual && soSeExistir) return { semContagem: true, data: dia, tipo };
    const existentes = atual ? atual.presencasZoom : [];
    const norm = (t) => limparNomeZoom(t).toLowerCase();
    const novos = r.participantes
        .filter((p) => p.naSala)
        .filter((p) => !existentes.some((e) => (p.irmaoId && e.irmaoId === p.irmaoId) || norm(e.nome) === norm(p.nome)))
        .map((p) => ({ nome: p.irmaoId ? p.nome : limparNomeZoom(p.nome) || p.nome, irmaoId: p.irmaoId, pessoas: 1, levantouMao: false }));
    const presencas = Assistencia.normalizarPresencas([...existentes, ...novos]);
    if (!presencas) return { erro: 400, mensagem: 'Lista grande demais para a assistência.' };
    await prisma.$transaction(async (tx) => {
        const a = await tx.assistenciaReuniao.upsert({ where: { data_tipo: { data: dia, tipo } }, update: {}, create: { data: dia, tipo } });
        await tx.presencaZoom.deleteMany({ where: { assistenciaId: a.id } });
        if (presencas.length) await tx.presencaZoom.createMany({ data: presencas.map((p) => ({ ...p, assistenciaId: a.id })) });
    });
    return { data: dia, tipo, adicionados: novos.length, total: presencas.length };
}

/** Como a integracao esta: configurada? quanto na fila? o ultimo evento? */
async function estado() {
    const [pendentes, erros, ultimoEvento] = await Promise.all([
        prisma.zoomSincronizacao.count({ where: { status: 'pendente' } }),
        prisma.zoomSincronizacao.count({ where: { status: 'erro' } }),
        prisma.zoomEvento.findFirst({ where: { status: { not: 'ignorado' } }, orderBy: { id: 'desc' }, select: { evento: true, recebidoEm: true } }),
    ]);
    return {
        api: Zoom.configurado(),
        webhook: !!process.env.ZOOM_WEBHOOK_SECRET_TOKEN,
        pendentes,
        erros,
        ultimoEvento,
    };
}

module.exports = {
    EVENTOS,
    registrarEvento,
    processarPendentes,
    pararTimer,
    sincronizarPeriodo,
    sincronizarReuniao,
    listar,
    detalhe,
    transcricaoDe,
    levarParaAssistencia,
    estado,
    _internos: {
        assinaturaValida,
        respostaValidacao,
        interpretarEvento,
        proximaEspera,
        classificar,
        extrairDoResumo,
        limparNomeZoom,
        reuniaoDaCongregacao,
        consolidarParticipantes,
        situacaoDe,
        cadastroParaCasar,
        ehReuniaoDaCongregacao,
        LIMITE_AGUARDANDO,
        LIMITE_TEMPORARIO,
        /** Ha uma rodada da fila em andamento? (os testes esperam ela acabar) */
        rodando: () => rodando,
    },
};
