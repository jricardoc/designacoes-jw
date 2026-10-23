const Sync = require('../services/ZoomSincronizacaoService');

const erro = (res, status, mensagem) => res.status(status).json({ error: mensagem });

/**
 * A integracao com o Zoom: o webhook (publico, autenticado pela assinatura do Zoom) e as
 * rotas do app (quem cuida das reunioes: admin geral, area "reunioes" e Audio e Video).
 */
class ZoomController {
    /**
     * POST /api/integrations/zoom/webhook — corpo CRU (express.raw em index.js): a assinatura
     * e conferida sobre os bytes recebidos. Responde rapido (o Zoom espera ate 3 s) e deixa a
     * busca na API para a fila.
     */
    async webhook(req, res) {
        const segredo = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
        // 503 e nao 4xx: o Zoom tenta de novo, e nada se perde se o segredo entrar em seguida.
        if (!segredo) return erro(res, 503, 'Webhook do Zoom não configurado');
        const cru = Buffer.isBuffer(req.body) ? req.body : null;
        if (!cru || cru.length === 0) return erro(res, 400, 'Corpo vazio');
        // Toda requisicao do Zoom vem assinada, inclusive o desafio de validacao: conferir
        // antes de responder impede usar o endpoint para calcular HMAC de texto qualquer.
        const assinatura = req.get('x-zm-signature');
        const timestamp = req.get('x-zm-request-timestamp');
        if (!Sync._internos.assinaturaValida(cru, timestamp, assinatura, segredo)) return erro(res, 401, 'Assinatura inválida');

        let corpo;
        try {
            corpo = JSON.parse(cru.toString('utf8'));
        } catch {
            return erro(res, 400, 'JSON inválido');
        }

        if (corpo.event === 'endpoint.url_validation') {
            const plainToken = corpo.payload && corpo.payload.plainToken;
            if (typeof plainToken !== 'string' || !plainToken) return erro(res, 400, 'plainToken ausente');
            return res.json(Sync._internos.respostaValidacao(plainToken, segredo));
        }

        try {
            const r = await Sync.registrarEvento(corpo);
            res.json({ ok: true, ...r });
            if (r.registrado) setImmediate(() => Sync.processarPendentes().catch((e) => console.error('[zoom] fila:', e.message)));
        } catch (e) {
            // Sem gravar o evento, 500: o Zoom reenvia (5 min, 20 min, 1 h).
            console.error('[zoom] falha ao gravar evento:', e.message);
            return erro(res, 500, 'Erro ao registrar o evento');
        }
    }

    /** GET /zoom/estado */
    async estado(req, res) {
        try {
            return res.json(await Sync.estado());
        } catch (e) {
            console.error('[zoom] estado:', e.message);
            return erro(res, 500, 'Erro ao consultar a integração');
        }
    }

    /** GET /zoom/reunioes?de=AAAA-MM-DD&ate=AAAA-MM-DD&busca=&pagina= */
    async listar(req, res) {
        try {
            return res.json(await Sync.listar(req.query));
        } catch (e) {
            console.error('[zoom] listar:', e.message);
            return erro(res, 500, 'Erro ao carregar as reuniões');
        }
    }

    /** GET /zoom/reunioes/:id */
    async detalhe(req, res) {
        try {
            const r = await Sync.detalhe(parseInt(req.params.id, 10));
            if (!r) return erro(res, 404, 'Reunião não encontrada');
            return res.json(r);
        } catch (e) {
            console.error('[zoom] detalhe:', e.message);
            return erro(res, 500, 'Erro ao carregar a reunião');
        }
    }

    /** GET /zoom/reunioes/:id/transcricao */
    async transcricao(req, res) {
        try {
            const r = await Sync.transcricaoDe(parseInt(req.params.id, 10));
            if (!r) return erro(res, 404, 'Reunião não encontrada');
            return res.json(r);
        } catch (e) {
            console.error('[zoom] transcrição:', e.message);
            return erro(res, 500, 'Erro ao carregar a transcrição');
        }
    }

    /** POST /zoom/sincronizar — body: { de, ate, forcar } (recupera reunioes anteriores) */
    async sincronizarPeriodo(req, res) {
        try {
            const { de, ate, forcar } = req.body || {};
            const r = await Sync.sincronizarPeriodo({ de, ate, forcar: forcar === true });
            if (r.erro) return erro(res, r.erro, r.mensagem);
            return res.json(r);
        } catch (e) {
            console.error('[zoom] sincronizar período:', e.message);
            return erro(res, 500, 'Erro ao sincronizar com o Zoom');
        }
    }

    /** POST /zoom/reunioes/:id/sincronizar — body: { forcar } */
    async sincronizarReuniao(req, res) {
        try {
            const r = await Sync.sincronizarReuniao(parseInt(req.params.id, 10), { forcar: !!(req.body && req.body.forcar) });
            if (r.erro) return erro(res, r.erro, 'Reunião não encontrada');
            return res.json(r);
        } catch (e) {
            console.error('[zoom] sincronizar reunião:', e.message);
            return erro(res, 500, 'Erro ao sincronizar a reunião');
        }
    }

    /** POST /zoom/reunioes/:id/assistencia — junta os participantes em "quem assistiu pelo Zoom" */
    async levarParaAssistencia(req, res) {
        try {
            const r = await Sync.levarParaAssistencia(parseInt(req.params.id, 10));
            if (r.erro) return erro(res, r.erro, r.mensagem || 'Reunião não encontrada');
            return res.json(r);
        } catch (e) {
            console.error('[zoom] levar para a assistência:', e.message);
            return erro(res, 500, 'Erro ao preencher a assistência');
        }
    }
}

module.exports = new ZoomController();
