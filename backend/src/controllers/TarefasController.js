'use strict';

const prisma = require('../prisma');
const TarefasService = require('../services/TarefasService');
const PainelTarefasService = require('../services/PainelTarefasService');
const LembreteTarefasService = require('../services/LembreteTarefasService');
const Regras = require('../services/RegrasTarefas');

/**
 * As tarefas de sistema: a lista do irmao logado e a atribuicao feita pelo admin geral.
 *
 * Quem ATRIBUI e sempre o admin geral, como em escopos e no resto do cadastro de usuario —
 * decidir quem manda o link do Zoom e quem monta o quadro e a mesma classe de decisao que
 * decidir quem administra uma area.
 *
 * Quem LE a propria lista e qualquer irmao logado, e so a propria: nao ha rota para ver a
 * lista de outro.
 *
 * A excecao e o PAINEL (`/tarefas/painel`), que ve a congregacao inteira e por isso exige
 * admin geral — quem cobra a tarefa e quem a distribui.
 */
class TarefasController {
    /** As tarefas pendentes do usuario logado — o To-Do da tela de inicio. */
    async index(req, res) {
        try {
            const resultado = await TarefasService.listarPorUsuario(req.user);
            return res.json(resultado);
        } catch (error) {
            console.error('[tarefas] falha ao listar:', error);
            return res.status(500).json({ error: 'Erro ao carregar as tarefas' });
        }
    }

    /**
     * Marca uma ocorrencia como cumprida (ou desfaz).
     *
     * O corpo traz `tipo` e `ocorrencia` em vez do id composto: o id que o app usa
     * ("zoom|2026-09-03") e conveniencia de tela, e quebrar string no servidor para
     * reconstruir dois campos so cria um lugar a mais para errar.
     */
    async concluir(req, res) {
        try {
            const { tipo, ocorrencia, desfazer } = req.body || {};

            const resultado = await TarefasService.concluir(req.user.id, tipo, ocorrencia, {
                desfazer: desfazer === true,
            });

            if (!resultado.ok) {
                const mensagens = {
                    TIPO_DESCONHECIDO: 'Essa tarefa não existe.',
                    // A de quadro nao tem botao: ela se resolve publicando o quadro. Se o app
                    // mandar mesmo assim (build antigo), a recusa explica em vez de fingir.
                    NAO_CONCLUIVEL: 'Essa tarefa se conclui sozinha quando o quadro é publicado.',
                    OCORRENCIA_INVALIDA: 'Ocorrência inválida.',
                };
                return res.status(400).json({ error: mensagens[resultado.motivo] || 'Não deu para concluir.' });
            }

            // Devolve a lista ja recalculada: a tela tira o card na hora, sem uma segunda
            // ida a rede logo depois do toque.
            const lista = await TarefasService.listarPorUsuario(req.user);
            return res.json({ ...lista, concluida: resultado.concluida });
        } catch (error) {
            console.error('[tarefas] falha ao concluir:', error);
            return res.status(500).json({ error: 'Erro ao salvar a tarefa' });
        }
    }

    /**
     * O painel do admin geral: pendencias de todo mundo, desempenho e os quadros mes a mes.
     *
     * `janela` em dias, para o admin trocar o recorte sem build novo. Limitada a um ano:
     * acima disso a leitura da programacao inteira comeca a pesar e o numero deixa de dizer
     * algo sobre como a congregacao esta HOJE.
     */
    async painel(req, res) {
        try {
            const bruto = parseInt(req.query.janela, 10);
            const janelaDias = Number.isInteger(bruto) && bruto > 0 ? Math.min(bruto, 365) : undefined;

            const painel = await PainelTarefasService.montar(
                janelaDias ? { janelaDias } : {},
            );
            return res.json(painel);
        } catch (error) {
            console.error('[tarefas] falha ao montar o painel:', error);
            return res.status(500).json({ error: 'Erro ao carregar o painel' });
        }
    }

    /** Cobra um irmao, agora, sobre uma pendencia especifica. */
    async lembrar(req, res) {
        try {
            const { usuarioId, tipo, ocorrencia } = req.body || {};
            if (!Number.isInteger(usuarioId)) {
                return res.status(400).json({ error: 'Informe `usuarioId`.' });
            }

            const resultado = await LembreteTarefasService.lembrarAgora({ usuarioId, tipo, ocorrencia });

            if (!resultado.ok) {
                const mensagens = {
                    USUARIO_NAO_ENCONTRADO: 'Usuário não encontrado.',
                    SEM_APARELHO: 'Esse irmão não tem aparelho registrado — o aviso não chegaria.',
                    NAO_PENDENTE: 'Essa tarefa não está mais pendente para ele.',
                };
                return res.status(400).json({ error: mensagens[resultado.motivo] || 'Não deu para lembrar.' });
            }

            return res.json({
                enviados: resultado.enviados,
                falhas: resultado.falhas,
                mensagem: `Lembrete enviado para ${resultado.nome}.`,
            });
        } catch (error) {
            console.error('[tarefas] falha ao lembrar:', error);
            return res.status(500).json({ error: 'Erro ao enviar o lembrete' });
        }
    }

    /** Catalogo das tarefas atribuiveis, para a tela desenhar sem duplicar os textos. */
    async catalogo(req, res) {
        return res.json({ tarefas: Regras.CATALOGO });
    }

    /** As tarefas de um usuario especifico (admin geral). */
    async doUsuario(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isInteger(id)) {
                return res.status(400).json({ error: 'Usuario invalido' });
            }
            const tarefas = await TarefasService.tarefasDesignadas(id);
            return res.json({ tarefas });
        } catch (error) {
            console.error('[tarefas] falha ao ler as do usuario:', error);
            return res.status(500).json({ error: 'Erro ao carregar as tarefas do usuário' });
        }
    }

    /**
     * Substitui a lista de tarefas de um usuario.
     *
     * Ao contrario de `atualizarEscopos`, aqui NAO ha trava contra mexer em si mesmo: escopo e
     * permissao (e trancar-se fora e irreversivel sem outro admin), tarefa e responsabilidade
     * — o admin geral tirar de si a tarefa de montar o quadro nao tranca ninguem fora de nada.
     * Admin geral tambem pode receber tarefa: ele costuma ser justamente quem monta os quadros.
     */
    async definir(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isInteger(id)) {
                return res.status(400).json({ error: 'Usuario invalido' });
            }

            const usuario = await prisma.usuario.findUnique({ where: { id }, select: { id: true } });
            if (!usuario) {
                return res.status(404).json({ error: 'Usuario nao encontrado' });
            }

            // Corpo invalido nao pode virar "remover tudo": um erro de digitacao no cliente
            // apagaria as tarefas do irmao devolvendo 200. Mesma regra de atualizarEscopos.
            const bruto = req.body && req.body.tarefas;
            if (!Array.isArray(bruto)) {
                return res.status(400).json({ error: 'Informe `tarefas` como lista.' });
            }

            const tarefas = Regras.sanearTarefas(bruto);
            if (tarefas.length !== new Set(bruto).size) {
                return res.status(400).json({
                    error: 'Alguma tarefa informada não existe ou não pode ser atribuída.',
                    tarefasValidas: Regras.IDS_ATRIBUIVEIS,
                });
            }

            await TarefasService.definirTarefas(id, tarefas);
            return res.json({ tarefas });
        } catch (error) {
            console.error('[tarefas] falha ao definir:', error);
            return res.status(500).json({ error: 'Erro ao salvar as tarefas' });
        }
    }
}

module.exports = new TarefasController();
