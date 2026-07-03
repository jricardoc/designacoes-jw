// Deve ser usado SEMPRE depois do authMiddleware, que popula req.user com o
// isAdmin atual do banco. Bloqueia rotas destrutivas/administrativas para
// usuarios comuns.
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Acesso negado. Requer privilegios de administrador.' });
    }
    return next();
}

module.exports = requireAdmin;
