const prisma = require('../prisma');
const bcrypt = require('bcrypt');
const JwtService = require('../services/JwtService');
const PrivilegioService = require('../services/PrivilegioService');

class AuthController {
    // Login por nickname (nao email)
    async login(req, res) {
        try {
            const { nickname, senha } = req.body;

            if (!nickname || !senha) {
                return res.status(400).json({ error: 'Nickname e senha sao obrigatorios' });
            }

            // Buscar usuario pelo nickname
            const usuario = await prisma.usuario.findUnique({
                where: { nickname }
            });

            if (!usuario) {
                return res.status(401).json({ error: 'Nickname ou senha incorretos' });
            }

            // Verificar senha
            const senhaValida = await bcrypt.compare(senha, usuario.senha);

            if (!senhaValida) {
                return res.status(401).json({ error: 'Nickname ou senha incorretos' });
            }

            // Gerar token JWT
            const token = JwtService.generateToken(usuario);

            return res.json({
                token,
                usuario: await PrivilegioService.anotarUsuario({
                    id: usuario.id,
                    nickname: usuario.nickname,
                    nome: usuario.nome,
                    isAdmin: usuario.isAdmin,
                    escopos: usuario.escopos || [],
                    irmaoId: usuario.irmaoId
                })
            });
        } catch (error) {
            console.error('Erro no login:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    async me(req, res) {
        try {
            // req.user vem do middleware de autenticacao
            const usuario = await prisma.usuario.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    nickname: true,
                    nome: true,
                    isAdmin: true,
                    escopos: true,
                    irmaoId: true,
                    createdAt: true
                }
            });

            if (!usuario) {
                return res.status(404).json({ error: 'Usuario nao encontrado' });
            }

            return res.json(await PrivilegioService.anotarUsuario(usuario));
        } catch (error) {
            console.error('Erro ao buscar usuario:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    async alterarSenha(req, res) {
        try {
            const { senhaAtual, novaSenha } = req.body;

            if (!senhaAtual || !novaSenha) {
                return res.status(400).json({ error: 'Senhas sao obrigatorias' });
            }

            const usuario = await prisma.usuario.findUnique({
                where: { id: req.user.id }
            });

            const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);

            if (!senhaValida) {
                return res.status(400).json({ error: 'Senha atual incorreta' });
            }

            const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

            await prisma.usuario.update({
                where: { id: req.user.id },
                data: { senha: novaSenhaHash }
            });

            return res.json({ message: 'Senha alterada com sucesso' });
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    async alterarNome(req, res) {
        try {
            const { nome } = req.body;

            if (!nome || !nome.trim()) {
                return res.status(400).json({ error: 'Nome é obrigatório' });
            }

            const atualizado = await prisma.usuario.update({
                where: { id: req.user.id },
                data: { nome: nome.trim() },
                select: { id: true, nome: true, nickname: true, isAdmin: true, escopos: true, irmaoId: true }
            });

            // Trocar o nome pode passar a casar (ou deixar de casar) com um irmao cadastrado,
            // entao o cargo e reavaliado aqui.
            return res.json(await PrivilegioService.anotarUsuario(atualizado));
        } catch (error) {
            console.error('Erro ao alterar nome:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}

module.exports = new AuthController();
