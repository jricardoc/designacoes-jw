const prisma = require('../prisma');
const bcrypt = require('bcrypt');
const PrivilegioService = require('../services/PrivilegioService');
const { sanearEscopos, CATALOGO_ESCOPOS, ESCOPOS_VALIDOS } = require('../middleware/escopos');

const SENHA_PADRAO = 'jw1010';

/**
 * Valida o irmao que se quer vincular a uma conta.
 * `irmaoId` ausente mantem como esta; `null` desvincula.
 * Devolve `{ irmaoId }` ou `{ erro }`.
 */
async function validarVinculo(irmaoId, usuarioIdAtual) {
    if (irmaoId === undefined) return { irmaoId: undefined };
    if (irmaoId === null || irmaoId === '') return { irmaoId: null };

    const id = parseInt(irmaoId);
    if (!Number.isInteger(id)) return { erro: 'Irmão inválido' };

    const irmao = await prisma.irmao.findUnique({
        where: { id },
        select: { id: true, nome: true, usuario: { select: { id: true, nome: true } } }
    });

    if (!irmao) return { erro: 'Irmão não encontrado' };

    // irmaoId e @unique: sem esta checagem o Prisma devolveria um P2002 cru.
    if (irmao.usuario && irmao.usuario.id !== usuarioIdAtual) {
        return { erro: `${irmao.nome} já está vinculado à conta de ${irmao.usuario.nome}` };
    }

    return { irmaoId: id };
}

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
                    escopos: true,
                    irmaoId: true,
                    // As tarefas de sistema entram na LISTA (e nao so na folha de edicao)
                    // para o admin ver de relance quem ficou com o que — sem isso, saber
                    // se alguem ja tem a tarefa do Zoom exigiria abrir usuario por usuario.
                    tarefas: { select: { tipo: true } },
                    createdAt: true
                },
                orderBy: { nome: 'asc' }
            });

            // Anota o cargo (servo ministerial / anciao) de quem tambem esta cadastrado como
            // irmao. Uma query extra para a lista inteira, sem N+1.
            // Achata { tarefas: [{tipo}] } em uma lista de strings: o app so quer os ids,
            // e devolver objeto obrigaria a tela a desembrulhar duas vezes.
            const comTarefas = usuarios.map(u => ({ ...u, tarefas: u.tarefas.map(t => t.tipo) }));

            return res.json(await PrivilegioService.anotarUsuarios(comTarefas));
        } catch (error) {
            console.error('Erro ao listar usuarios:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Vincular (ou desvincular) a conta ao cadastro de um irmao — admin only
    async vincularIrmao(req, res) {
        try {
            if (!req.user.isAdmin) {
                return res.status(403).json({ error: 'Acesso negado. Apenas admin pode vincular contas.' });
            }

            const id = parseInt(req.params.id);
            const { irmaoId } = req.body;

            const usuario = await prisma.usuario.findUnique({ where: { id } });
            if (!usuario) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            const vinculo = await validarVinculo(irmaoId, id);
            if (vinculo.erro) return res.status(400).json({ error: vinculo.erro });
            if (vinculo.irmaoId === undefined) {
                return res.status(400).json({ error: 'Informe o irmão (ou null para desvincular)' });
            }

            const atualizado = await prisma.usuario.update({
                where: { id },
                data: { irmaoId: vinculo.irmaoId },
                select: { id: true, nickname: true, nome: true, isAdmin: true, escopos: true, irmaoId: true, createdAt: true }
            });

            return res.json(await PrivilegioService.anotarUsuario(atualizado));
        } catch (error) {
            console.error('Erro ao vincular irmão:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    /**
     * Irmãos disponíveis para vincular: os que ainda não têm conta, mais o já vinculado a
     * esta conta (para ele aparecer selecionado no seletor).
     */
    async irmaosDisponiveis(req, res) {
        try {
            if (!req.user.isAdmin) {
                return res.status(403).json({ error: 'Acesso negado.' });
            }

            const usuarioId = req.query.usuarioId ? parseInt(req.query.usuarioId) : null;

            const irmaos = await prisma.irmao.findMany({
                where: { ativo: true },
                select: {
                    id: true,
                    nome: true,
                    privilegio: true,
                    usuario: { select: { id: true, nome: true, nickname: true } }
                },
                orderBy: { nome: 'asc' }
            });

            return res.json(irmaos.map(i => ({
                id: i.id,
                nome: i.nome,
                privilegio: i.privilegio,
                disponivel: !i.usuario || i.usuario.id === usuarioId,
                vinculadoA: i.usuario ? { nome: i.usuario.nome, nickname: i.usuario.nickname } : null
            })));
        } catch (error) {
            console.error('Erro ao listar irmãos disponíveis:', error);
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

            const { nickname, nome, irmaoId } = req.body;

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

            const vinculo = await validarVinculo(irmaoId, null);
            if (vinculo.erro) return res.status(400).json({ error: vinculo.erro });

            // Hash da senha padrao
            const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);

            const usuario = await prisma.usuario.create({
                data: {
                    nickname,
                    nome,
                    senha: senhaHash,
                    isAdmin: false,
                    irmaoId: vinculo.irmaoId
                },
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

            return res.status(201).json(await PrivilegioService.anotarUsuario(usuario));
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

            const virandoGeral = !usuario.isAdmin;

            const atualizado = await prisma.usuario.update({
                where: { id: targetId },
                // Os escopos NAO sao apagados ao promover/rebaixar.
                //
                // Enquanto a pessoa e geral eles ficam inertes — `temEscopo` checa
                // `isAdmin` antes de olhar a lista, e a tela ramifica em `isAdmin`
                // em todo lugar, entao nada aparece duplicado. Zera-los aqui fazia
                // um toque acidental em "Tornar admin" apagar, em silencio e sem
                // volta, as areas que alguem tinha concedido: a lista nao existe em
                // nenhum outro lugar. Preservando, promover e desfazer devolve o
                // estado anterior.
                data: { isAdmin: virandoGeral },
                select: {
                    id: true,
                    nickname: true,
                    nome: true,
                    isAdmin: true,
                    escopos: true
                }
            });

            return res.json(atualizado);
        } catch (error) {
            console.error('Erro ao alterar admin:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    /**
     * GET /usuarios/escopos/catalogo - as areas que podem ser concedidas.
     *
     * A tela desenha a partir daqui em vez de manter a propria lista: uma area
     * nova passa a aparecer no app sem precisar de build novo.
     */
    async catalogoEscopos(req, res) {
        return res.json({ escopos: CATALOGO_ESCOPOS });
    }

    /**
     * PUT /usuarios/:id/escopos - define os niveis de admin por area.
     *
     * Body: { escopos: ['designacoes', 'dirigentes', ...] }
     *
     * Substitui a lista inteira (nao e incremental): a tela manda o estado final
     * das caixas marcadas, entao um PUT idempotente evita divergir se dois
     * administradores mexerem quase ao mesmo tempo.
     *
     * Quem ja e admin GERAL nao recebe escopo: ele ja contempla tudo, e gravar
     * os dois deixaria a permissao ambigua na hora de rebaixar.
     */
    async atualizarEscopos(req, res) {
        try {
            if (!req.user.isAdmin) {
                return res.status(403).json({ error: 'Acesso negado. Apenas admin geral pode alterar permissoes.' });
            }

            const targetId = parseInt(req.params.id, 10);
            if (!Number.isInteger(targetId)) {
                return res.status(400).json({ error: 'Usuario invalido' });
            }

            // Mesma trava do toggleAdmin: ninguem mexe na propria permissao, para
            // nao existir o caminho de se trancar fora por acidente.
            if (targetId === req.user.id) {
                return res.status(400).json({ error: 'Voce nao pode alterar suas proprias permissoes' });
            }

            const usuario = await prisma.usuario.findUnique({ where: { id: targetId } });
            if (!usuario) {
                return res.status(404).json({ error: 'Usuario nao encontrado' });
            }

            if (usuario.isAdmin) {
                return res.status(400).json({
                    error: 'Este usuario e admin geral e ja tem acesso a tudo. Remova o admin geral antes de definir areas.'
                });
            }

            // Corpo invalido nao pode ser tratado como "remover tudo": um erro de
            // digitacao no cliente apagaria as areas do irmao devolvendo 200. Lista
            // vazia continua valendo como "sem area", mas so quando VEM como lista.
            const bruto = req.body && req.body.escopos;
            if (!Array.isArray(bruto)) {
                return res.status(400).json({ error: 'Informe `escopos` como lista.' });
            }
            const escopos = sanearEscopos(bruto);
            if (escopos.length !== new Set(bruto).size) {
                return res.status(400).json({
                    error: 'Alguma área informada não existe.',
                    escoposValidos: ESCOPOS_VALIDOS
                });
            }

            const atualizado = await prisma.usuario.update({
                where: { id: targetId },
                data: { escopos },
                select: {
                    id: true,
                    nickname: true,
                    nome: true,
                    isAdmin: true,
                    escopos: true
                }
            });

            return res.json(atualizado);
        } catch (error) {
            console.error('Erro ao alterar escopos:', error);
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
                    isAdmin: true,
                    escopos: true
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
