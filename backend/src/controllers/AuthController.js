const prisma = require('../prisma');
const bcrypt = require('bcrypt');
const JwtService = require('../services/JwtService');
const PrivilegioService = require('../services/PrivilegioService');

// Teto da foto de perfil ja decodificada. O app manda ~30 KB (384 px em JPEG); o teto so
// barra quem mandar uma foto crua da camera direto na API.
const FOTO_MAX_BYTES = 512 * 1024;

/** JPEG (FF D8 FF) ou PNG (89 50 4E 47): o que o GET devolve como Content-Type. */
function tipoDaImagem(bytes) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
    return null;
}

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
                    irmaoId: usuario.irmaoId,
                    fotoEm: usuario.fotoEm
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
                    fotoEm: true,
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
                select: { id: true, nome: true, nickname: true, isAdmin: true, escopos: true, irmaoId: true, fotoEm: true }
            });

            // Trocar o nome pode passar a casar (ou deixar de casar) com um irmao cadastrado,
            // entao o cargo e reavaliado aqui.
            return res.json(await PrivilegioService.anotarUsuario(atualizado));
        } catch (error) {
            console.error('Erro ao alterar nome:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    /** PUT /auth/foto — { imagem: "<base64>" }. A foto do PROPRIO usuario. */
    async salvarFoto(req, res) {
        try {
            const bytes = Buffer.from(String((req.body && req.body.imagem) || ''), 'base64');
            if (bytes.length === 0 || !tipoDaImagem(bytes)) {
                return res.status(400).json({ error: 'Envie a foto em JPEG ou PNG' });
            }
            if (bytes.length > FOTO_MAX_BYTES) {
                return res.status(413).json({ error: 'Foto grande demais' });
            }

            const fotoEm = new Date();
            await prisma.$transaction([
                prisma.fotoUsuario.upsert({
                    where: { usuarioId: req.user.id },
                    create: { usuarioId: req.user.id, imagem: bytes },
                    update: { imagem: bytes }
                }),
                prisma.usuario.update({ where: { id: req.user.id }, data: { fotoEm } })
            ]);
            return res.json({ fotoEm });
        } catch (error) {
            console.error('Erro ao salvar foto:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    /** DELETE /auth/foto */
    async removerFoto(req, res) {
        try {
            await prisma.$transaction([
                prisma.fotoUsuario.deleteMany({ where: { usuarioId: req.user.id } }),
                prisma.usuario.update({ where: { id: req.user.id }, data: { fotoEm: null } })
            ]);
            return res.status(204).end();
        } catch (error) {
            console.error('Erro ao remover foto:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    /**
     * GET /usuarios/:id/foto — a foto de qualquer usuario, para quem esta logado (a lista de
     * usuarios e o menu mostram). O app poe `?v=<fotoEm>` na URL, entao a resposta pode ficar
     * em cache: trocar a foto muda a URL.
     */
    async foto(req, res) {
        try {
            const foto = await prisma.fotoUsuario.findUnique({
                where: { usuarioId: parseInt(req.params.id) || 0 }
            });
            if (!foto) return res.status(404).json({ error: 'Sem foto' });
            res.set('Content-Type', tipoDaImagem(foto.imagem) || 'application/octet-stream');
            // private: a resposta so existe porque a requisicao levou Authorization.
            res.set('Cache-Control', 'private, max-age=31536000');
            return res.send(foto.imagem);
        } catch (error) {
            console.error('Erro ao buscar foto:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}

module.exports = new AuthController();
