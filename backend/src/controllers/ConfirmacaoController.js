'use strict';

const ConfirmacaoDesignacaoService = require('../services/ConfirmacaoDesignacaoService');

/**
 * Confirmacao das partes de estudante.
 *
 * A rotina que esta tela atende: toda semana alguem fala com quem tem parte de Leitura da
 * Biblia e de "Faca Seu Melhor no Ministerio" para saber se esta tudo certo, e anota quem
 * confirmou. Antes isso vivia num caderno.
 *
 * Area propria (escopo `confirmacoes`), separada de `reunioes`: quem confirma nao
 * necessariamente importa a programacao, e quem importa nao necessariamente confirma.
 */
class ConfirmacaoController {
    /**
     * GET /confirmacoes?passadas=1
     *
     * As partes agrupadas por reuniao, com o texto pronto e o link de WhatsApp quando o
     * telefone esta cadastrado. Por padrao so as reunioes que ainda vao acontecer — e o que
     * serve para a rotina da semana; `passadas=1` traz o historico.
     */
    async index(req, res) {
        try {
            const incluirPassadas = String(req.query.passadas || '') === '1';
            const dados = await ConfirmacaoDesignacaoService.listar({ incluirPassadas });
            return res.json(dados);
        } catch (error) {
            console.error('Erro ao listar confirmações:', error);
            return res.status(500).json({ error: 'Erro ao buscar as confirmações' });
        }
    }

    /**
     * PUT /confirmacoes
     * Body: { data, campo, nome, confirmou: true|false|null }
     */
    async registrar(req, res) {
        try {
            const { data, campo, nome, confirmou } = req.body || {};

            if (!data || !campo || !nome) {
                return res.status(400).json({ error: 'Informe data, campo e nome' });
            }
            // O campo entra numa chave unica e vem da rede: so os da lista sao aceitos, senao
            // qualquer string viraria linha nova na tabela.
            if (!ConfirmacaoDesignacaoService.CAMPOS_VALIDOS.has(campo)) {
                return res.status(400).json({ error: 'Parte inválida' });
            }
            if (confirmou !== true && confirmou !== false && confirmou !== null) {
                return res.status(400).json({ error: 'Resposta inválida' });
            }

            const registro = await ConfirmacaoDesignacaoService.registrar({
                data: String(data),
                campo: String(campo),
                nome: String(nome).trim(),
                confirmou,
            });

            return res.json({ success: true, confirmacao: registro });
        } catch (error) {
            console.error('Erro ao registrar confirmação:', error);
            return res.status(500).json({ error: 'Erro ao salvar a confirmação' });
        }
    }
}

module.exports = new ConfirmacaoController();
