const prisma = require('../prisma');
const { ESCOPOS, temEscopo } = require('../middleware/escopos');

const MESES = ['', 'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

// Gerar template de designacoes para o mes
function gerarTemplate(mes, ano) {
    const designacoes = [];
    const funcoes = ['Microfone Volante', 'Indicador', 'Audio e Video'];

    // Encontrar domingos e quintas do mes
    const primeiroDia = new Date(ano, mes - 1, 1);
    const ultimoDia = new Date(ano, mes, 0);

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
        const data = new Date(ano, mes - 1, dia);
        const diaSemana = data.getDay();

        // 0 = Domingo, 4 = Quinta
        if (diaSemana === 0 || diaSemana === 4) {
            const diaStr = String(dia).padStart(2, '0');
            const mesStr = String(mes).padStart(2, '0');
            const dataFormatada = `${diaStr}/${mesStr}`;
            const diaNome = diaSemana === 0 ? 'Domingo' : 'Quinta';

            funcoes.forEach(funcao => {
                designacoes.push({
                    data: dataFormatada,
                    dia: diaNome,
                    funcao,
                    irmao1: '',
                    irmao2: ''
                });
            });

            // Adiciona Estacionamento apenas aos Domingos
            if (diaSemana === 0) {
                designacoes.push({
                    data: dataFormatada,
                    dia: diaNome,
                    funcao: 'Estacionamento',
                    irmao1: '',
                    irmao2: ''
                });
            }
        }
    }

    return designacoes;
}

class QuadroController {
    // Listar todos os quadros
    async index(req, res) {
        try {
            const quadros = await prisma.quadro.findMany({
                include: {
                    _count: {
                        select: { designacoes: true, historicos: true }
                    }
                },
                orderBy: [
                    { ano: 'desc' },
                    { mes: 'desc' }
                ]
            });
            return res.json(quadros);
        } catch (error) {
            console.error('Erro ao listar quadros:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Buscar quadro por ID com designacoes
    async show(req, res) {
        try {
            const { id } = req.params;
            const quadro = await prisma.quadro.findUnique({
                where: { id: parseInt(id) },
                include: {
                    designacoes: {
                        orderBy: [
                            { data: 'asc' },
                            { funcao: 'asc' }
                        ]
                    }
                }
            });

            if (!quadro) {
                return res.status(404).json({ error: 'Quadro nao encontrado' });
            }

            // A avaliacao de cumprimento (o V/X ao lado do nome) e informacao restrita a quem
            // cuida das designacoes. Quem nao cuida ve o quadro inteiro — e o quadro e publico
            // por natureza — mas nao ve quem faltou. Sem esta poda os campos viajavam para
            // todo irmao logado, e esconder so na tela deixaria o dado a um F12 de distancia.
            if (!temEscopo(req.user, ESCOPOS.DESIGNACOES)) {
                return res.json({
                    ...quadro,
                    designacoes: quadro.designacoes.map(
                        ({ cumpriu1, cumpriu2, ...resto }) => resto),
                });
            }

            return res.json(quadro);
        } catch (error) {
            console.error('Erro ao buscar quadro:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Criar novo quadro
    async create(req, res) {
        try {
            const { mes, ano, comTemplate, autoPreenchimento, regras } = req.body;

            if (!mes || !ano) {
                return res.status(400).json({ error: 'Mes e ano sao obrigatorios' });
            }

            // Verificar se ja existe
            const existente = await prisma.quadro.findUnique({
                where: { mes_ano: { mes: parseInt(mes), ano: parseInt(ano) } }
            });

            if (existente) {
                return res.status(400).json({ error: 'Ja existe um quadro para esse mes/ano' });
            }

            const titulo = `Quadro de Designacoes ${MESES[mes]} ${ano}`;

            const quadro = await prisma.quadro.create({
                data: {
                    mes: parseInt(mes),
                    ano: parseInt(ano),
                    titulo,
                    status: 'rascunho'
                }
            });

            // A partir daqui, qualquer falha deve desfazer o quadro recem-criado para
            // nao deixar registros orfaos (o backend/cleanup.js existe por causa desse bug).
            try {
                // SEMPRE criar template com datas, dias e funções
                // Isso garante que o quadro nao fique completamente vazio
                const designacoesTemplate = gerarTemplate(mes, ano);

                if (designacoesTemplate.length > 0) {
                    await prisma.designacao.createMany({
                        data: designacoesTemplate.map(d => ({ ...d, quadroId: quadro.id }))
                    });
                }

                // Se auto-preenchimento, chamar servico de automatizacao para preencher irmaos
                if (autoPreenchimento) {
                    const AutoDesignacaoService = require('../services/AutoDesignacaoService');
                    await AutoDesignacaoService.gerarDesignacoes(
                        quadro.id,
                        parseInt(mes),
                        parseInt(ano),
                        regras || {}
                    );
                }

                // Registrar no historico
                let descricao = `Quadro de ${MESES[mes]} ${ano} criado`;
                if (autoPreenchimento) {
                    descricao += ' com preenchimento automatico';
                } else if (comTemplate) {
                    descricao += ' com template vazio';
                } else {
                    descricao += ' vazio';
                }

                await prisma.historico.create({
                    data: {
                        quadroId: quadro.id,
                        usuarioId: req.user.id,
                        acao: 'criou',
                        descricao
                    }
                });
            } catch (err) {
                // Rollback manual: apaga o quadro (cascade remove designacoes/historico).
                await prisma.quadro.delete({ where: { id: quadro.id } }).catch(() => {});
                throw err;
            }

            return res.status(201).json(quadro);
        } catch (error) {
            console.error('Erro ao criar quadro:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }



    // Atualizar quadro (titulo, status)
    async update(req, res) {
        try {
            const { id } = req.params;
            const { titulo, status } = req.body;

            const quadro = await prisma.quadro.findUnique({
                where: { id: parseInt(id) }
            });

            if (!quadro) {
                return res.status(404).json({ error: 'Quadro nao encontrado' });
            }

            const updateData = {};
            if (titulo) updateData.titulo = titulo;
            if (status) updateData.status = status;

            // Carimba QUANDO e por QUEM na primeira publicacao. So na primeira: republicar
            // depois de arquivar nao pode reescrever a data que decide se o quadro saiu no
            // prazo — o painel de tarefas mede a entrega original, nao a ultima mexida.
            if (status === 'publicado' && quadro.status !== 'publicado' && !quadro.publicadoEm) {
                updateData.publicadoEm = new Date();
                updateData.publicadoPorId = req.user.id;
            }

            const atualizado = await prisma.quadro.update({
                where: { id: parseInt(id) },
                data: updateData
            });

            // Registrar mudanca de status no historico
            if (status && status !== quadro.status) {
                await prisma.historico.create({
                    data: {
                        quadroId: quadro.id,
                        usuarioId: req.user.id,
                        acao: status === 'publicado' ? 'publicou' : 'arquivou',
                        descricao: `Quadro alterado de "${quadro.status}" para "${status}"`
                    }
                });
            }

            return res.json(atualizado);
        } catch (error) {
            console.error('Erro ao atualizar quadro:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Deletar quadro
    async delete(req, res) {
        try {
            const { id } = req.params;

            await prisma.quadro.delete({
                where: { id: parseInt(id) }
            });

            return res.status(204).send();
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Quadro nao encontrado' });
            }
            console.error('Erro ao deletar quadro:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Atualizar designacao dentro de um quadro
    async updateDesignacao(req, res) {
        try {
            const { quadroId, data, funcao, campo, valor } = req.body;

            // Whitelist: so os nomes dos irmaos sao editaveis por aqui (bloqueia mass assignment).
            if (campo !== 'irmao1' && campo !== 'irmao2') {
                return res.status(400).json({ error: 'Campo inválido' });
            }

            const designacao = await prisma.designacao.findFirst({
                where: {
                    quadroId: parseInt(quadroId),
                    data,
                    funcao
                }
            });

            if (!designacao) {
                return res.status(404).json({ error: 'Designacao nao encontrada' });
            }

            const valorAntigo = designacao[campo];

            // Trocar o irmao da celula zera a avaliacao de cumprimento (V/X):
            // ela e da escalacao anterior — mante-la marcaria o irmao novo com
            // o resultado de outra pessoa.
            const updateData = { [campo]: valor };
            if (valor !== valorAntigo) {
                updateData[campo === 'irmao1' ? 'cumpriu1' : 'cumpriu2'] = null;
            }

            const atualizada = await prisma.designacao.update({
                where: { id: designacao.id },
                data: updateData
            });

            // Registrar no historico
            await prisma.historico.create({
                data: {
                    quadroId: parseInt(quadroId),
                    usuarioId: req.user.id,
                    acao: 'editou',
                    descricao: `Alterou ${campo} de "${valorAntigo}" para "${valor}"`,
                    campo,
                    valorAntigo,
                    valorNovo: valor,
                    designacaoInfo: `${data} - ${funcao}`
                }
            });

            return res.json(atualizada);
        } catch (error) {
            console.error('Erro ao atualizar designacao:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Atualizar data de designacoes
    async updateData(req, res) {
        try {
            const { quadroId, dataAntiga, novaData } = req.body;

            await prisma.designacao.updateMany({
                where: {
                    quadroId: parseInt(quadroId),
                    data: dataAntiga
                },
                data: { data: novaData }
            });

            // Registrar no historico
            await prisma.historico.create({
                data: {
                    quadroId: parseInt(quadroId),
                    usuarioId: req.user.id,
                    acao: 'editou',
                    descricao: `Alterou data de "${dataAntiga}" para "${novaData}"`,
                    campo: 'data',
                    valorAntigo: dataAntiga,
                    valorNovo: novaData
                }
            });

            return res.json({ success: true });
        } catch (error) {
            console.error('Erro ao atualizar data:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Atualizar dia da semana
    async updateDia(req, res) {
        try {
            const { quadroId, data, novoDia } = req.body;

            const designacoes = await prisma.designacao.findMany({
                where: { quadroId: parseInt(quadroId), data }
            });

            if (designacoes.length === 0) {
                return res.status(404).json({ error: 'Designacoes nao encontradas' });
            }

            const diaAntigo = designacoes[0].dia;

            await prisma.designacao.updateMany({
                where: { quadroId: parseInt(quadroId), data },
                data: { dia: novoDia }
            });

            // Registrar no historico
            await prisma.historico.create({
                data: {
                    quadroId: parseInt(quadroId),
                    usuarioId: req.user.id,
                    acao: 'editou',
                    descricao: `Alterou dia de "${diaAntigo}" para "${novoDia}" em ${data}`,
                    campo: 'dia',
                    valorAntigo: diaAntigo,
                    valorNovo: novoDia,
                    designacaoInfo: data
                }
            });

            return res.json({ success: true });
        } catch (error) {
            console.error('Erro ao atualizar dia:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Excluir dia (designacoes de uma data)
    async deleteDia(req, res) {
        try {
            const { quadroId, data, motivo } = req.body;

            if (!quadroId || !data) {
                return res.status(400).json({ error: 'Dados invalidos' });
            }

            // Excluir designacoes
            const deleteResult = await prisma.designacao.deleteMany({
                where: {
                    quadroId: parseInt(quadroId),
                    data: data
                }
            });

            if (deleteResult.count === 0) {
                return res.status(404).json({ error: 'Nenhuma designacao encontrada para esta data' });
            }

            // Registrar no historico
            await prisma.historico.create({
                data: {
                    quadroId: parseInt(quadroId),
                    usuarioId: req.user.id,
                    acao: 'excluiu_dia',
                    descricao: `Excluiu o dia ${data}. Motivo: ${motivo || 'Sem motivo informado'}`,
                    designacaoInfo: data
                }
            });

            return res.json({ success: true, count: deleteResult.count });
        } catch (error) {
            console.error('Erro ao excluir dia:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }
}

module.exports = new QuadroController();
// gerarTemplate sai junto para a verificacao do rodizio (verificar:rodizio-quadro) simular o
// mes real em vez de reimplementar as datas e funcoes do quadro e sair divergindo daqui.
module.exports.gerarTemplate = gerarTemplate;
