const JwtService = require('../services/JwtService');
const prisma = require('../prisma');

// Rotas publicas que nao exigem autenticacao (comparacao exata, sem includes)
const PUBLIC_ROUTES = ['/auth/login', '/health'];

async function authMiddleware(req, res, next) {
    if (PUBLIC_ROUTES.includes(req.path)) {
        return next();
    }

    // Pegar token do header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Token nao fornecido' });
    }

    // Formato: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Token mal formatado' });
    }

    const decoded = JwtService.verifyToken(parts[1]);

    if (!decoded) {
        return res.status(401).json({ error: 'Token invalido ou expirado' });
    }

    // Revalida o usuario no banco a cada requisicao: garante que ele ainda existe
    // e usa o isAdmin atual. Sem isso, um token de 7 dias manteria acesso/privilegios
    // mesmo apos exclusao ou rebaixamento do usuario.
    try {
        const usuario = await prisma.usuario.findUnique({
            where: { id: decoded.id },
            select: { id: true, nickname: true, nome: true, isAdmin: true }
        });

        if (!usuario) {
            return res.status(401).json({ error: 'Usuario nao encontrado' });
        }

        req.user = usuario;
        return next();
    } catch (error) {
        console.error('Erro ao validar usuario:', error);
        return res.status(500).json({ error: 'Erro interno' });
    }
}

module.exports = authMiddleware;
