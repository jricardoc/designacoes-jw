const prisma = require('../prisma');
const { REGRAS_PADRAO } = require('../services/EscalaDirigenteAlgoritmo');
const { ESCOPOS, temEscopo } = require('../middleware/escopos');

const MESES = ['', 'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

/** JSON vindo da rede nao e confiavel: "false" e string e string e verdadeira em JS. */
const paraBooleano = (valor, padrao) => {
    if (valor === undefined || valor === null) return padrao;
    if (typeof valor === 'boolean') return valor;
    if (typeof valor === 'string') return !['false', '0', 'nao', 'não', ''].includes(valor.toLowerCase());
    return Boolean(valor);
};

/**
 * Aceita apenas as chaves conhecidas e coage cada uma ao tipo certo.
 * Sem isso, `autoPreenchimento: "false"` ligava o preenchimento e um `diasDescanso` absurdo
 * (ou nao numerico) entrava direto no algoritmo.
 */
const sanearRegras = (entrada) => {
    if (!entrada || typeof entrada !== 'object') return null;

    const regras = {};
    for (const [chave, padrao] of Object.entries(REGRAS_PADRAO)) {
        if (typeof padrao === 'boolean') {
            regras[chave] = paraBooleano(entrada[chave], padrao);
        } else {
            const numero = Number(entrada[chave]);
            regras[chave] = Number.isFinite(numero) ? Math.max(0, Math.min(31, numero)) : padrao;
        }
    }
    return regras;
};

/**
 * Chave de ordenacao para datas "DD/MM" dentro de um quadro mensal.
 *
 * Um quadro pode conter dias do mes anterior, porque a escala comeca na segunda-feira da
 * semana que contem o dia 1. Ordenar por `mes * 100 + dia` quebra na virada do ano: num
 * quadro de JANEIRO, "29/12" daria 1229 e "01/01" daria 101, jogando dezembro para o fim.
 * E a mesma funcao que a tela usa - as duas precisam concordar para "Semana N" bater.
 */
const chaveData = (data, mesQuadro) => {
    const [dia, mes] = String(data).split('/').map(Number);
    const mesRelativo = mes > mesQuadro ? mes - 12 : mes;
    return mesRelativo * 100 + dia;
};

/**
 * Reproduz o agrupamento visual da tabela: os dias em ordem cronologica, abrindo uma semana
 * nova a cada Segunda-Feira. Devolve um array de arrays de datas "DD/MM" (indice 0 = Semana 1).
 */
const agruparEmSemanas = (escalas, mesQuadro) => {
    const datas = [...new Set(escalas.map(e => e.data))]
        .sort((a, b) => chaveData(a, mesQuadro) - chaveData(b, mesQuadro));

    const diaDaData = new Map(escalas.map(e => [e.data, e.dia]));

    const semanas = [];
    let atual = [];
    for (const data of datas) {
        const ehSegunda = String(diaDaData.get(data) || '').startsWith('Segunda');
        if (ehSegunda && atual.length > 0) {
            semanas.push(atual);
            atual = [];
        }
        atual.push(data);
    }
    if (atual.length > 0) semanas.push(atual);

    return semanas;
};

class DirigentesController {
    // Listar todos os quadros de dirigentes
    async indexQuadros(req, res) {
        try {
            const quadros = await prisma.quadroDirigente.findMany({
                include: {
                    _count: {
                        select: { escalas: true }
                    }
                },
                orderBy: [
                    { ano: 'desc' },
                    { mes: 'desc' }
                ]
            });
            return res.json(quadros);
        } catch (error) {
            console.error('Erro ao listar quadros de dirigentes:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Buscar quadro por ID com escalas
    async showQuadro(req, res) {
        try {
            const { id } = req.params;
            const quadro = await prisma.quadroDirigente.findUnique({
                where: { id: parseInt(id) },
                include: {
                    escalas: {
                        where: { removido: false },
                        include: {
                            saidaCampo: true
                        },
                        orderBy: [
                            { data: 'asc' },
                            { saidaCampo: { turno: 'asc' } }
                        ]
                    }
                }
            });

            if (!quadro) {
                return res.status(404).json({ error: 'Quadro não encontrado' });
            }

            // Mesma regra do quadro de designacoes: quem nao cuida da escala ve os turnos e
            // os nomes, mas nao a avaliacao de cumprimento.
            if (!temEscopo(req.user, ESCOPOS.DIRIGENTES)) {
                return res.json({
                    ...quadro,
                    escalas: quadro.escalas.map(({ cumpriu, ...resto }) => resto),
                });
            }

            return res.json(quadro);
        } catch (error) {
            console.error('Erro ao buscar quadro de dirigentes:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Criar novo quadro de dirigentes
    async createQuadro(req, res) {
        try {
            const { mes, ano, autoPreenchimento, regras } = req.body;

            if (!mes || !ano) {
                return res.status(400).json({ error: 'Mês e ano são obrigatórios' });
            }

            const mesNum = parseInt(mes);
            const anoNum = parseInt(ano);

            if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
                return res.status(400).json({ error: 'Mês inválido' });
            }
            if (!Number.isInteger(anoNum) || anoNum < 2000 || anoNum > 2100) {
                return res.status(400).json({ error: 'Ano inválido' });
            }

            const preencher = paraBooleano(autoPreenchimento, false);

            const existente = await prisma.quadroDirigente.findUnique({
                where: { mes_ano: { mes: mesNum, ano: anoNum } }
            });

            if (existente) {
                return res.status(400).json({ error: 'Já existe um quadro de dirigentes para esse mês/ano' });
            }

            const titulo = `Escala de Dirigentes ${MESES[mesNum]} ${anoNum}`;

            const quadro = await prisma.quadroDirigente.create({
                data: {
                    mes: mesNum,
                    ano: anoNum,
                    titulo,
                    status: 'rascunho'
                }
            });

            let diagnostico = null;
            try {
                const AutoDirigenteService = require('../services/AutoDirigenteService');

                // Gerar o template vazio (dias e saídas) e auto-preencher se solicitado
                const resultado = await AutoDirigenteService.gerarEscala(
                    quadro.id,
                    mesNum,
                    anoNum,
                    preencher,
                    preencher ? sanearRegras(regras) : null
                );
                diagnostico = resultado.diagnostico;
            } catch (err) {
                // Rollback manual: sem isso, uma falha na geracao deixaria um quadro vazio orfao.
                await prisma.quadroDirigente.delete({ where: { id: quadro.id } }).catch(() => {});
                throw err;
            }

            return res.status(201).json({ ...quadro, diagnostico });
        } catch (error) {
            console.error('Erro ao criar quadro de dirigentes:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Regerar o preenchimento automatico de um quadro ja existente
    async regerarQuadro(req, res) {
        try {
            const { id } = req.params;
            const { regras } = req.body || {};

            const quadro = await prisma.quadroDirigente.findUnique({
                where: { id: parseInt(id) }
            });

            if (!quadro) {
                return res.status(404).json({ error: 'Quadro não encontrado' });
            }

            const AutoDirigenteService = require('../services/AutoDirigenteService');
            const resultado = await AutoDirigenteService.regerarEscala(
                quadro.id,
                quadro.mes,
                quadro.ano,
                sanearRegras(regras)
            );

            if (!resultado.success) {
                return res.status(400).json({ error: resultado.erro });
            }

            return res.json({ success: true, diagnostico: resultado.diagnostico });
        } catch (error) {
            console.error('Erro ao regerar escala de dirigentes:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Excluir quadro
    async deleteQuadro(req, res) {
        try {
            const { id } = req.params;

            await prisma.quadroDirigente.delete({
                where: { id: parseInt(id) }
            });

            return res.status(204).send();
        } catch (error) {
            console.error('Erro ao deletar quadro de dirigentes:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Alterar status
    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const atual = await prisma.quadroDirigente.findUnique({
                where: { id: parseInt(id) },
                select: { status: true, publicadoEm: true }
            });
            if (!atual) {
                return res.status(404).json({ error: 'Quadro nao encontrado' });
            }

            const dados = { status };
            // Mesmo carimbo do quadro de designacoes, e pelo mesmo motivo: e daqui que o
            // painel de tarefas sabe se a escala saiu antes de a anterior acabar. So na
            // primeira publicacao — republicar nao reescreve a entrega original.
            if (status === 'publicado' && atual.status !== 'publicado' && !atual.publicadoEm) {
                dados.publicadoEm = new Date();
                dados.publicadoPorId = req.user.id;
            }

            const atualizado = await prisma.quadroDirigente.update({
                where: { id: parseInt(id) },
                data: dados
            });

            return res.json(atualizado);
        } catch (error) {
            console.error('Erro ao atualizar status do quadro:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Atualizar o dirigente de um turno da escala
    async updateEscala(req, res) {
        try {
            // `campo` continua no contrato por compatibilidade com a tela, mas o unico papel
            // que existe e o dirigente: o substituto foi extinto.
            const { escalaId, campo = 'principal', valor } = req.body;

            if (campo !== 'principal') {
                return res.status(400).json({ error: 'Campo inválido' });
            }

            const escala = await prisma.escalaDirigente.findUnique({
                where: { id: parseInt(escalaId) }
            });
            if (!escala) {
                return res.status(404).json({ error: 'Saída não encontrada' });
            }

            // Trocar o dirigente zera a avaliacao de cumprimento (V/X): ela e
            // da escalacao anterior, nao do nome que entra agora.
            const atualizada = await prisma.escalaDirigente.update({
                where: { id: escala.id },
                data:
                    valor === escala.principal
                        ? { principal: valor }
                        : { principal: valor, cumpriu: null }
            });

            return res.json(atualizada);
        } catch (error) {
            console.error('Erro ao atualizar escala:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Remover um dia inteiro da escala (exclui todas as saídas daquele dia)
    async deleteDia(req, res) {
        try {
            const { quadroId, data } = req.body;

            if (!quadroId || !data) {
                return res.status(400).json({ error: 'Dados inválidos' });
            }

            const result = await prisma.escalaDirigente.updateMany({
                where: {
                    quadroId: parseInt(quadroId),
                    data: data
                },
                data: { removido: true }
            });

            return res.json({ success: true, count: result.count });
        } catch (error) {
            console.error('Erro ao remover dia da escala:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Remover uma semana inteira da escala (todos os dias, com todas as saídas de cada dia)
    //
    // Mesmo mecanismo da exclusão de dia, um nível acima: marca removido = true, nunca apaga
    // a linha, para o quadro poder ser regerado sem ressuscitar o que o usuário tirou.
    //
    // O corpo aceita as DUAS formas, e `datas` é a preferida:
    //   { quadroId, datas: ["02/06", "03/06", ...] }  -> a tela já tem em mãos exatamente os
    //       dias do bloco "Semana N" que ela mesma montou, então mandar as datas não depende
    //       de o backend reproduzir o agrupamento visual (que ainda por cima é paginado: a
    //       tabela recebe `semanaInicial` e desenha 2 semanas por página).
    //   { quadroId, semana: 3 }  -> atalho para quem só tem o número exibido. Resolvido aqui
    //       pelo mesmo critério da tabela: os dias em ordem cronológica, abrindo uma semana
    //       nova a cada Segunda-Feira. A resposta devolve as datas resolvidas para o cliente
    //       poder conferir o que foi removido.
    async deleteSemana(req, res) {
        try {
            const { quadroId, semana, datas } = req.body || {};
            const quadroIdNum = parseInt(quadroId);

            if (!Number.isInteger(quadroIdNum)) {
                return res.status(400).json({ error: 'Quadro inválido' });
            }

            const quadro = await prisma.quadroDirigente.findUnique({
                where: { id: quadroIdNum },
                include: { escalas: { where: { removido: false } } }
            });

            if (!quadro) {
                return res.status(404).json({ error: 'Quadro não encontrado' });
            }

            let datasAlvo = null;
            let criterio = null;

            if (Array.isArray(datas) && datas.length > 0) {
                datasAlvo = [...new Set(
                    datas.map(d => String(d).trim()).filter(d => /^\d{2}\/\d{2}$/.test(d))
                )];
                criterio = 'datas informadas pela tela';
                if (datasAlvo.length === 0) {
                    return res.status(400).json({ error: 'Datas inválidas (esperado "DD/MM")' });
                }
            } else {
                const semanaNum = parseInt(semana);
                if (!Number.isInteger(semanaNum) || semanaNum < 1) {
                    return res.status(400).json({ error: 'Informe as datas da semana ou o número da semana' });
                }

                const semanas = agruparEmSemanas(quadro.escalas, quadro.mes);
                if (semanaNum > semanas.length) {
                    return res.status(404).json({ error: `A escala tem ${semanas.length} semana(s)` });
                }
                datasAlvo = semanas[semanaNum - 1];
                criterio = 'número da semana resolvido no servidor (nova semana a cada Segunda-Feira)';
            }

            const result = await prisma.escalaDirigente.updateMany({
                where: {
                    quadroId: quadroIdNum,
                    data: { in: datasAlvo }
                },
                data: { removido: true }
            });

            return res.json({
                success: true,
                count: result.count,
                datas: datasAlvo,
                semana: semana !== undefined ? parseInt(semana) : null,
                criterio
            });
        } catch (error) {
            console.error('Erro ao remover semana da escala:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // -----------------------------------------------------
    // Disponibilidade de Dirigentes

    // Buscar disponibilidade de um irmão
    async getDisponibilidade(req, res) {
        try {
            const { irmaoId } = req.params;
            const disponibilidades = await prisma.dirigenteSaidaCampo.findMany({
                where: { irmaoId: parseInt(irmaoId) },
                include: { saidaCampo: true }
            });
            return res.json(disponibilidades);
        } catch (error) {
            console.error('Erro ao buscar disponibilidade:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }

    // Atualizar disponibilidade de um irmão
    async updateDisponibilidade(req, res) {
        try {
            const { irmaoId, saidasCampoIds } = req.body; // array de IDs de saidaCampo

            // Excluir as atuais
            await prisma.dirigenteSaidaCampo.deleteMany({
                where: { irmaoId: parseInt(irmaoId) }
            });

            // Criar novas
            if (saidasCampoIds && saidasCampoIds.length > 0) {
                const novasDisponibilidades = saidasCampoIds.map(saidaId => ({
                    irmaoId: parseInt(irmaoId),
                    saidaCampoId: parseInt(saidaId)
                }));

                await prisma.dirigenteSaidaCampo.createMany({
                    data: novasDisponibilidades
                });
            }

            return res.json({ success: true });
        } catch (error) {
            console.error('Erro ao atualizar disponibilidade:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }
}

module.exports = new DirigentesController();
