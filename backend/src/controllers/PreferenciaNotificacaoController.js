const prisma = require('../prisma');
const RegrasLembrete = require('../services/RegrasLembrete');

/**
 * Preferencias de notificacao do irmao logado.
 *
 * O GET devolve tambem o CATALOGO (tipos e regras disponiveis) e os horarios de reuniao. A
 * tela do app monta a lista com o que vier daqui em vez de repetir as opcoes em TypeScript:
 * uma regra nova passa a aparecer no app sem precisar de build novo, e nunca existe opcao na
 * tela que o agendador nao saiba executar.
 */
class PreferenciaNotificacaoController {
    async show(req, res) {
        try {
            const [pref, config] = await Promise.all([
                prisma.preferenciaNotificacao.findUnique({ where: { usuarioId: req.user.id } }),
                prisma.config.findFirst(),
            ]);

            // Sem linha gravada vale o padrao — o mesmo comportamento de antes desta tela.
            const atual = RegrasLembrete.normalizarPreferencia(pref || RegrasLembrete.PADRAO);

            return res.json({
                ...atual,
                opcoes: {
                    tipos: RegrasLembrete.TIPOS,
                    regras: RegrasLembrete.REGRAS.map(({ id, label, descricao }) => ({
                        id, label, descricao,
                    })),
                },
                // A tela mostra "3 horas antes -> 16:30" so porque sabe destes dois.
                horarios: {
                    meioSemana: config?.horaMeioSemana || '19:30',
                    fimDeSemana: config?.horaFimDeSemana || '09:00',
                },
            });
        } catch (error) {
            console.error('Erro ao buscar preferencias de notificacao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    async update(req, res) {
        try {
            const dados = RegrasLembrete.normalizarPreferencia(req.body);

            const pref = await prisma.preferenciaNotificacao.upsert({
                where: { usuarioId: req.user.id },
                update: dados,
                create: { usuarioId: req.user.id, ...dados },
            });

            return res.json({
                tipos: pref.tipos,
                antecedencias: pref.antecedencias,
            });
        } catch (error) {
            console.error('Erro ao salvar preferencias de notificacao:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}

module.exports = new PreferenciaNotificacaoController();
