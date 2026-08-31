'use strict';

const prisma = require('../prisma');
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

    /**
     * PUT /confirmacoes/telefone
     * Body: { irmaoId, telefone }
     *
     * Grava o WhatsApp de quem tem parte, direto da tela de Confirmacoes.
     *
     * Existe como rota PROPRIA, e nao reaproveitando `PUT /irmaos/:id`, por causa da
     * permissao: aquela exige admin geral, e quem faz as confirmacoes tem so o escopo da
     * area. Dar admin geral a essas pessoas para elas poderem digitar um telefone seria
     * pagar caro demais; esta rota faz UMA coisa e nada mais — nem nome, nem funcoes, nem
     * privilegio passam por aqui.
     */
    async salvarTelefone(req, res) {
        try {
            const { irmaoId, telefone } = req.body || {};

            if (!Number.isInteger(irmaoId)) {
                return res.status(400).json({ error: 'Informe `irmaoId`.' });
            }

            // So digitos. Quem cadastra digita "(71) 99999-8888", e guardar a pontuacao
            // faria o link do WhatsApp quebrar mais tarde, longe daqui.
            const digitos = String(telefone ?? '').replace(/\D/g, '');

            // Vazio APAGA o numero — e o caminho de quem cadastrou errado e quer voltar
            // atras sem inventar um numero falso.
            if (digitos.length > 0 && (digitos.length < 10 || digitos.length > 13)) {
                return res.status(400).json({
                    error: 'Número inválido. Use DDD + número, como 71999998888.',
                });
            }

            const irmao = await prisma.irmao.findUnique({
                where: { id: irmaoId },
                select: { id: true, nome: true },
            });
            if (!irmao) {
                return res.status(404).json({ error: 'Pessoa não encontrada no cadastro.' });
            }

            const atualizado = await prisma.irmao.update({
                where: { id: irmaoId },
                data: { telefone: digitos.length > 0 ? digitos : null },
                select: { id: true, nome: true, telefone: true },
            });

            return res.json({ irmao: atualizado });
        } catch (error) {
            console.error('Erro ao salvar o telefone:', error);
            return res.status(500).json({ error: 'Erro ao salvar o número' });
        }
    }
}

module.exports = new ConfirmacaoController();
