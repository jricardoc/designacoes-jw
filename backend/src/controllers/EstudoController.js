const Estudo = require('../services/EstudoService');

/**
 * O estudo pessoal. Cada rota mexe so no que e do usuario logado: o servico usa sempre o
 * `req.user`, nunca um id de dono vindo do app.
 */
const responder = (nome, fn) => async (req, res) => {
    try {
        const r = await fn(req);
        if (r && r.erro) return res.status(r.erro).json({ error: r.mensagem || 'Não permitido.' });
        return res.json(r);
    } catch (e) {
        console.error(`[estudo] ${nome}:`, e);
        return res.status(500).json({ error: 'Erro no estudo pessoal' });
    }
};

const id = (req) => parseInt(req.params.id, 10);

module.exports = {
    estado: responder('estado', (req) => Estudo.estado(req.user)),
    perfil: responder('perfil', (req) => Estudo.atualizarPerfil(req.user, req.body)),
    leituras: responder('leituras', (req) => Estudo.marcarLeituras(req.user, req.body)),
    criarAssunto: responder('novo assunto', (req) => Estudo.criarAssunto(req.user, req.body)),
    atualizarAssunto: responder('editar assunto', (req) => Estudo.atualizarAssunto(req.user, id(req), req.body)),
    apagarAssunto: responder('apagar assunto', (req) => Estudo.apagarAssunto(req.user, id(req))),
    sessao: responder('sessão', (req) => Estudo.sessao(req.user, req.body)),
    registrarSessao: responder('registrar estudo', (req) => Estudo.registrarSessao(req.user, req.body)),
    apagarSessao: responder('apagar estudo', (req) => Estudo.apagarSessao(req.user, id(req))),
    criarRotina: responder('nova rotina', (req) => Estudo.criarRotina(req.user, req.body)),
    atualizarRotina: responder('editar rotina', (req) => Estudo.atualizarRotina(req.user, id(req), req.body)),
    apagarRotina: responder('apagar rotina', (req) => Estudo.apagarRotina(req.user, id(req))),
};
