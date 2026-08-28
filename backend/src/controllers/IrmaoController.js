const prisma = require('../prisma');

/** Privilegios de servico reconhecidos. `null` = o irmao nao tem nenhum dos dois. */
const PRIVILEGIOS = ['servoMinisterial', 'anciao'];

/**
 * Normaliza o privilegio recebido da rede.
 * Devolve `undefined` quando o campo nao veio (para nao apagar o valor num update parcial)
 * e `null` quando veio explicitamente vazio (para limpar de verdade).
 */
function normalizarPrivilegio(valor) {
    if (valor === undefined) return undefined;
    if (valor === null || valor === '') return null;
    return PRIVILEGIOS.includes(valor) ? valor : null;
}

/**
 * Texto curto guardado como esta, so aparado. Vazio limpa; `undefined` (chave ausente no PUT)
 * mantem o que estava — mesma regra do privilegio e do telefone, para um PUT parcial de outra
 * tela nao apagar o campo sem querer.
 *
 * @returns {string|null|undefined}
 */
function normalizarTexto(valor) {
    if (valor === undefined) return undefined;
    if (valor === null) return null;
    const limpo = String(valor).trim();
    return limpo || null;
}

/** Como se fala com a pessoa. Nao e sexo biologico — por isso os valores tem esse nome. */
const GENEROS = new Set(['irmao', 'irma']);

/**
 * Aceita so 'irmao'/'irma'. Vazio limpa; `undefined` (chave ausente no PUT) mantem o que
 * estava. Valor fora da lista tambem vira `undefined`, para um cliente desatualizado nao
 * apagar o genero de ninguem mandando lixo.
 *
 * @returns {string|null|undefined}
 */
function normalizarGenero(valor) {
    if (valor === undefined) return undefined;
    if (valor === null || valor === '') return null;
    const limpo = String(valor).trim().toLowerCase();
    return GENEROS.has(limpo) ? limpo : undefined;
}

/**
 * Guarda o telefone so com digitos: quem cadastra digita "(71) 99999-8888" e o link do
 * WhatsApp precisa de "71999998888". Vazio limpa o campo; `undefined` (chave ausente no PUT)
 * mantem o que estava, para um PUT parcial de outra tela nao apagar o numero sem querer.
 *
 * @returns {string|null|undefined}
 */
function normalizarTelefone(valor) {
    if (valor === undefined) return undefined;
    if (valor === null) return null;
    const digitos = String(valor).replace(/\D/g, '');
    return digitos ? digitos : null;
}

class IrmaoController {
    // Listar todos os irmaos
    async index(req, res) {
        try {
            const irmaos = await prisma.irmao.findMany({
                include: {
                    indisponibilidades: true,
                    dirigenteSaidas: {
                        include: { saidaCampo: true }
                    }
                },
                orderBy: { nome: 'asc' }
            });
            return res.json(irmaos);
        } catch (error) {
            console.error('Erro ao listar irmaos:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Buscar irmao por ID
    async show(req, res) {
        try {
            const { id } = req.params;
            const irmao = await prisma.irmao.findUnique({
                where: { id: parseInt(id) },
                include: {
                    indisponibilidades: true
                }
            });

            if (!irmao) {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }

            return res.json(irmao);
        } catch (error) {
            console.error('Erro ao buscar irmao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Criar novo irmao
    async create(req, res) {
        try {
            const { nome, funcoes, nivelAudioVideo, privilegio, telefone, genero, grupo } = req.body;

            if (!nome) {
                return res.status(400).json({ error: 'Nome e obrigatorio' });
            }

            const irmao = await prisma.irmao.create({
                data: {
                    nome: String(nome).trim(),
                    funcoes: funcoes || [],
                    nivelAudioVideo: nivelAudioVideo || 'experiente',
                    privilegio: normalizarPrivilegio(privilegio) ?? null,
                    telefone: normalizarTelefone(telefone) ?? null,
                    genero: normalizarGenero(genero) ?? null,
                    grupo: normalizarTexto(grupo) ?? null
                }
            });

            return res.status(201).json(irmao);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Ja existe um irmao com esse nome' });
            }
            console.error('Erro ao criar irmao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Atualizar irmao (renomear, funcoes, status, niveis)
    async update(req, res) {
        try {
            const { id } = req.params;
            const { nome, funcoes, ativo, nivelAudioVideo, privilegio, telefone, genero, grupo } = req.body;

            const updateData = {};
            if (nome !== undefined) updateData.nome = String(nome).trim();

            // Designacao guarda o nome como TEXTO (irmao1/irmao2), nao como chave estrangeira.
            // Sem propagar o rename, as designacoes ja gravadas ficam apontando para um nome que
            // nao existe mais: o irmao deixa de ver as proprias designacoes (MinhasDesignacoes
            // casa por igualdade exata), sai do rodizio do AutoDesignacaoService e aparece como
            // "ainda nao designado" no quadro em que ele esta escalado.
            const anterior = await prisma.irmao.findUnique({
                where: { id: parseInt(id) },
                select: { nome: true }
            });
            if (!anterior) {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }
            const nomeAntigo = anterior.nome;
            const renomeou = updateData.nome !== undefined && updateData.nome !== nomeAntigo;
            if (funcoes !== undefined) updateData.funcoes = funcoes;
            if (ativo !== undefined) updateData.ativo = ativo;
            if (nivelAudioVideo !== undefined) updateData.nivelAudioVideo = nivelAudioVideo;

            // Omitir o campo mantem o valor; enviar null ou "" limpa. Assim um PUT parcial de
            // outra tela nao apaga o privilegio sem querer.
            const privilegioNormalizado = normalizarPrivilegio(privilegio);
            if (privilegioNormalizado !== undefined) updateData.privilegio = privilegioNormalizado;

            const telefoneNormalizado = normalizarTelefone(telefone);
            if (telefoneNormalizado !== undefined) updateData.telefone = telefoneNormalizado;

            const generoNormalizado = normalizarGenero(genero);
            if (generoNormalizado !== undefined) updateData.genero = generoNormalizado;

            const grupoNormalizado = normalizarTexto(grupo);
            if (grupoNormalizado !== undefined) updateData.grupo = grupoNormalizado;

            // Uma transacao: ou o irmao e as designacoes dele andam juntos, ou nada muda.
            const [irmao] = await prisma.$transaction([
                prisma.irmao.update({
                    where: { id: parseInt(id) },
                    data: updateData,
                    include: {
                        indisponibilidades: true
                    }
                }),
                ...(renomeou ? [
                    prisma.designacao.updateMany({
                        where: { irmao1: nomeAntigo },
                        data: { irmao1: updateData.nome }
                    }),
                    prisma.designacao.updateMany({
                        where: { irmao2: nomeAntigo },
                        data: { irmao2: updateData.nome }
                    }),
                    // EscalaDirigente.principal e o mesmo caso: nome como texto.
                    // Sem propagar, o irmao some de MinhasDesignacoes e a analise
                    // de cumprimento o divide em duas pessoas (nome antigo nas
                    // escalas, novo nas designacoes).
                    prisma.escalaDirigente.updateMany({
                        where: { principal: nomeAntigo },
                        data: { principal: updateData.nome }
                    })
                ] : [])
            ]);

            return res.json(irmao);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Ja existe um irmao com esse nome' });
            }
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }
            console.error('Erro ao atualizar irmao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Deletar irmao
    async delete(req, res) {
        try {
            const { id } = req.params;

            await prisma.irmao.delete({
                where: { id: parseInt(id) }
            });

            return res.status(204).send();
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }
            console.error('Erro ao deletar irmao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Adicionar funcao a um irmao
    async addFuncao(req, res) {
        try {
            const { id } = req.params;
            const { funcao } = req.body;

            const irmao = await prisma.irmao.findUnique({
                where: { id: parseInt(id) }
            });

            if (!irmao) {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }

            if (irmao.funcoes.includes(funcao)) {
                return res.status(400).json({ error: 'Irmao ja possui essa funcao' });
            }

            const atualizado = await prisma.irmao.update({
                where: { id: parseInt(id) },
                data: {
                    funcoes: [...irmao.funcoes, funcao]
                }
            });

            return res.json(atualizado);
        } catch (error) {
            console.error('Erro ao adicionar funcao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Remover funcao de um irmao
    async removeFuncao(req, res) {
        try {
            const { id } = req.params;
            const { funcao } = req.body;

            const irmao = await prisma.irmao.findUnique({
                where: { id: parseInt(id) }
            });

            if (!irmao) {
                return res.status(404).json({ error: 'Irmao nao encontrado' });
            }

            const atualizado = await prisma.irmao.update({
                where: { id: parseInt(id) },
                data: {
                    funcoes: irmao.funcoes.filter(f => f !== funcao)
                }
            });

            return res.json(atualizado);
        } catch (error) {
            console.error('Erro ao remover funcao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Buscar irmaos por funcao (para os dropdowns)
    async porFuncao(req, res) {
        try {
            const { funcao } = req.params;

            const irmaos = await prisma.irmao.findMany({
                where: {
                    ativo: true,
                    funcoes: {
                        has: funcao
                    }
                },
                include: {
                    indisponibilidades: true,
                    dirigenteSaidas: {
                        include: { saidaCampo: true }
                    }
                },
                orderBy: { nome: 'asc' }
            });

            return res.json(irmaos);
        } catch (error) {
            console.error('Erro ao buscar irmaos por funcao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}

module.exports = new IrmaoController();
