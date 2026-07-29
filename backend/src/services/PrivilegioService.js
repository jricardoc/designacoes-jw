'use strict';

const prisma = require('../prisma');

/**
 * Resolve o privilegio de servico (servo ministerial / anciao) de quem tem acesso ao sistema.
 *
 * `Usuario` e `Irmao` sao tabelas independentes: nao existe chave estrangeira entre elas, e o
 * unico elo possivel e o nome. Por isso o casamento e feito aqui, num lugar so, com
 * normalizacao tolerante (espacos, caixa e acentos) - "José  Santos" casa com "jose santos".
 *
 * Se o nome do usuario nao bater com nenhum irmao, o privilegio simplesmente sai `null` e a
 * interface nao mostra cargo nenhum. E deliberado: preferimos nao exibir cargo a exibir o
 * cargo errado para alguem.
 */

const PRIVILEGIOS = {
    servoMinisterial: { valor: 'servoMinisterial', label: 'Servo Ministerial', abreviacao: 'SM' },
    anciao: { valor: 'anciao', label: 'Ancião', abreviacao: 'A' }
};

/** Marcas de acento que o NFD separa da letra base. Escapada para nao depender do encoding do arquivo. */
const ACENTOS = new RegExp('[\u0300-\u036f]', 'g');

/** trim + minusculas + sem acentos + espacos internos colapsados. */
function normalizarNome(nome) {
    return String(nome || '')
        .normalize('NFD')
        .replace(ACENTOS, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

/**
 * Monta o mapa nomeNormalizado -> privilegio a partir dos irmaos que tem algum.
 * Uma unica query, independentemente de quantos usuarios serao anotados.
 */
async function carregarMapaDePrivilegios() {
    const mapa = new Map();

    try {
        const irmaos = await prisma.irmao.findMany({
            where: { privilegio: { not: null } },
            select: { nome: true, privilegio: true }
        });

        for (const irmao of irmaos) {
            mapa.set(normalizarNome(irmao.nome), irmao.privilegio);
        }
    } catch (error) {
        // O cargo e informativo: se a coluna ainda nao existe no banco (deploy em que o
        // `prisma db push` do container nao rodou), preferimos nao exibir cargo nenhum a
        // derrubar o login e a listagem de usuarios, que dependem desta funcao.
        console.error('Nao foi possivel carregar os privilegios dos irmaos:', error.message);
    }

    return mapa;
}

/** Anota um unico usuario com `privilegio`. */
async function anotarUsuario(usuario) {
    if (!usuario) return usuario;
    const [anotado] = await anotarUsuarios([usuario]);
    return anotado;
}

/** Anota uma lista de usuarios com `privilegio`, sem N+1. */
async function anotarUsuarios(usuarios) {
    if (!Array.isArray(usuarios) || usuarios.length === 0) return usuarios || [];

    const mapa = await carregarMapaDePrivilegios();
    return usuarios.map(u => ({
        ...u,
        privilegio: mapa.get(normalizarNome(u.nome)) || null
    }));
}

module.exports = {
    PRIVILEGIOS,
    normalizarNome,
    carregarMapaDePrivilegios,
    anotarUsuario,
    anotarUsuarios
};
