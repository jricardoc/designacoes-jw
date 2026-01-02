const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'quadro-designacoes-secret-key-2025';
const JWT_EXPIRES_IN = '7d';

class JwtService {
    generateToken(usuario) {
        return jwt.sign(
            {
                id: usuario.id,
                nickname: usuario.nickname,
                nome: usuario.nome,
                isAdmin: usuario.isAdmin || false
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return null;
        }
    }
}

module.exports = new JwtService();
