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
    atualizarPerfil: responder('perfil', (req) => Pioneiro.atualizarPerfil(req.user, req.body)),
    agenda: responder('agenda', (req) => Pioneiro.agenda(req.user, req.query)),
    criarPlano: responder('novo plano', (req) => Pioneiro.criarPlano(req.user, req.body)),
    apagarPlano: responder('apagar plano', (req) => Pioneiro.apagarPlano(req.user, id(req))),
    viagens: responder('viagens', (req) => Pioneiro.viagens(req.user, req.query.mes)),
    criarViagem: responder('nova viagem', (req) => Pioneiro.criarViagem(req.user, req.body)),
    apagarViagem: responder('apagar viagem', (req) => Pioneiro.apagarViagem(req.user, id(req))),
    progresso: responder('progresso', (req) => Pioneiro.progresso(req.user, req.query.mes)),
    linkCalendario: responder('calendário', (req) => Pioneiro.linkCalendario(req.user, { trocar: !!(req.body && req.body.trocar) })),

    // Sem login: o app Calendario do celular busca o arquivo sozinho, de hora em hora.
    async calendario(req, res) {
        try {
            const ics = await Pioneiro.calendarioIcs(String(req.params.arquivo || '').replace(/\.ics$/, ''));
            if (!ics) return res.status(404).send('Calendário não encontrado');
            res.set('Content-Type', 'text/calendar; charset=utf-8');
            res.set('Cache-Control', 'private, max-age=900');
            return res.send(ics);
        } catch (e) {
            console.error('[pioneiro] calendário:', e);
            return res.status(500).send('Erro no calendário');
        }
    },
};
