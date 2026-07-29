const prisma = require('../prisma');

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
}

module.exports = new PushTokenController();
