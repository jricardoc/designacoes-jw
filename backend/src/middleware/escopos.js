'use strict';

/**
 * Niveis de admin por area.
 *
 * Antes so existia um interruptor (`isAdmin`): ou a pessoa podia mexer em tudo,
 * ou em nada. Agora quem cuida da escala de dirigentes recebe SO os dirigentes,
 * quem importa a programacao recebe SO as reunioes, e assim por diante. Um mesmo
 * usuario pode acumular varios escopos.
 *
 * `isAdmin` continua sendo o ADMIN GERAL e contempla todos os escopos — por isso
 * nao faz sentido (nem e necessario) dar escopo a quem ja e geral.
 *
 * O que NAO virou escopo, e continua exigindo admin geral:
 *   - cadastro de irmaos e configuracoes da congregacao (a base que todas as
 *     areas consomem — mexer nela afeta designacoes, dirigentes e reunioes ao
 *     mesmo tempo);
 *   - gestao de usuarios e de permissoes (quem pode dar acesso e o geral);
 *   - reset do banco e disparo de push de teste.
 */

const ESCOPOS = {
    DESIGNACOES: 'designacoes',
    DIRIGENTES: 'dirigentes',
    REUNIOES: 'reunioes',
    CARRINHO: 'carrinho',
    CONFIRMACOES: 'confirmacoes',
};

/** Os valores aceitos ao conceder escopo a um usuario. */
const ESCOPOS_VALIDOS = Object.values(ESCOPOS);

/** Catalogo para a tela de permissoes desenhar sem duplicar textos aqui e la. */
const CATALOGO_ESCOPOS = [
    {
        id: ESCOPOS.DESIGNACOES,
        label: 'Designações',
        descricao: 'Criar, editar, publicar e excluir os quadros de designações',
    },
    {
        id: ESCOPOS.DIRIGENTES,
        label: 'Dirigentes',
        descricao: 'Escalas de dirigentes, saídas de campo e disponibilidade',
    },
    {
        id: ESCOPOS.REUNIOES,
        label: 'Reuniões',
        descricao: 'Importar e editar a programação das reuniões',
    },
    {
        id: ESCOPOS.CARRINHO,
        label: 'Carrinho',
        descricao: 'Pontos, turnos e publicadores do carrinho',
    },
    {
        id: ESCOPOS.CONFIRMACOES,
        label: 'Confirmações',
        descricao: 'Falar com quem tem parte e anotar quem confirmou',
    },
];

/** Descarta o que nao esta no catalogo e remove repetido. */
function sanearEscopos(valor) {
    if (!Array.isArray(valor)) return [];
    return [...new Set(valor.filter(e => ESCOPOS_VALIDOS.includes(e)))];
}

/**
 * O usuario pode mexer nesta area?
 *
 * Admin geral passa em tudo. `req.user.escopos` pode vir indefinido em token
 * antigo ou usuario carregado antes desta mudanca — tratado como lista vazia.
 */
function temEscopo(user, escopo) {
    if (!user) return false;
    if (user.isAdmin) return true;
    return Array.isArray(user.escopos) && user.escopos.includes(escopo);
}

/**
 * Middleware: exige admin geral OU um dos escopos informados.
 *
 * Usar SEMPRE depois do authMiddleware, que popula `req.user` com o isAdmin e os
 * escopos atuais do banco (revalidados a cada requisicao — rebaixar alguem tem
 * efeito imediato, sem esperar o token expirar).
 */
function requireEscopo(...escopos) {
    return (req, res, next) => {
        if (escopos.some(escopo => temEscopo(req.user, escopo))) return next();
        return res.status(403).json({
            error: 'Acesso negado. Você não tem permissão para esta área.',
            escoposNecessarios: escopos,
        });
    };
}

module.exports = {
    ESCOPOS,
    ESCOPOS_VALIDOS,
    CATALOGO_ESCOPOS,
    sanearEscopos,
    temEscopo,
    requireEscopo,
};
