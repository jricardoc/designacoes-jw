const prisma = require('../prisma');
const bcrypt = require('bcrypt');

const SENHA_PADRAO = 'jw1010';

class UsuarioController {
    // Listar todos os usuarios (admin only)
    async index(req, res) {
        try {
            // Verificar se e admin
            if (!req.user.isAdmin) {
                return res.status(403).json({ error: 'Acesso negado. Apenas admin pode listar usuarios.' });
            }

            const usuarios = await prisma.usuario.findMany({
                select: {
                    id: true,
                    nickname: true,
                    nome: true,
                    isAdmin: true,
                    createdAt: true
                },
                orderBy: { nome: 'asc' }
            });

            return res.json(usuarios);
        } catch (error) {
            console.error('Erro ao listar usuarios:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Criar novo usuario (admin only)
    async create(req, res) {
        try {
            // Verificar se e admin
            if (!req.user.isAdmin) {
                return res.status(403).json({ error: 'Acesso negado. Apenas admin pode criar usuarios.' });
            }

            const { nickname, nome } = req.body;

            if (!nickname || !nome) {
                return res.status(400).json({ error: 'Nickname e nome sao obrigatorios' });
            }

            // Verificar se nickname ja existe
            const existente = await prisma.usuario.findUnique({
                where: { nickname }
            });

            if (existente) {
                return res.status(400).json({ error: 'Nickname ja esta em uso' });
            }

            // Hash da senha padrao
            const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);

            const usuario = await prisma.usuario.create({
                data: {
                    nickname,
                    nome,
                    senha: senhaHash,
                    isAdmin: false
                },
                select: {
                    id: true,
                    nickname: true,
                    nome: true,
                    isAdmin: true,
                    createdAt: true
                }
            });

            return res.status(201).json(usuario);
        } catch (error) {
            console.error('Erro ao criar usuario:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Promover/remover admin (admin only)
    async toggleAdmin(req, res) {
        try {
            // Verificar se e admin
            if (!req.user.isAdmin) {
                return res.status(403).json({ error: 'Acesso negado. Apenas admin pode alterar permissoes.' });
            }

            const { id } = req.params;
            const targetId = parseInt(id);

            // Nao permitir remover admin de si mesmo
            if (targetId === req.user.id) {
                return res.status(400).json({ error: 'Voce nao pode alterar suas proprias permissoes de admin' });
            }

            const usuario = await prisma.usuario.findUnique({
                where: { id: targetId }
            });

            if (!usuario) {
                return res.status(404).json({ error: 'Usuario nao encontrado' });
            }

            const atualizado = await prisma.usuario.update({
                where: { id: targetId },
                data: { isAdmin: !usuario.isAdmin },
                select: {
                    id: true,
                    nickname: true,
                    nome: true,
                    isAdmin: true
                }
            });

            return res.json(atualizado);
        } catch (error) {
            console.error('Erro ao alterar admin:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Deletar usuario (admin only)
    async delete(req, res) {
        try {
            // Verificar se e admin
            if (!req.user.isAdmin) {
                return res.status(403).json({ error: 'Acesso negado. Apenas admin pode deletar usuarios.' });
            }

            const { id } = req.params;
            const targetId = parseInt(id);

            // Nao permitir deletar a si mesmo
            if (targetId === req.user.id) {
                return res.status(400).json({ error: 'Voce nao pode deletar sua propria conta' });
            }

            await prisma.usuario.delete({
                where: { id: targetId }
            });

            return res.status(204).send();
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Usuario nao encontrado' });
            }
            console.error('Erro ao deletar usuario:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Alterar nickname (proprio usuario)
    async updateNickname(req, res) {
        try {
            const { nickname } = req.body;

            if (!nickname) {
                return res.status(400).json({ error: 'Nickname e obrigatorio' });
            }

            // Verificar se nickname ja existe
            const existente = await prisma.usuario.findFirst({
                where: {
                    nickname,
                    NOT: { id: req.user.id }
                }
            });

            if (existente) {
                return res.status(400).json({ error: 'Nickname ja esta em uso' });
            }

            const atualizado = await prisma.usuario.update({
                where: { id: req.user.id },
                data: { nickname },
                select: {
                    id: true,
                    nickname: true,
                    nome: true,
                    isAdmin: true
                }
            });

            return res.json(atualizado);
        } catch (error) {
            console.error('Erro ao atualizar nickname:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Resetar senha para padrao (admin only)
    async resetSenha(req, res) {
        try {
            // Verificar se e admin
            if (!req.user.isAdmin) {
                return res.status(403).json({ error: 'Acesso negado. Apenas admin pode resetar senhas.' });
            }

            const { id } = req.params;
            const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);

            await prisma.usuario.update({
                where: { id: parseInt(id) },
                data: { senha: senhaHash }
            });

            return res.json({ message: 'Senha resetada para padrao' });
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Usuario nao encontrado' });
            }
            console.error('Erro ao resetar senha:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }
}

module.exports = new UsuarioController();
