'use strict';

const prisma = require('../prisma');
const { resolverDataDeQuadro, formatarDiaMes, chaveISO, nomeDoDia } = require('../utils/datas');
const { reconciliarDataReuniao, domingoDaSemana } = require('../utils/semanaReuniao');
const Confirmacoes = require('./ConfirmacaoDesignacaoService');

const { CAMPOS_CONFIRMACAO, registrar: registrarConfirmacao } = Confirmacoes;
const { tituloLimpo, ROTULO_DA_SALA } = Confirmacoes._internos;
const { relogioDaCongregacao } = require('./RegrasLembrete');

/**
 * Reune, num lugar so, tudo em que um irmao esta designado.
 *
 * As tres fontes guardam o nome como TEXTO, nao como chave estrangeira:
 *   - Designacao.irmao1 / irmao2        (quadro de designacoes)
 *   - EscalaDirigente.principal        (saidas de campo)
 *   - SemanaReuniao.<31 colunas>        (programacao da reuniao, importada de Excel/PDF)
 *
 * As duas primeiras vem de dropdowns alimentados por Irmao.nome, entao batem exatamente. A
 * terceira e digitada/importada e nao bate: aparece "Aurelio Carvalho" sem acento, ou o nome
 * de um orador visitante que nem esta no cadastro. Por isso o casamento e por tokens.
 *
 * O criterio e DELIBERADAMENTE restritivo (ver `mesmaPessoa`): e melhor deixar de mostrar um
 * compromisso do que mostrar ao irmao um compromisso que nao e dele.
 */

// --- normalizacao de nomes -------------------------------------------------

/** minusculas, sem acento, sem pontuacao nem digitos. */
function normalizar(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
        .replace(/[^a-z]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Palavras significativas: descarta "de", "da", "e" e iniciais soltas. */
function tokens(texto) {
    return normalizar(texto).split(' ').filter(t => t.length > 2);
}

/**
 * Os dois textos designam a mesma pessoa?
 *
 * Exige CONTENCAO TOTAL de tokens (um nome contido no outro) com pelo menos 2 tokens em
 * comum. Bater so o primeiro nome nao basta - e o que impede "Mauro Rodrigues", orador
 * visitante, de aparecer na lista do irmao "Mauro Santana"; e "José Rafael" de cair na
 * lista de "Rafael Carvalho".
 */
function mesmaPessoa(tokensIrmao, texto) {
    const t = tokens(texto);
    if (t.length < 2 || tokensIrmao.length < 2) {
        // Nome de uma palavra so (ex.: "Wagner"): exigimos igualdade exata.
        return t.length > 0 && normalizar(texto) === tokensIrmao.join(' ');
    }
    const contidos = (a, b) => a.every(x => b.includes(x));
    return contidos(tokensIrmao, t) || contidos(t, tokensIrmao);
}

/**
 * Um campo pode trazer varios nomes ("Fulano / Beltrano", "Grupo 2 do Fulano & Grupo 3 do
 * Beltrano"). Separamos por "/" e "&" apenas: " e " nao serve como separador porque faz
 * parte de nomes reais ("Odete Pereira e Souza").
 */
function fragmentos(valor) {
    return String(valor || '')
        .split(/[/&]/)
        .map(s => s.trim())
        .filter(Boolean);
}

const LIXO = new Set(['-', '--', 'a definir', 'a definir.', '__deletado__', 'sala b', 'salao principal']);

function ehValorUtil(valor) {
    if (!valor) return false;
    const limpo = String(valor).trim().toLowerCase();
    return limpo.length > 0 && !LIXO.has(limpo);
}

/** O nome do campo que e o irmao, como esta escrito ("Fulano / Beltrano" -> "Fulano"), ou null. */
function fragmentoDe(tokensIrmao, valor) {
    if (!ehValorUtil(valor)) return null;
    return fragmentos(valor).find(f => mesmaPessoa(tokensIrmao, f)) || null;
}

function campoMenciona(tokensIrmao, valor) {
    return fragmentoDe(tokensIrmao, valor) !== null;
}

// --- colunas de SemanaReuniao que guardam nome -----------------------------
// `momento`: "meio" usa a data da reuniao de meio de semana; "fds" usa o domingo que fecha a
// mesma semana.
//
// A LIMPEZA nao esta aqui, e a ausencia e proposital. Ela e escalada por GRUPO
// ("Limpeza: Grupo 4 Evaldo LIma"), nao por nome, entao casar por nome so alcancava o irmao
// que da nome ao grupo e deixava de fora todo o resto do grupo — que e quem limpa. Ela virou
// tarefa: services/TarefasService.js a monta a partir do grupo de campo do irmao, e ela
// aparece na secao Tarefas da tela de inicio. Mante-la nos dois lugares mostraria o mesmo
// card duas vezes na mesma tela.
const CAMPOS_REUNIAO = [
    { campo: 'presidente', rotulo: 'Presidente da reunião', momento: 'meio' },
    { campo: 'conselheiroB', rotulo: 'Conselheiro da Sala B', momento: 'meio' },
    { campo: 'oracaoInicial', rotulo: 'Oração inicial', momento: 'meio' },
    { campo: 'oracaoFinal', rotulo: 'Oração final', momento: 'meio' },

    { campo: 'tesouro1_irmao', rotulo: 'Tesouros da Palavra de Deus', momento: 'meio' },
    { campo: 'tesouro2_irmao', rotulo: 'Joias espirituais', momento: 'meio' },
    { campo: 'tesouro3_principal', rotulo: 'Leitura da Bíblia', momento: 'meio' },
    { campo: 'tesouro3_salaB', rotulo: 'Leitura da Bíblia (Sala B)', momento: 'meio' },

    { campo: 'ministerio1_principal', rotulo: 'Ministério — parte 1', momento: 'meio' },
    { campo: 'ministerio1_salaB', rotulo: 'Ministério — parte 1 (Sala B)', momento: 'meio' },
    { campo: 'ministerio2_principal', rotulo: 'Ministério — parte 2', momento: 'meio' },
    { campo: 'ministerio2_salaB', rotulo: 'Ministério — parte 2 (Sala B)', momento: 'meio' },
    { campo: 'ministerio3_principal', rotulo: 'Ministério — parte 3', momento: 'meio' },
    { campo: 'ministerio3_salaB', rotulo: 'Ministério — parte 3 (Sala B)', momento: 'meio' },
    { campo: 'ministerio4_principal', rotulo: 'Ministério — parte 4', momento: 'meio' },
    { campo: 'ministerio4_salaB', rotulo: 'Ministério — parte 4 (Sala B)', momento: 'meio' },

    { campo: 'vidaCrista1_irmao', rotulo: 'Nossa Vida Cristã — parte 1', momento: 'meio' },
    { campo: 'vidaCrista2_irmao', rotulo: 'Nossa Vida Cristã — parte 2', momento: 'meio' },
    { campo: 'estudoBiblico_dirigente', rotulo: 'Estudo bíblico de congregação — dirigente', momento: 'meio' },
    { campo: 'estudoBiblico_leitor', rotulo: 'Estudo bíblico de congregação — leitor', momento: 'meio' },

    { campo: 'mecanica_audioVideo', rotulo: 'Áudio e vídeo', momento: 'meio' },
    { campo: 'mecanica_indicadores', rotulo: 'Indicador', momento: 'meio' },
    { campo: 'mecanica_microfone', rotulo: 'Microfone volante', momento: 'meio' },

    { campo: 'fds_presidente', rotulo: 'Presidente da reunião', momento: 'fds' },
    { campo: 'fds_orador', rotulo: 'Discurso público', momento: 'fds' },
    { campo: 'fds_leitor', rotulo: 'Leitor de A Sentinela', momento: 'fds' },
    { campo: 'fds_mecanica_audioVideo', rotulo: 'Áudio e vídeo', momento: 'fds' },
    { campo: 'fds_mecanica_indicadores', rotulo: 'Indicador', momento: 'fds' },
    { campo: 'fds_mecanica_microfone', rotulo: 'Microfone volante', momento: 'fds' },
    { campo: 'fds_mecanica_portao', rotulo: 'Portão / estacionamento', momento: 'fds' },
];

/**
 * Datas de uma semana de reuniao.
 *
 * A reconciliacao com o rotulo da semana acontece na IMPORTACAO (utils/semanaReuniao.js), que
 * e onde o problema nasce. Aqui ela e refeita como rede de seguranca, para as semanas que ja
 * estavam gravadas antes dessa validacao existir.
 *
 * O domingo NAO pode sair de `Reuniao.mes`: uma semana atravessa o mes ("29 Junho - 5 Julho"),
 * entao ele vem de aritmetica de Date sobre a data do meio de semana.
 */
function datasDaSemana(semana) {
    const { dataReuniao, corrigida } = reconciliarDataReuniao(semana.faixaData, semana.dataReuniao);

    const m = String(dataReuniao || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return { meio: null, fds: null, corrigida: false, dataReuniao: null };

    const meio = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (Number.isNaN(meio.getTime())) return { meio: null, fds: null, corrigida: false, dataReuniao: null };

    // `dataReuniao` e a data como as confirmacoes a guardam (a chave da linha).
    return { meio, fds: domingoDaSemana(dataReuniao), corrigida, dataReuniao };
}

// --- montagem dos compromissos ---------------------------------------------

function compromisso({ id, tipo, data, titulo, detalhe, papel, local, horario, origem, aproximada }) {
    return {
        id,
        tipo,
        dataISO: chaveISO(data),
        data: formatarDiaMes(data),
        diaSemana: nomeDoDia(data),
        titulo,
        detalhe: detalhe || null,
        papel: papel || null,
        local: local || null,
        horario: horario || null,
        origem: origem || null,
        dataAproximada: Boolean(aproximada),
    };
}

/**
 * @param {{ id: number, nome: string }} irmao
 * @returns {Promise<Array>} compromissos ordenados por data
 */
async function listarPorIrmao(irmao) {
    if (!irmao || !irmao.nome) return [];

    const tokensIrmao = tokens(irmao.nome);
    const nomeNormalizado = normalizar(irmao.nome);
    const ehEle = (valor) => normalizar(valor) === nomeNormalizado;

    const compromissos = [];

    // 1. Quadro de designacoes ------------------------------------------------
    const designacoes = await prisma.designacao.findMany({
        where: { OR: [{ irmao1: irmao.nome }, { irmao2: irmao.nome }] },
        include: { quadro: { select: { id: true, mes: true, ano: true, titulo: true, status: true } } },
    });

    for (const d of designacoes) {
        if (!d.quadro) continue;
        // O where do Prisma e sensivel a caixa/acento; a conferencia normalizada evita
        // depender disso e ja descarta um casamento parcial.
        const eu1 = ehEle(d.irmao1);
        const eu2 = ehEle(d.irmao2);
        if (!eu1 && !eu2) continue;

        const parceiro = eu1 ? d.irmao2 : d.irmao1;
        compromissos.push(compromisso({
            id: `designacao-${d.id}`,
            tipo: 'designacao',
            data: resolverDataDeQuadro(d.data, d.quadro.mes, d.quadro.ano),
            titulo: d.funcao,
            detalhe: parceiro ? `com ${parceiro}` : null,
            origem: { tipo: 'quadro', id: d.quadro.id, titulo: d.quadro.titulo, status: d.quadro.status },
        }));
    }

    // 2. Escala de dirigentes -------------------------------------------------
    const escalas = await prisma.escalaDirigente.findMany({
        where: {
            removido: false,
            principal: irmao.nome,
        },
        include: {
            quadro: { select: { id: true, mes: true, ano: true, titulo: true, status: true } },
            saidaCampo: { select: { local: true, horario: true } },
        },
    });

    for (const e of escalas) {
        if (!e.quadro) continue;
        // Cada turno tem um unico dirigente: nao ha mais parceiro para exibir no detalhe.
        if (!ehEle(e.principal)) continue;

        compromissos.push(compromisso({
            id: `dirigente-${e.id}`,
            tipo: 'dirigente',
            data: resolverDataDeQuadro(e.data, e.quadro.mes, e.quadro.ano),
            titulo: 'Saída de campo',
            detalhe: null,
            papel: 'Dirigente',
            local: e.saidaCampo?.local,
            horario: e.saidaCampo?.horario,
            origem: { tipo: 'dirigentes', id: e.quadro.id, titulo: e.quadro.titulo, status: e.quadro.status },
        }));
    }

    // 3. Programacao da reuniao ----------------------------------------------
    const reunioes = await prisma.reuniao.findMany({ include: { semanas: true } });
    // As partes de estudante, que o proprio irmao pode confirmar: a resposta vem da mesma
    // tabela da tela de Confirmacoes.
    const aConfirmar = [];

    for (const reuniao of reunioes) {
        for (const semana of reuniao.semanas) {
            const { meio, fds, corrigida, dataReuniao } = datasDaSemana(semana);

            for (const { campo, rotulo, momento } of CAMPOS_REUNIAO) {
                const nome = fragmentoDe(tokensIrmao, semana[campo]);
                if (!nome) continue;

                const data = momento === 'fds' ? fds : meio;
                const c = compromisso({
                    id: `reuniao-${semana.id}-${campo}`,
                    tipo: 'reuniao',
                    data,
                    titulo: rotulo,
                    detalhe: momento === 'fds' ? 'Reunião do fim de semana' : 'Reunião do meio de semana',
                    origem: { tipo: 'reuniao', id: reuniao.id, titulo: semana.faixaData, status: 'publicado' },
                    // Data reconciliada com o rótulo da semana merece ressalva na tela.
                    aproximada: !data || corrigida,
                });
                compromissos.push(c);
                if (dataReuniao && CAMPOS_CONFIRMACAO.some(p => p.campo === campo)) aConfirmar.push({ c, data: dataReuniao, campo, nome });
            }
        }
    }

    if (aConfirmar.length) {
        const salvas = await prisma.confirmacaoDesignacao.findMany({
            where: { OR: aConfirmar.map(({ data, campo, nome }) => ({ data, campo, nome })) },
        });
        const resposta = new Map(salvas.map(r => [`${r.data}|${r.campo}|${r.nome}`, r.confirmou]));
        for (const { c, data, campo, nome } of aConfirmar) {
            c.confirmacao = { confirmou: resposta.get(`${data}|${campo}|${nome}`) ?? null };
        }
    }

    // 4. Territorios designados ------------------------------------------------
    // Pelo id do irmao, e nao pelo nome: a designacao ja nasce ligada ao cadastro. Entra como
    // "dirigente" para cair nos mesmos lembretes de saida de campo.
    if (irmao.id) {
        const territorios = await prisma.designacaoTerritorio.findMany({
            where: { irmaoId: irmao.id },
            include: { territorio: { select: { id: true, numero: true, nome: true } } },
        });
        for (const d of territorios) {
            const [ano, mes, dia] = d.dia.split('-').map(Number);
            compromissos.push(compromisso({
                id: `territorio-${d.id}`,
                tipo: 'dirigente',
                data: new Date(ano, mes - 1, dia),
                titulo: `Território ${d.territorio.numero}`,
                detalhe: d.territorio.nome,
                papel: 'Dirigente',
                origem: { tipo: 'territorio', id: d.territorio.id, titulo: d.territorio.numero, status: 'publicado' },
            }));
        }
    }

    return compromissos.sort((a, b) => {
        if (!a.dataISO) return 1;
        if (!b.dataISO) return -1;
        return a.dataISO.localeCompare(b.dataISO) || a.titulo.localeCompare(b.titulo);
    });
}

// --- o proprio irmao confirma a parte de estudante ---------------------------

const hojeISO = (agora = new Date()) => relogioDaCongregacao(agora).toISOString().slice(0, 10);

/** "3/9/2026" ou "03/09/2026" -> "2026-09-03". */
function isoDaReuniao(dataReuniao) {
    const m = String(dataReuniao || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

/** "Fulano avisou pelo app que não pode fazer a parte de 03/09: ..." para quem cuida das confirmacoes. */
async function avisarQuemConfirma(usuario, corpo) {
    const destinatarios = await prisma.usuario.findMany({
        where: { id: { not: usuario.id }, OR: [{ isAdmin: true }, { escopos: { has: 'confirmacoes' } }] },
        select: { id: true, pushTokens: { select: { token: true } } },
    });
    const titulo = 'Parte sem quem faça';
    const mensagens = [];
    for (const u of destinatarios) {
        const registro = await prisma.notificacaoEnviada.create({
            data: { usuarioId: u.id, titulo, corpo, data: { screen: 'confirmacoes' } },
        });
        for (const { token } of u.pushTokens) {
            mensagens.push({ to: token, title: titulo, body: corpo, data: { screen: 'confirmacoes', notifId: registro.id } });
        }
    }
    if (mensagens.length) await require('./ExpoPushService').enviar(mensagens);
}

/**
 * O irmao responde a propria parte de estudante: true ("confirmo"), false ("nao posso") ou null
 * (volta a sem resposta). Grava na MESMA linha que a tela de Confirmacoes mostra, e o "nao
 * posso" avisa por push quem cuida delas. So a parte que e dele, de reuniao que nao passou.
 */
async function confirmarParte(usuario, corpo, agora = new Date()) {
    const c = corpo || {};
    if (![true, false, null].includes(c.confirmou)) return { erro: 400, mensagem: 'Resposta inválida.' };
    const m = /^reuniao-(\d+)-(\w+)$/.exec(String(c.id || ''));
    const parte = m && CAMPOS_CONFIRMACAO.find(p => p.campo === m[2]);
    if (!parte) return { erro: 400, mensagem: 'Esta designação não pede confirmação.' };
    if (!usuario.irmaoId) return { erro: 403, mensagem: 'Sua conta ainda não está vinculada a um irmão do cadastro.' };

    const [irmao, semana] = await Promise.all([
        prisma.irmao.findUnique({ where: { id: usuario.irmaoId }, select: { nome: true } }),
        prisma.semanaReuniao.findUnique({ where: { id: Number(m[1]) } }),
    ]);
    const nome = irmao && semana ? fragmentoDe(tokens(irmao.nome), semana[parte.campo]) : null;
    if (!nome) return { erro: 404, mensagem: 'Esta parte não está mais com você.' };
    const { dataReuniao } = reconciliarDataReuniao(semana.faixaData, semana.dataReuniao);
    const dia = isoDaReuniao(dataReuniao);
    if (!dia || dia < hojeISO(agora)) return { erro: 400, mensagem: 'Esta reunião já passou.' };

    const chave = { data: dataReuniao, campo: parte.campo, nome };
    const antes = await prisma.confirmacaoDesignacao.findUnique({ where: { data_campo_nome: chave } });
    await registrarConfirmacao({ ...chave, confirmou: c.confirmou });
    if (c.confirmou === false && (!antes || antes.confirmou !== false)) {
        const titulo = tituloLimpo(semana[parte.tituloDe]) || parte.parte;
        await avisarQuemConfirma(
            usuario,
            `${nome} avisou pelo app que não pode fazer a parte de ${dia.slice(8, 10)}/${dia.slice(5, 7)}: ${titulo}, ${ROTULO_DA_SALA[parte.sala]}.`,
        );
    }
    return { confirmou: c.confirmou };
}

module.exports = {
    listarPorIrmao,
    confirmarParte,
    CAMPOS_REUNIAO,
    _internos: { normalizar, tokens, mesmaPessoa, fragmentos, fragmentoDe, campoMenciona, datasDaSemana, isoDaReuniao },
};
