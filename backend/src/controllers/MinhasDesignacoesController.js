const prisma = require('../prisma');
const MinhasDesignacoesService = require('../services/MinhasDesignacoesService');
const { inicioDeHoje, chaveISO } = require('../utils/datas');

class MinhasDesignacoesController {
    /**
     * GET /minhas-designacoes?escopo=proximas|todas
     *
     * Depende de `Usuario.irmaoId`. Sem vinculo nao ha o que listar - respondemos 200 com
     * `vinculado: false` em vez de erro, para a tela poder explicar o que fazer em vez de
     * mostrar uma falha.
     */
    async index(req, res) {
        try {
            if (!req.user.irmaoId) {
                return res.json({
                    vinculado: false,
                    irmao: null,
                    compromissos: [],
                    mensagem: 'Sua conta ainda não está vinculada a um irmão do cadastro. Peça a um administrador para fazer o vínculo em Conta > Usuários.'
                });
            }

            const irmao = await prisma.irmao.findUnique({
                where: { id: req.user.irmaoId },
                select: { id: true, nome: true, funcoes: true, privilegio: true }
            });

            if (!irmao) {
                return res.json({
                    vinculado: false,
                    irmao: null,
                    compromissos: [],
                    mensagem: 'O irmão vinculado a esta conta não existe mais no cadastro.'
                });
            }

            const todos = await MinhasDesignacoesService.listarPorIrmao(irmao);

            const hoje = chaveISO(inicioDeHoje());
            const proximos = todos.filter(c => !c.dataISO || c.dataISO >= hoje);
            const escopo = req.query.escopo === 'todas' ? 'todas' : 'proximas';

            return res.json({
                vinculado: true,
                irmao,
                escopo,
                totais: { total: todos.length, proximas: proximos.length },
                compromissos: escopo === 'todas' ? todos : proximos
            });
        } catch (error) {
            console.error('Erro ao listar minhas designações:', error);
            return res.status(500).json({ error: 'Erro interno' });
        }
    }
}

module.exports = new MinhasDesignacoesController();
