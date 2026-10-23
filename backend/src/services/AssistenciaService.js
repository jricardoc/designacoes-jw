/**
 * Regras da assistencia das reunioes, sem banco nem Express (testadas em
 * scripts/verificarAssistencia.js).
 */

const TIPOS = ['meio', 'fds'];

/** Teto de conexoes numa reuniao: acima disso e erro de quem mandou, nao congregacao grande. */
const MAX_CONEXOES = 300;

/**
 * Confere a reuniao contada: data "dd/MM/yyyy" que existe no calendario e tipo meio/fds.
 * Devolve a mensagem de erro, ou null quando esta tudo certo.
 */
function erroDaReuniao(data, tipo) {
    const m = String(data || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return 'Data inválida. Use o formato dd/MM/yyyy.';
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    const valida = new Date(Number(m[3]), mes - 1, dia);
    if (valida.getDate() !== dia || valida.getMonth() !== mes - 1) return 'Data inexistente no calendário.';
    if (!TIPOS.includes(tipo)) return 'Tipo inválido. Use "meio" ou "fds".';
    return null;
}

/**
 * A lista de quem assistiu pelo Zoom, limpa: nome aparado, pessoas entre 1 e 30, mao so com
 * `true`, e um nome so uma vez (sem diferenca de maiusculas; a mao levantada de qualquer
 * repeticao vale). Linha sem nome some. Devolve null quando nao e uma lista aceitavel.
 */
function normalizarPresencas(lista) {
    if (!Array.isArray(lista) || lista.length > MAX_CONEXOES) return null;
    const porNome = new Map();
    for (const p of lista) {
        const nome = String((p && p.nome) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (!nome) continue;
        const chave = nome.toLowerCase();
        const irmaoId = Number(p.irmaoId);
        const pessoas = Math.round(Number(p.pessoas));
        const linha = {
            nome,
            irmaoId: Number.isInteger(irmaoId) && irmaoId > 0 ? irmaoId : null,
            pessoas: Number.isFinite(pessoas) ? Math.min(30, Math.max(1, pessoas)) : 1,
            levantouMao: p.levantouMao === true,
        };
        const ja = porNome.get(chave);
        if (ja) ja.levantouMao = ja.levantouMao || linha.levantouMao;
        else porNome.set(chave, linha);
    }
    return [...porNome.values()];
}

/** O que a lista do Zoom soma, para conferir com o numero contado. */
function resumoZoom(presencas) {
    return {
        zoomConexoes: presencas.length,
        zoomPessoas: presencas.reduce((s, p) => s + (p.pessoas || 0), 0),
        maos: presencas.filter(p => p.levantouMao).length,
    };
}

module.exports = { TIPOS, erroDaReuniao, normalizarPresencas, resumoZoom };
