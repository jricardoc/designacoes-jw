const JwtService = require('../services/JwtService');

function authMiddleware(req, res, next) {
    // Rotas publicas que nao precisam de autenticacao
    const publicRoutes = ['/auth/login', '/health'];
    if (publicRoutes.some(route => req.path.includes(route))) {
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

    const token = parts[1];
    const decoded = JwtService.verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Token invalido ou expirado' });
    }

    // Adicionar usuario decodificado na requisicao
    req.user = decoded;
    return next();
}

module.exports = authMiddleware;
