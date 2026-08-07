const prisma = require('../prisma');
const LembreteDesignacoesService = require('../services/LembreteDesignacoesService');

/**
 * Tokens de push do Expo.
 *
 * O token identifica o APARELHO, nao a pessoa: o mesmo celular pode trocar de dono
 * (alguem faz logout e outro faz login, ou o irmao empresta o telefone). Por isso o
 * registro e um upsert POR TOKEN que reatribui o usuarioId - assim o aparelho nunca
 * fica recebendo as designacoes do dono anterior.
 */

// Os dois prefixos que o Expo emite. Barrar aqui evita gravar lixo que so daria
// erro la na frente, na hora do envio.
const PREFIXOS = ['ExponentPushToken[', 'ExpoPushToken['];

class PushTokenController {
    /** POST /push/token - chamado assim que o app obtem a permissao e o token. */
    async registrar(req, res) {
        try {
            const token = String((req.body && req.body.token) || '').trim();
            if (!PREFIXOS.some(prefixo => token.startsWith(prefixo))) {
                return res.status(400).json({ error: 'Token de push inválido' });
            }

            const platform = req.body.platform ? String(req.body.platform).trim() : null;

            await prisma.pushToken.upsert({
                where: { token },
                update: { usuarioId: req.user.id, platform },
                create: { token, usuarioId: req.user.id, platform }
            });

            return res.json({ ok: true });
        } catch (error) {
            console.error('Erro ao registrar token de push:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    /** DELETE /push/token - chamado no logout, antes de descartar o token de auth. */
    async remover(req, res) {
        try {
            const token = String((req.body && req.body.token) || '').trim();
            if (!token) {
                return res.status(400).json({ error: 'Token é obrigatório' });
            }

            // deleteMany nao estoura quando nao acha nada (o logout precisa ser
            // idempotente), e o filtro por usuarioId impede que alguem derrube a
            // notificacao de outra pessoa mandando o token dela.
            await prisma.pushToken.deleteMany({ where: { token, usuarioId: req.user.id } });

            return res.status(204).send();
        } catch (error) {
            console.error('Erro ao remover token de push:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    /**
     * GET /push/historico - o que o sistema mandou para ESTE usuario, do mais novo
     * para o mais antigo. E o espelho servidor da central de notificacoes: o app
     * junta esta lista com o que capturou localmente, porque push que chegou com o
     * app fechado e foi dispensado da bandeja nao deixa rastro no aparelho.
     */
    async historico(req, res) {
        try {
            const itens = await prisma.notificacaoEnviada.findMany({
                where: { usuarioId: req.user.id },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });

            return res.json({
                historico: itens.map(n => ({
                    id: n.id,
                    titulo: n.titulo,
                    corpo: n.corpo,
                    data: n.data,
                    enviadaEm: n.createdAt,
                })),
            });
        } catch (error) {
            console.error('Erro ao listar historico de notificacoes:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    /**
     * Dispara o lembrete sob demanda, para conferir a corrente inteira sem esperar as 19h.
     *
     * Manda so para QUEM PEDIU por padrao: uma conferencia nao pode virar push na congregacao
     * inteira por descuido. `todos: true` amplia, de proposito explicito.
     *
     * Nao usa nem grava a trava de idempotencia: testar nao pode consumir o lembrete real
     * daquele dia, senao o disparo das 19h acharia que ja avisou e ficaria calado.
     */
    async testar(req, res) {
        try {
            const { dataISO, todos } = req.body || {};

            if (dataISO !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(dataISO))) {
                return res.status(400).json({ error: 'dataISO deve estar no formato YYYY-MM-DD' });
            }

            const resumo = await LembreteDesignacoesService.enviarLembretes({
                dataISO: dataISO ? String(dataISO) : undefined,
                usuarioIds: todos === true ? null : [req.user.id],
                usarTrava: false,
            });

            return res.json({
                ...resumo,
                escopo: todos === true ? 'todos os usuarios com aparelho' : 'somente voce',
                observacao: resumo.enviados === 0
                    ? 'Nada saiu. Confira: o aparelho registrou o token (precisa de build novo e login), o irmao esta vinculado ao usuario, e ha designacao PUBLICADA nessa data.'
                    : 'Push despachado para a API do Expo. No iOS so chega com a chave APNs configurada.',
            });
        } catch (error) {
            console.error('Erro ao testar lembrete:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }
}

module.exports = new PushTokenController();
