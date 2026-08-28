'use strict';

const prisma = require('../prisma');
const { textoConfirmacaoDesignacao } = require('./ConviteReuniaoService');
const { tokenize, matchStrength } = require('./MatchIrmaosService');
const { reconciliarDataReuniao } = require('../utils/semanaReuniao');

/**
 * As partes de ESTUDANTE de cada semana e o estado da confirmacao de cada uma.
 *
 * O que precisa de confirmacao toda semana sao as partes com Salao Principal e Sala B: a
 * Leitura da Biblia e as quatro do "Faca Seu Melhor no Ministerio". As demais (discurso,
 * joias, vida crista, estudo biblico) sao de irmaos com designacao fixa e nao entram aqui —
 * o objetivo da tela e a rotina semanal de falar com os estudantes, nao listar a reuniao toda.
 */

// Os campos que entram na tela, com um rotulo legivel e a sala. A ordem e a da reuniao.
const CAMPOS_CONFIRMACAO = [
    { campo: 'tesouro3_principal', parte: 'Leitura da Bíblia', sala: 'principal', tituloDe: 'tesouro3_titulo' },
    { campo: 'tesouro3_salaB', parte: 'Leitura da Bíblia', sala: 'salaB', tituloDe: 'tesouro3_titulo' },
    { campo: 'ministerio1_principal', parte: 'Ministério — parte 1', sala: 'principal', tituloDe: 'ministerio1_titulo' },
    { campo: 'ministerio1_salaB', parte: 'Ministério — parte 1', sala: 'salaB', tituloDe: 'ministerio1_titulo' },
    { campo: 'ministerio2_principal', parte: 'Ministério — parte 2', sala: 'principal', tituloDe: 'ministerio2_titulo' },
    { campo: 'ministerio2_salaB', parte: 'Ministério — parte 2', sala: 'salaB', tituloDe: 'ministerio2_titulo' },
    { campo: 'ministerio3_principal', parte: 'Ministério — parte 3', sala: 'principal', tituloDe: 'ministerio3_titulo' },
    { campo: 'ministerio3_salaB', parte: 'Ministério — parte 3', sala: 'salaB', tituloDe: 'ministerio3_titulo' },
    { campo: 'ministerio4_principal', parte: 'Ministério — parte 4', sala: 'principal', tituloDe: 'ministerio4_titulo' },
    { campo: 'ministerio4_salaB', parte: 'Ministério — parte 4', sala: 'salaB', tituloDe: 'ministerio4_titulo' },
];

const CAMPOS_VALIDOS = new Set(CAMPOS_CONFIRMACAO.map(c => c.campo));

// Sentinela gravada pela web para marcar uma linha como excluida.
const LIXO = new Set(['-', '--', '__deletado__', 'a definir']);

/** "Fulana / Sicrana" sao duas pessoas. O arquivo importado separa com "/" e "&". */
function nomesDoCampo(valor) {
    return String(valor || '')
        .split(/[/&]/)
        .map(n => n.trim())
        .filter(n => n && !LIXO.has(n.toLowerCase()));
}

/** "19:36 4. Iniciando conversas (3 min)" -> "Iniciando conversas (3 min)". */
function tituloLimpo(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return null;
    return texto.replace(/^\d{1,2}:\d{2}\s*/, '').replace(/^\d+\.\s*/, '').trim() || null;
}

/** "dd/MM/yyyy" -> numero comparavel (yyyymmdd), para ordenar e cortar por periodo. */
function chaveData(data) {
    const m = String(data || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? Number(`${m[3]}${m[2]}${m[1]}`) : 0;
}

/**
 * O telefone cadastrado de quem tem a parte, quando da para saber quem e.
 *
 * O nome vem da programacao como TEXTO e boa parte das irmas nao esta no cadastro, entao isto
 * e uma tentativa, nao uma garantia. Usa o mesmo criterio de semelhanca da importacao
 * (MatchIrmaosService) para nao existirem duas regras de "e a mesma pessoa?" divergindo com o
 * tempo. So aceita quando ha UM candidato: empate entre dois "Ricardo" mandaria a mensagem
 * para o telefone errado, o que e pior do que nao ter telefone nenhum.
 */
function acharTelefone(nome, irmaosTok) {
    const tokens = tokenize(nome);
    if (tokens.length === 0) return null;

    const pontuados = irmaosTok
        .map(i => ({ i, forca: matchStrength(tokens, i.tokens) }))
        .filter(x => x.forca >= 2);
    if (pontuados.length === 0) return null;

    const melhor = Math.max(...pontuados.map(x => x.forca));
    const vencedores = pontuados.filter(x => x.forca === melhor);
    if (vencedores.length !== 1) return null;

    return vencedores[0].i.telefone || null;
}

/**
 * Link que abre a conversa no WhatsApp ja com o texto escrito.
 *
 * O numero e gravado so com digitos; o 55 do Brasil e acrescentado quando falta, porque quem
 * cadastra digita "71 99999-8888" e nao pensa no codigo do pais. Sem numero nao ha link — e a
 * tela cai no compartilhamento comum, que deixa escolher o contato na mao.
 */
function linkWhatsApp(telefone, texto) {
    const digitos = String(telefone || '').replace(/\D/g, '');
    if (digitos.length < 10) return null;
    const comPais = digitos.startsWith('55') ? digitos : `55${digitos}`;
    return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`;
}

/**
 * Monta a lista de confirmacoes, agrupada por reuniao (uma por data de meio de semana).
 *
 * @param {Object} [opcoes]
 * @param {boolean} [opcoes.incluirPassadas=false] tambem trazer reunioes que ja aconteceram
 * @param {Date} [opcoes.agora] injetavel para o teste fixar o relogio
 */
async function listar({ incluirPassadas = false, agora = new Date() } = {}) {
    const [reunioes, salvas, irmaos] = await Promise.all([
        prisma.reuniao.findMany({ include: { semanas: true } }),
        prisma.confirmacaoDesignacao.findMany(),
        prisma.irmao.findMany({
            where: { ativo: true },
            select: { id: true, nome: true, telefone: true },
        }),
    ]);

    const irmaosTok = irmaos.map(i => ({ ...i, tokens: tokenize(i.nome) }));

    // Chave (data|campo|nome) -> o que ja foi respondido.
    const respondidas = new Map(salvas.map(c => [`${c.data}|${c.campo}|${c.nome}`, c.confirmou]));

    const hoje = Number(
        `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}`
    );

    const reunioesSaida = [];

    for (const reuniao of reunioes) {
        for (const semana of reuniao.semanas) {
            // A mesma rede de seguranca de MinhasDesignacoes: a data pode ter entrado
            // contradizendo o rotulo da semana antes de a validacao da importacao existir.
            const { dataReuniao } = reconciliarDataReuniao(semana.faixaData, semana.dataReuniao);
            if (!dataReuniao) continue;

            const chave = chaveData(dataReuniao);
            if (!incluirPassadas && chave < hoje) continue;

            const partes = [];
            for (const { campo, parte, sala, tituloDe } of CAMPOS_CONFIRMACAO) {
                for (const nome of nomesDoCampo(semana[campo])) {
                    const texto = textoConfirmacaoDesignacao(nome, agora);
                    const telefone = acharTelefone(nome, irmaosTok);
                    partes.push({
                        // A identidade de uma linha para o PUT: a mesma chave da tabela.
                        data: dataReuniao,
                        campo,
                        nome,
                        parte,
                        sala,
                        titulo: tituloLimpo(semana[tituloDe]),
                        confirmou: respondidas.get(`${dataReuniao}|${campo}|${nome}`) ?? null,
                        texto,
                        // null quando o irmao nao esta no cadastro ou nao tem numero: a tela
                        // esconde a opcao de WhatsApp direto em vez de abrir link quebrado.
                        whatsapp: telefone ? linkWhatsApp(telefone, texto) : null,
                    });
                }
            }

            if (partes.length === 0) continue;

            reunioesSaida.push({
                data: dataReuniao,
                faixaData: semana.faixaData,
                leituraSemanal: semana.leituraSemanal,
                partes,
                // O que a tela mostra no cabecalho do grupo sem ter de recontar.
                total: partes.length,
                confirmadas: partes.filter(p => p.confirmou === true).length,
                recusadas: partes.filter(p => p.confirmou === false).length,
            });
        }
    }

    reunioesSaida.sort((a, b) => chaveData(a.data) - chaveData(b.data));
    return { reunioes: reunioesSaida };
}

/**
 * Grava (ou limpa) a resposta de uma pessoa.
 * @param {boolean|null} confirmou true = vai cumprir, false = nao vai, null = volta a "sem resposta"
 */
async function registrar({ data, campo, nome, confirmou }) {
    return prisma.confirmacaoDesignacao.upsert({
        where: { data_campo_nome: { data, campo, nome } },
        update: { confirmou },
        create: { data, campo, nome, confirmou },
    });
}

module.exports = {
    listar,
    registrar,
    CAMPOS_CONFIRMACAO,
    CAMPOS_VALIDOS,
    _internos: { nomesDoCampo, tituloLimpo, chaveData, linkWhatsApp, acharTelefone },
};
