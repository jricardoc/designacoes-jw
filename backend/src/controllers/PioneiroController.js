const Pioneiro = require('../services/PioneiroService');

/**
 * A area de pioneiros. Cada rota mexe so no que e do usuario logado (o irmao dele), e o servico
 * recusa quem nao e pioneiro regular nem admin geral.
 */
const responder = (nome, fn) => async (req, res) => {
    try {
        const r = await fn(req);
        if (r && r.erro) return res.status(r.erro).json({ error: r.mensagem || 'Não permitido.' });
        return res.json(r);
    } catch (e) {
        console.error(`[pioneiro] ${nome}:`, e);
        return res.status(500).json({ error: 'Erro na área de pioneiros' });
    }
};

const id = (req) => parseInt(req.params.id, 10);

module.exports = {
    painel: responder('painel', (req) => Pioneiro.painel(req.user, req.query.mes)),
    cronometro: responder('cronômetro', (req) => Pioneiro.cronometro(req.user, req.body && req.body.acao)),
    lancarHoras: responder('lançar horas', (req) => Pioneiro.lancarHoras(req.user, req.body)),
    apagarHoras: responder('apagar horas', (req) => Pioneiro.apagarHoras(req.user, id(req))),
    definirMeta: responder('meta', (req) => Pioneiro.definirMeta(req.user, req.body && req.body.metaMensal)),
    listarRevisitas: responder('revisitas', (req) => Pioneiro.listarRevisitas(req.user, { arquivadas: req.query.arquivadas === '1' })),
    revisita: responder('revisita', (req) => Pioneiro.revisita(req.user, id(req))),
    criarRevisita: responder('nova revisita', (req) => Pioneiro.criarRevisita(req.user, req.body)),
    atualizarRevisita: responder('editar revisita', (req) => Pioneiro.atualizarRevisita(req.user, id(req), req.body)),
    apagarRevisita: responder('apagar revisita', (req) => Pioneiro.apagarRevisita(req.user, id(req))),
    registrarVisita: responder('visita', (req) => Pioneiro.registrarVisita(req.user, id(req), req.body)),
    enviarRelatorio: responder('relatório', (req) => Pioneiro.enviarRelatorio(req.user, req.body)),
};
