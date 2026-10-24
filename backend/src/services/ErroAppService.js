'use strict';

const crypto = require('crypto');
const prisma = require('../prisma');

/**
 * Os erros que acontecem no app de cada um (a tela que quebrou, a excecao do JS), para o admin
 * ver em Ajustes. Antes, uma atualizacao com defeito so aparecia quando alguem reclamava.
 *
 * O mesmo erro, na mesma tela e na mesma atualizacao, e UMA linha que soma `vezes`: um defeito
 * que todo mundo encontra nao vira mil linhas. Guarda so o que o app mandou (mensagem, pilha,
 * tela, versao) e quem viu por ultimo.
 */

const LIMITE = { mensagem: 500, pilha: 4000, tela: 200, curto: 80 };
/** Quantos erros um envio leva no maximo: o app junta os que ficaram guardados. */
const MAX_POR_ENVIO = 20;

const texto = (v, max) => {
    const t = typeof v === 'string' ? v.trim() : '';
    return t ? t.slice(0, max) : null;
};

/** O que veio do celular, aparado. Sem mensagem nao e erro. */
function normalizar(e) {
    const mensagem = texto(e && e.mensagem, LIMITE.mensagem);
    if (!mensagem) return null;
    return {
        mensagem,
        pilha: texto(e.pilha, LIMITE.pilha),
        tela: texto(e.tela, LIMITE.tela),
        fatal: e.fatal === true,
        plataforma: texto(e.plataforma, LIMITE.curto),
        versaoApp: texto(e.versaoApp, LIMITE.curto),
        updateId: texto(e.updateId, LIMITE.curto),
        canal: texto(e.canal, LIMITE.curto),
    };
}

/**
 * O mesmo erro: mesma mensagem, mesma tela, mesma atualizacao e a mesma primeira linha "at" da
 * pilha (a primeira linha do Hermes repete a mensagem).
 */
function assinatura(e) {
    const linha = (e.pilha || '').split('\n').map(l => l.trim()).find(l => l.startsWith('at ')) || '';
    return crypto.createHash('sha1').update([e.mensagem, e.tela, e.updateId, linha].join('|')).digest('hex');
}

async function guardar(e, usuarioId) {
    const chave = assinatura(e);
    const somar = () => prisma.erroApp.update({
        where: { assinatura: chave },
        data: { vezes: { increment: 1 }, ultimaEm: new Date(), usuarioId },
    });
    const ja = await prisma.erroApp.findUnique({ where: { assinatura: chave }, select: { id: true } });
    if (ja) return somar();
    try {
        return await prisma.erroApp.create({ data: { ...e, assinatura: chave, usuarioId } });
    } catch (erro) {
        // Dois celulares mandaram o mesmo erro novo no mesmo instante: o outro criou, este soma.
        if (erro && erro.code === 'P2002') return somar();
        throw erro;
    }
}

async function registrar(usuario, corpo) {
    const lista = (Array.isArray(corpo && corpo.erros) ? corpo.erros : [])
        .slice(0, MAX_POR_ENVIO)
        .map(normalizar)
        .filter(Boolean);
    for (const e of lista) await guardar(e, usuario.id);
    return { recebidos: lista.length };
}

/** Os 100 mais recentes, com o nome de quem viu por ultimo. */
async function listar() {
    const erros = await prisma.erroApp.findMany({ orderBy: { ultimaEm: 'desc' }, take: 100 });
    const ids = [...new Set(erros.map(e => e.usuarioId).filter(Boolean))];
    const usuarios = ids.length
        ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })
        : [];
    const nome = new Map(usuarios.map(u => [u.id, u.nome]));
    return {
        erros: erros.map(({ assinatura: _a, usuarioId, ...e }) => ({ ...e, usuario: nome.get(usuarioId) ?? null })),
    };
}

async function limpar() {
    const { count } = await prisma.erroApp.deleteMany({});
    return { apagados: count };
}

module.exports = { registrar, listar, limpar, _internos: { normalizar, assinatura, MAX_POR_ENVIO } };
