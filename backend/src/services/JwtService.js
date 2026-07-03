const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    // Falha explicita no boot: sem segredo definido, tokens seriam forjaveis.
    throw new Error('JWT_SECRET nao definido. Configure a variavel de ambiente antes de iniciar o servidor.');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
