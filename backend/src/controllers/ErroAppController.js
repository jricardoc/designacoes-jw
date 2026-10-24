const ErroApp = require('../services/ErroAppService');

/** Os erros do app: qualquer um logado manda os seus; ver e limpar e do admin geral (rotas). */
const responder = (nome, fn) => async (req, res) => {
    try {
        return res.json(await fn(req));
    } catch (e) {
        console.error(`[erros-app] ${nome}:`, e);
        return res.status(500).json({ error: 'Erro ao tratar os erros do app' });
    }
};

module.exports = {
    registrar: responder('registrar', (req) => ErroApp.registrar(req.user, req.body)),
    listar: responder('listar', () => ErroApp.listar()),
    limpar: responder('limpar', () => ErroApp.limpar()),
};
