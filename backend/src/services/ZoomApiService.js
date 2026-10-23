'use strict';

/**
 * Cliente da API REST do Zoom, com Server-to-Server OAuth.
 *
 * Server-to-Server porque a integracao e de UMA conta (a da congregacao): nao ha usuario de
 * fora autorizando acesso, e o app nao precisa de tela de login no Zoom. O token vale uma hora
 * e nao tem refresh token: quando vence (ou o Zoom responde 401), pede-se outro.
 *
 * Credenciais SO em variavel de ambiente (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET),
 * nunca no app nem no banco. Nenhuma mensagem de erro ou log leva o token.
 *
 * `fetch` nativo (Node 20) de proposito: dependencia nova exige rebuild da imagem (ver
 * AgendadorLembretes).
 */

const API = 'https://api.zoom.us/v2';
const TOKEN_URL = 'https://zoom.us/oauth/token';
/** Espera maxima DENTRO de uma chamada; acima disso a fila reagenda (ver ZoomSincronizacao). */
const ESPERA_MAXIMA_NA_CHAMADA_MS = 30_000;
/** Transcricao maior que isto e cortada: e texto puro e cabe folgado numa reuniao de 2 horas. */
const LIMITE_TRANSCRICAO = 2_000_000;

class ErroZoom extends Error {
    /**
     * @param {string} mensagem sem token nem segredo
     * @param {{status?: number, codigo?: number|string|null, temporario?: boolean, esperaMs?: number|null}} info
     */
    constructor(mensagem, { status = 0, codigo = null, temporario = false, esperaMs = null } = {}) {
        super(mensagem);
        this.name = 'ErroZoom';
        this.status = status;
        this.codigo = codigo;
        this.temporario = temporario;
        this.esperaMs = esperaMs;
    }
}

const credenciais = () => ({
    accountId: process.env.ZOOM_ACCOUNT_ID,
    clientId: process.env.ZOOM_CLIENT_ID,
    clientSecret: process.env.ZOOM_CLIENT_SECRET,
});

const configurado = () => {
    const c = credenciais();
    return !!(c.accountId && c.clientId && c.clientSecret);
};

// ---------------------------------------------------------------------------
// Regras puras
// ---------------------------------------------------------------------------

/**
 * O UUID no caminho da URL. O Zoom exige codificar DUAS vezes o UUID que comeca com "/" ou
 * tem "//"; os outros vao codificados uma vez ("+" e "=" aparecem em quase todos).
 */
function codificarUuid(uuid) {
    const uma = encodeURIComponent(String(uuid));
    return String(uuid).startsWith('/') || String(uuid).includes('//') ? encodeURIComponent(uma) : uma;
}

/** Retry-After em ms: o Zoom manda segundos ou uma data. Null se nao der para ler. */
function esperaDoRetryAfter(valor, agora = Date.now()) {
    if (valor === null || valor === undefined || valor === '') return null;
    const segundos = Number(valor);
    if (Number.isFinite(segundos)) return Math.max(0, segundos * 1000);
    const quando = Date.parse(valor);
    return Number.isFinite(quando) ? Math.max(0, quando - agora) : null;
}

/** 1s, 2s, 4s... dentro da mesma chamada. */
const esperaDaTentativa = (tentativa) => 1000 * 2 ** (tentativa - 1);

/** O texto de uma transcricao WebVTT, sem numeracao nem marcas de tempo: "Fulano: fala". */
function textoDoVtt(vtt) {
    return String(vtt || '')
        .replace(/\r/g, '')
        .split('\n')
        .filter((l) => l.trim() && l.trim() !== 'WEBVTT' && !/^\d+$/.test(l.trim()) && !/-->/.test(l))
        .join('\n');
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let cache = null; // { token, expiraEm }
let pedindo = null; // pedido de token em andamento: chamadas paralelas esperam o mesmo

function invalidarToken() {
    cache = null;
}

async function lerJson(resp) {
    const texto = await resp.text();
    if (!texto) return {};
    try {
        return JSON.parse(texto);
    } catch {
        return { message: texto.slice(0, 200) };
    }
}

async function pedirToken() {
    if (!configurado()) {
        throw new ErroZoom('Integração com o Zoom não configurada no servidor (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET).', { codigo: 'NAO_CONFIGURADO' });
    }
    const { accountId, clientId, clientSecret } = credenciais();
    let resp;
    try {
        resp = await fetch(`${TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
            method: 'POST',
            headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` },
            signal: AbortSignal.timeout(15_000),
        });
    } catch (e) {
        throw new ErroZoom(`Falha de rede ao pedir o token do Zoom (${e.name}).`, { temporario: true });
    }
    const corpo = await lerJson(resp);
    if (!resp.ok || !corpo.access_token) {
        const temporario = resp.status === 429 || resp.status >= 500;
        throw new ErroZoom(`O Zoom recusou o token (${resp.status}${corpo.reason ? `: ${corpo.reason}` : ''}).`, { status: resp.status, temporario });
    }
    cache = { token: corpo.access_token, expiraEm: Date.now() + (Number(corpo.expires_in) || 3600) * 1000 };
    return cache.token;
}

/** O token em cache, ou um novo quando falta menos de 1 minuto para vencer. */
async function token() {
    if (cache && cache.expiraEm - 60_000 > Date.now()) return cache.token;
    if (!pedindo) pedindo = pedirToken().finally(() => (pedindo = null));
    return pedindo;
}

/**
 * GET autenticado. 401 renova o token uma vez; 429, 5xx e falha de rede tentam de novo com
 * espera crescente (respeitando o Retry-After). Esgotado, ou com espera maior que a da
 * chamada, sai um ErroZoom `temporario` com `esperaMs`, e a fila reagenda.
 */
async function chamar(caminho, { query, tentativas = 3, url, comoTexto = false } = {}) {
    const destino = new URL(url || `${API}${caminho}`);
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') destino.searchParams.set(k, String(v));

    let renovou = false;
    for (let tentativa = 1; ; tentativa += 1) {
        let resp;
        try {
            resp = await fetch(destino, { headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(30_000) });
        } catch (e) {
            if (e instanceof ErroZoom) throw e;
            if (tentativa >= tentativas) throw new ErroZoom(`Falha de rede ao falar com o Zoom (${e.name}).`, { temporario: true });
            await dormir(esperaDaTentativa(tentativa));
            continue;
        }
        if (resp.status === 401 && !renovou) {
            renovou = true;
            invalidarToken();
            tentativa -= 1;
            continue;
        }
        if (resp.ok) {
            if (!comoTexto) return lerJson(resp);
            const texto = await resp.text();
            return texto.length > LIMITE_TRANSCRICAO ? texto.slice(0, LIMITE_TRANSCRICAO) : texto;
        }
        const corpo = await lerJson(resp);
        const temporario = resp.status === 429 || resp.status >= 500;
        const esperaMs = esperaDoRetryAfter(resp.headers.get('retry-after'));
        const erro = new ErroZoom(
            `Zoom respondeu ${resp.status}${corpo.code !== undefined ? ` (código ${corpo.code})` : ''}${corpo.message ? `: ${String(corpo.message).slice(0, 200)}` : ''}`,
            { status: resp.status, codigo: corpo.code ?? null, temporario, esperaMs },
        );
        const espera = esperaMs ?? esperaDaTentativa(tentativa);
        if (!temporario || tentativa >= tentativas || espera > ESPERA_MAXIMA_NA_CHAMADA_MS) throw erro;
        await dormir(espera);
    }
}

// ---------------------------------------------------------------------------
// Os endpoints usados
// ---------------------------------------------------------------------------

/** Resumo do AI Companion de uma ocorrencia. Escopo: meeting:read:summary:admin. */
const resumo = (uuid) => chamar(`/meetings/${codificarUuid(uuid)}/meeting_summary`);

/** Detalhes de uma ocorrencia que ja terminou. Escopo: meeting:read:past_meeting:admin. */
const reuniaoPassada = (uuid) => chamar(`/past_meetings/${codificarUuid(uuid)}`);

/**
 * As ocorrencias passadas de uma reuniao (pelo numero), para recuperar relatorios antigos.
 * Escopo: meeting:read:list_past_instances:admin. O Zoom guarda ate 15 meses.
 */
async function ocorrenciasPassadas(meetingId, { de, ate } = {}) {
    const r = await chamar(`/past_meetings/${encodeURIComponent(String(meetingId).replace(/\D/g, ''))}/instances`, { query: de && ate ? { from: de, to: ate } : {} });
    return Array.isArray(r.meetings) ? r.meetings : [];
}

/** Relatorio de participantes, todas as paginas. Escopo: report:read:list_meeting_participants:admin. */
async function participantes(uuid) {
    const todos = [];
    let pagina = null;
    for (let i = 0; i < 50; i += 1) {
        const r = await chamar(`/report/meetings/${codificarUuid(uuid)}/participants`, { query: { page_size: 300, next_page_token: pagina } });
        todos.push(...(Array.isArray(r.participants) ? r.participants : []));
        pagina = r.next_page_token;
        if (!pagina) break;
    }
    return todos;
}

/**
 * A transcricao: os metadados e, quando o Zoom libera o download, o texto. Escopo:
 * cloud_recording:read:meeting_transcript:admin. O token so vai para endereco do Zoom.
 */
async function transcricao(uuid) {
    const meta = await chamar(`/meetings/${codificarUuid(uuid)}/transcript`);
    if (!meta.can_download || !meta.download_url) return { meta, texto: null };
    const host = new URL(meta.download_url).hostname;
    if (host !== 'zoom.us' && !host.endsWith('.zoom.us')) {
        throw new ErroZoom('Link de download da transcrição fora do Zoom: não baixado.');
    }
    const vtt = await chamar(null, { url: meta.download_url, comoTexto: true });
    return { meta, texto: textoDoVtt(vtt) };
}

module.exports = {
    ErroZoom,
    configurado,
    resumo,
    reuniaoPassada,
    ocorrenciasPassadas,
    participantes,
    transcricao,
    invalidarToken,
    _internos: { codificarUuid, esperaDoRetryAfter, esperaDaTentativa, textoDoVtt, token, chamar },
};
