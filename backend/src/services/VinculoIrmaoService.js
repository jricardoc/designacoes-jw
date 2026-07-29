'use strict';

const prisma = require('../prisma');
const { normalizarNome } = require('./PrivilegioService');

/**
 * Liga a conta de acesso (`Usuario`) ao cadastro da congregacao (`Irmao`).
 *
 * Sem esse vinculo o sistema so conseguiria casar por nome, o que falha calado justamente
 * onde mais importa: "Henzel D. Almeida" no login e "Henzel Almeida" no cadastro sao a mesma
 * pessoa, e "Helber Dias" nao e irmao nenhum. Por isso o vinculo e um campo de verdade
 * (`Usuario.irmaoId`), e este servico so o preenche automaticamente quando tem certeza.
 *
 * Duas confiancas:
 *   - "exata"    : os nomes normalizados sao iguais;
 *   - "provavel" : os nomes tem os mesmos sobrenomes ignorando iniciais soltas ("D."), e so
 *                  UM irmao no cadastro produz esse conjunto.
 * Qualquer coisa abaixo disso e deixada para o administrador resolver na tela - preferimos
 * um usuario sem vinculo a um irmao vendo as designacoes de outro.
 */

/** Palavras significativas do nome, sem acento, pontuacao nem iniciais soltas. */
function tokensDoNome(nome) {
    return normalizarNome(nome)
        .replace(/[.]/g, '')
        .split(' ')
        .filter(t => t.length > 1);
}

function mesmoConjunto(a, b) {
    if (a.length !== b.length || a.length === 0) return false;
    const ordenado = (xs) => [...xs].sort().join('|');
    return ordenado(a) === ordenado(b);
}

/**
 * Sugere o irmao correspondente a um nome de usuario.
 * @param {string} nomeUsuario
 * @param {Array}  irmaos           lista de { id, nome }
 * @param {Set}    [idsIndisponiveis] irmaos ja vinculados a outra conta
 * @returns {{ irmao: Object, confianca: 'exata'|'provavel' } | null}
 */
function sugerirIrmao(nomeUsuario, irmaos, idsIndisponiveis = new Set()) {
    const livres = irmaos.filter(i => !idsIndisponiveis.has(i.id));
    if (livres.length === 0) return null;

    const alvo = normalizarNome(nomeUsuario);
    if (!alvo) return null;

    const exatos = livres.filter(i => normalizarNome(i.nome) === alvo);
    if (exatos.length === 1) return { irmao: exatos[0], confianca: 'exata' };
    if (exatos.length > 1) return null; // homonimos: nao da para decidir sozinho

    const tokensAlvo = tokensDoNome(nomeUsuario);
    if (tokensAlvo.length === 0) return null;

    const provaveis = livres.filter(i => mesmoConjunto(tokensDoNome(i.nome), tokensAlvo));
    if (provaveis.length === 1) return { irmao: provaveis[0], confianca: 'provavel' };

    return null;
}

/**
 * Vincula automaticamente os usuarios que ainda nao tem irmao.
 * Idempotente: roda a cada boot, so mexe em quem esta sem vinculo e nunca rouba um irmao
 * que ja pertence a outra conta.
 *
 * @returns {Promise<{ vinculados: Array, semSugestao: Array }>}
 */
async function sincronizarUsuarios() {
    const resultado = { vinculados: [], semSugestao: [] };

    let usuarios;
    let irmaos;
    try {
        usuarios = await prisma.usuario.findMany({
            select: { id: true, nome: true, nickname: true, irmaoId: true }
        });
        irmaos = await prisma.irmao.findMany({ select: { id: true, nome: true } });
    } catch (error) {
        // Coluna ainda nao existe (deploy em que o `prisma db push` nao rodou): sair em
        // silencio e melhor que impedir o boot da API.
        console.error('Sincronizacao de irmaos ignorada:', error.message);
        return resultado;
    }

    const ocupados = new Set(usuarios.map(u => u.irmaoId).filter(Boolean));

    for (const usuario of usuarios) {
        if (usuario.irmaoId) continue;

        const sugestao = sugerirIrmao(usuario.nome, irmaos, ocupados);
        if (!sugestao) {
            resultado.semSugestao.push({ id: usuario.id, nome: usuario.nome });
            continue;
        }

        try {
            await prisma.usuario.update({
                where: { id: usuario.id },
                data: { irmaoId: sugestao.irmao.id }
            });
            ocupados.add(sugestao.irmao.id);
            resultado.vinculados.push({
                usuario: usuario.nome,
                irmao: sugestao.irmao.nome,
                confianca: sugestao.confianca
            });
        } catch (error) {
            console.error(`Nao foi possivel vincular ${usuario.nome}:`, error.message);
        }
    }

    if (resultado.vinculados.length > 0) {
        console.log(
            `Vinculo irmao<->usuario: ${resultado.vinculados.length} conta(s) sincronizada(s) ` +
            `(${resultado.vinculados.map(v => `${v.usuario} -> ${v.irmao} [${v.confianca}]`).join(', ')})`
        );
    }
    if (resultado.semSugestao.length > 0) {
        console.log(
            `Vinculo irmao<->usuario: ${resultado.semSugestao.length} conta(s) sem irmao correspondente ` +
            `(${resultado.semSugestao.map(u => u.nome).join(', ')}) - vincule manualmente na tela de Conta.`
        );
    }

    return resultado;
}

module.exports = { tokensDoNome, sugerirIrmao, sincronizarUsuarios };
