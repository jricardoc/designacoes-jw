'use strict';

const prisma = require('../prisma');
const Regras = require('./RegrasTarefas');
const Limpeza = require('./LimpezaGrupoService');
const { relogioDaCongregacao } = require('./RegrasLembrete');
const { resolverDataDeQuadro, chaveISO } = require('../utils/datas');
const { reconciliarDataReuniao, domingoDaSemana } = require('../utils/semanaReuniao');

/**
 * A lista de "o que eu tenho de fazer" de cada irmao.
 *
 * As tarefas nao sao guardadas ocorrencia por ocorrencia: elas sao DERIVADAS da programacao
 * importada e dos quadros, toda vez que alguem pergunta. Gravar cada repeticao significaria
 * criar linha para cada semana de cada irmao e mante-las em dia a cada reimportacao do mes —
 * que e exatamente a operacao que apaga e recria as semanas com ids novos. Derivar custa duas
 * consultas e nunca fica desatualizado.
 *
 * O unico estado gravado e o CHECK (TarefaConcluida) e a ATRIBUICAO (TarefaDesignada).
 *
 * O contexto (as ocorrencias possiveis) e montado UMA vez e servido a todos os usuarios: o
 * agendador de lembretes percorre a congregacao inteira, e recalcular as datas da programacao
 * por irmao multiplicaria as consultas por gente.
 */

/** Dia de calendario da congregacao, em YYYY-MM-DD. */
function hojeEmBahia(agora = new Date()) {
    return relogioDaCongregacao(agora).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Ocorrencias vindas da programacao (reunioes e semanas)
// ---------------------------------------------------------------------------

/**
 * As datas de uma semana da programacao, em ISO.
 *
 * A reconciliacao com o rotulo e refeita aqui como rede de seguranca, pelo mesmo motivo de
 * MinhasDesignacoesService: as semanas gravadas antes daquela validacao existir podem ter a
 * `dataReuniao` divergindo da `faixaData`.
 */
function datasDaSemana(semana) {
    const { dataReuniao } = reconciliarDataReuniao(semana.faixaData, semana.dataReuniao);
    const m = String(dataReuniao || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return { meioISO: null, fdsISO: null };

    const meio = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (Number.isNaN(meio.getTime())) return { meioISO: null, fdsISO: null };

    return { meioISO: chaveISO(meio), fdsISO: chaveISO(domingoDaSemana(dataReuniao)) };
}

/** Monta a ocorrencia ja com os limites calculados, para nao repetir a conta em cada uso. */
function ocorrenciaDe(tipo, { alvoISO, ocorrencia, titulo, detalhe, referencia, grupo }) {
    const vencimentoISO = Regras.vencimentoDe(tipo, alvoISO);
    return {
        tipo: tipo.id,
        ocorrencia: ocorrencia || alvoISO,
        alvoISO,
        vencimentoISO,
        aberturaISO: Regras.aberturaDe(tipo, alvoISO, vencimentoISO),
        limiteISO: Regras.limiteDe(tipo, alvoISO),
        titulo,
        detalhe: detalhe || null,
        referencia: referencia || null,
        grupo: grupo || null,
    };
}

/** "Reunião de quinta, 03/09" — o texto que identifica a ocorrencia na tela. */
function rotuloDaReuniao(dataISO, momento) {
    const nome = momento === 'fds' ? 'Reunião do fim de semana' : 'Reunião do meio de semana';
    return `${nome} · ${Regras.diaMes(dataISO)}`;
}

// ---------------------------------------------------------------------------
// Ocorrencias vindas dos quadros
// ---------------------------------------------------------------------------

/**
 * O prazo de um quadro mensal: o ultimo dia que o quadro ATUAL cobre.
 *
 * E o prazo que o proprio irmao descreveu — "se nao for feito ate hoje, na segunda-feira nao
 * tera escala". Nao e o fim do mes de calendario: um quadro comeca na segunda da semana que
 * contem o dia 1 e termina no ultimo dia escalado, que quase nunca e o dia 30 ou 31.
 *
 * O quadro de referencia e o ultimo PUBLICADO, nao o ultimo criado: rascunho ainda muda de
 * mao e pode ser descartado, entao contar com ele como escala vigente deixaria a congregacao
 * sem aviso justamente no mes em que o quadro foi comecado e abandonado.
 *
 * @param {{ano:number,mes:number}|null} quadro
 * @param {string[]} datasCobertas datas "dd/MM" das linhas do quadro
 */
function prazoDoQuadro(quadro, datasCobertas, hojeISO) {
    if (!quadro) {
        // Nenhum quadro publicado: nao ha escala nenhuma, e o prazo e agora.
        const [ano, mes] = hojeISO.split('-').map(Number);
        return { vencimentoISO: hojeISO, alvo: { ano, mes } };
    }

    const isos = datasCobertas
        .map(data => chaveISO(resolverDataDeQuadro(data, quadro.mes, quadro.ano)))
        .filter(Boolean)
        .sort();

    const vencimentoISO = isos.length > 0
        ? isos[isos.length - 1]
        : Regras.ultimoDiaDoMes(quadro.ano, quadro.mes);

    return { vencimentoISO, alvo: Regras.mesSeguinte(quadro.ano, quadro.mes) };
}

/** "setembro de 2026" — como a tarefa se refere ao mes que falta montar. */
function referenciaDoMes({ ano, mes }) {
    return `${Regras.NOMES_MESES[mes - 1]} de ${ano}`;
}

async function ocorrenciaDoQuadroDesignacoes(hojeISO) {
    const publicado = await prisma.quadro.findFirst({
        where: { status: 'publicado' },
        orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
        select: { ano: true, mes: true, designacoes: { select: { data: true } } },
    });

    const { vencimentoISO, alvo } = prazoDoQuadro(
        publicado,
        publicado ? publicado.designacoes.map(d => d.data) : [],
        hojeISO,
    );

    const tipo = Regras.tipoPorId('quadroDesignacoes');
    return ocorrenciaDe(tipo, {
        alvoISO: vencimentoISO,
        // Ocorrencia = o 1o dia do mes que falta montar. Data ISO de verdade (e nao "2026-09")
        // porque a mesma chave viaja para LembreteEnviado.dataISO.
        ocorrencia: `${alvo.ano}-${String(alvo.mes).padStart(2, '0')}-01`,
        titulo: `Montar o quadro de ${referenciaDoMes(alvo)}`,
        detalhe: publicado
            ? `O quadro atual termina em ${Regras.diaMes(vencimentoISO)}`
            : 'Nenhum quadro publicado ainda',
        referencia: referenciaDoMes(alvo),
    });
}

async function ocorrenciaDoQuadroDirigentes(hojeISO) {
    const publicado = await prisma.quadroDirigente.findFirst({
        where: { status: 'publicado' },
        orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
        select: {
            ano: true,
            mes: true,
            escalas: { where: { removido: false }, select: { data: true } },
        },
    });

    const { vencimentoISO, alvo } = prazoDoQuadro(
        publicado,
        publicado ? publicado.escalas.map(e => e.data) : [],
        hojeISO,
    );

    const tipo = Regras.tipoPorId('quadroDirigentes');
    return ocorrenciaDe(tipo, {
        alvoISO: vencimentoISO,
        ocorrencia: `${alvo.ano}-${String(alvo.mes).padStart(2, '0')}-01`,
        titulo: `Montar a escala de dirigentes de ${referenciaDoMes(alvo)}`,
        detalhe: publicado
            ? `A escala atual termina em ${Regras.diaMes(vencimentoISO)}`
            : 'Nenhuma escala publicada ainda',
        referencia: referenciaDoMes(alvo),
    });
}

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

/**
 * Tudo que existe para ser feito, sem olhar quem faz.
 *
 * Uma leitura da programacao, uma de cada quadro e uma dos grupos — servidas a congregacao
 * inteira. O recorte por irmao acontece depois, em `montarParaUsuario`, que so faz filtro.
 */
async function carregarContexto(agora = new Date()) {
    const hojeISO = hojeEmBahia(agora);

    const [reunioes, grupos, ocorrenciaDesignacoes, ocorrenciaDirigentes] = await Promise.all([
        prisma.reuniao.findMany({
            select: {
                semanas: {
                    select: { id: true, faixaData: true, dataReuniao: true, limpeza: true },
                },
            },
        }),
        Limpeza.carregarGrupos(),
        ocorrenciaDoQuadroDesignacoes(hojeISO),
        ocorrenciaDoQuadroDirigentes(hojeISO),
    ]);

    const porTipo = {
        zoom: [],
        compartilharQuadro: [],
        confirmacoes: [],
        limpeza: [],
        quadroDesignacoes: [ocorrenciaDesignacoes],
        quadroDirigentes: [ocorrenciaDirigentes],
    };

    const tipoZoom = Regras.tipoPorId('zoom');
    const tipoCompartilhar = Regras.tipoPorId('compartilharQuadro');
    const tipoConfirmacoes = Regras.tipoPorId('confirmacoes');
    const tipoLimpeza = Regras.tipoPorId('limpeza');

    const avisosDeLimpeza = [];

    for (const reuniao of reunioes) {
        for (const semana of reuniao.semanas) {
            const { meioISO, fdsISO } = datasDaSemana(semana);

            // Uma tarefa por reuniao: as duas reunioes da semana tem convite proprio (ver
            // ConviteReuniaoService) e quadro proprio, entao sao ocorrencias separadas.
            for (const [dataISO, momento] of [[meioISO, 'meio'], [fdsISO, 'fds']]) {
                if (!dataISO) continue;
                const rotulo = rotuloDaReuniao(dataISO, momento);
                porTipo.zoom.push(ocorrenciaDe(tipoZoom, {
                    alvoISO: dataISO,
                    titulo: 'Mandar o link do Zoom',
                    detalhe: rotulo,
                    referencia: rotulo,
                }));
                porTipo.compartilharQuadro.push(ocorrenciaDe(tipoCompartilhar, {
                    alvoISO: dataISO,
                    titulo: 'Compartilhar o quadro de designações',
                    detalhe: rotulo,
                    referencia: rotulo,
                }));
            }

            // Semanais: a reuniao de meio de semana e o que representa a semana. Sem ela a
            // semana nao tem ancora, e uma confirmacao sem prazo nao serve de lembrete.
            if (!meioISO) continue;

            porTipo.confirmacoes.push(ocorrenciaDe(tipoConfirmacoes, {
                alvoISO: meioISO,
                titulo: 'Fazer as confirmações da semana',
                detalhe: semana.faixaData,
                referencia: semana.faixaData,
            }));

            const { grupos: escalados, naoCasados } = Limpeza.gruposDaSemana(semana.limpeza, grupos);
            for (const fragmento of naoCasados) {
                avisosDeLimpeza.push({ semana: semana.faixaData, fragmento: fragmento.bruto });
            }
            for (const { grupo } of escalados) {
                porTipo.limpeza.push(ocorrenciaDe(tipoLimpeza, {
                    alvoISO: meioISO,
                    titulo: 'Limpeza do salão',
                    detalhe: `${semana.faixaData} · Grupo ${grupo.nome}`,
                    referencia: semana.faixaData,
                    grupo: { id: grupo.id, nome: grupo.nome },
                }));
            }
        }
    }

    return { hojeISO, porTipo, grupos, avisosDeLimpeza };
}

// ---------------------------------------------------------------------------
// Recorte por usuario
// ---------------------------------------------------------------------------

/**
 * As tarefas visiveis de um irmao, ja ordenadas por prazo.
 *
 * `concluidas` e um Set de "tipo|ocorrencia". `designadas` e a lista de tipos que o admin deu
 * a ele. A limpeza NAO passa por `designadas`: ela vem do grupo de campo, e nao de atribuicao
 * — foi assim que o irmao pediu ("so de o usuario estar com um grupo, isso aparece").
 *
 * As de quadro tambem nao consultam `concluidas`: elas somem quando o quadro do mes seguinte
 * e publicado, e isso ja esta refletido no proprio vencimento da ocorrencia (que pula um mes
 * e sai da janela). Ver RegrasTarefas.TIPOS[].conclusao.
 */
function montarParaUsuario({ contexto, designadas, concluidas, grupoId }) {
    const { hojeISO, porTipo } = contexto;
    const marcadas = concluidas instanceof Set ? concluidas : new Set(concluidas || []);
    const meus = new Set(Regras.sanearTarefas(designadas));

    const saida = [];

    for (const tipo of Regras.TIPOS) {
        if (tipo.id === 'limpeza') {
            if (!grupoId) continue;
        } else if (!meus.has(tipo.id)) {
            continue;
        }

        for (const oc of porTipo[tipo.id] || []) {
            if (tipo.id === 'limpeza' && oc.grupo?.id !== grupoId) continue;
            if (!Regras.estaVisivel(oc, hojeISO)) continue;
            if (tipo.conclusao === 'manual' && marcadas.has(`${tipo.id}|${oc.ocorrencia}`)) continue;

            const dias = Regras.diasAte(oc.vencimentoISO, hojeISO);
            saida.push({
                // Estavel e unico: e o que o app usa como key e o que volta no "concluir".
                id: `${tipo.id}|${oc.ocorrencia}`,
                tipo: tipo.id,
                label: tipo.label,
                icone: tipo.icone,
                cadencia: tipo.cadencia,
                cadenciaLabel: Regras.rotuloDaCadencia(tipo.cadencia),
                conclusao: tipo.conclusao,
                concluivel: tipo.conclusao === 'manual',
                acao: tipo.acao,
                ocorrencia: oc.ocorrencia,
                titulo: oc.titulo,
                detalhe: oc.detalhe,
                // O que a ocorrencia nomeia ("setembro de 2026", "31 de Agosto - 06 de
                // Setembro"). Vai junto porque o texto do push precisa dela — e nao do
                // `detalhe`, que e prosa de card ("O quadro atual termina em 31/08").
                referencia: oc.referencia,
                vencimentoISO: oc.vencimentoISO,
                // A informativa nao "vence": ela so avisa quando e. Ver rotuloInformativo.
                prazo: tipo.conclusao === 'nenhuma'
                    ? Regras.rotuloInformativo(oc.vencimentoISO, hojeISO)
                    : Regras.rotuloDoPrazo(oc.vencimentoISO, hojeISO),
                diasAteVencer: dias,
                // A informativa nunca fica "atrasada": nao ha entrega para atrasar, e pintar
                // o card de vermelho cobraria do irmao uma coisa que e do grupo inteiro.
                atrasada: tipo.conclusao !== 'nenhuma' && dias !== null && dias < 0,
                grupo: oc.grupo,
            });
        }
    }

    // Prazo primeiro, e a atrasada no topo (o `dias` negativo ordena sozinho). Empate cai no
    // titulo para a lista nao dancar entre dois carregamentos.
    return saida.sort((a, b) => {
        const da = a.diasAteVencer ?? Number.POSITIVE_INFINITY;
        const db = b.diasAteVencer ?? Number.POSITIVE_INFINITY;
        return da - db || a.titulo.localeCompare(b.titulo);
    });
}

// ---------------------------------------------------------------------------
// Entradas de uso
// ---------------------------------------------------------------------------

/** Os tipos que o admin atribuiu a este usuario. */
async function tarefasDesignadas(usuarioId) {
    const linhas = await prisma.tarefaDesignada.findMany({
        where: { usuarioId },
        select: { tipo: true },
    });
    return Regras.sanearTarefas(linhas.map(l => l.tipo));
}

/** Substitui a lista inteira de tarefas de um usuario pelo que a tela mandou. */
async function definirTarefas(usuarioId, tipos) {
    const desejados = Regras.sanearTarefas(tipos);

    // Apaga o que saiu e cria o que entrou, em vez de apagar tudo e recriar: assim o
    // `createdAt` de quem continua com a tarefa nao e reescrito a cada salvamento.
    // `notIn: []` nao serve para "apague tudo": a condicao vazia deixaria de recortar por
    // tipo e o Prisma nem sempre a interpreta igual. Com a lista vazia o que se quer e apagar
    // as tarefas do usuario, e e isso que o outro ramo diz.
    await prisma.tarefaDesignada.deleteMany({
        where: desejados.length > 0
            ? { usuarioId, tipo: { notIn: desejados } }
            : { usuarioId },
    });
    if (desejados.length > 0) {
        await prisma.tarefaDesignada.createMany({
            data: desejados.map(tipo => ({ usuarioId, tipo })),
            skipDuplicates: true,
        });
    }
    return desejados;
}

/** O grupo de campo do usuario, ou null (sem vinculo com o cadastro, ou sem grupo). */
function grupoDoUsuario(usuario, grupos) {
    const grupo = Limpeza.grupoDoIrmao(usuario?.irmaoId, grupos);
    return grupo ? { id: grupo.id, nome: grupo.nome } : null;
}

/**
 * A lista de tarefas de um irmao — o que a tela de inicio pede.
 *
 * @param {{id:number, irmaoId:number|null}} usuario
 */
async function listarPorUsuario(usuario, { agora = new Date(), contexto = null } = {}) {
    const ctx = contexto || await carregarContexto(agora);

    const [designadas, concluidas] = await Promise.all([
        tarefasDesignadas(usuario.id),
        prisma.tarefaConcluida.findMany({
            where: { usuarioId: usuario.id },
            select: { tipo: true, ocorrencia: true },
        }),
    ]);

    const grupo = grupoDoUsuario(usuario, ctx.grupos);

    const tarefas = montarParaUsuario({
        contexto: ctx,
        designadas,
        concluidas: new Set(concluidas.map(c => `${c.tipo}|${c.ocorrencia}`)),
        grupoId: grupo?.id ?? null,
    });

    return {
        hoje: ctx.hojeISO,
        designadas,
        grupo,
        tarefas,
        total: tarefas.length,
        atrasadas: tarefas.filter(t => t.atrasada).length,
    };
}

/**
 * Marca (ou desmarca) uma ocorrencia como cumprida.
 *
 * Recusa o que nao e concluivel a mao: as de quadro se resolvem publicando o quadro, e aceitar
 * um check aqui deixaria o prazo ser silenciado sem a escala existir.
 */
async function concluir(usuarioId, tipoId, ocorrencia, { desfazer = false } = {}) {
    const tipo = Regras.tipoPorId(tipoId);
    if (!tipo) return { ok: false, motivo: 'TIPO_DESCONHECIDO' };
    if (tipo.conclusao !== 'manual') return { ok: false, motivo: 'NAO_CONCLUIVEL' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ocorrencia || ''))) {
        return { ok: false, motivo: 'OCORRENCIA_INVALIDA' };
    }

    if (desfazer) {
        await prisma.tarefaConcluida.deleteMany({ where: { usuarioId, tipo: tipoId, ocorrencia } });
        return { ok: true, concluida: false };
    }

    // Idempotente: tocar duas vezes no botao (ou dois aparelhos do mesmo irmao) nao pode virar
    // erro na tela de quem so quis marcar como feito.
    await prisma.tarefaConcluida.createMany({
        data: [{ usuarioId, tipo: tipoId, ocorrencia }],
        skipDuplicates: true,
    });
    return { ok: true, concluida: true };
}

module.exports = {
    carregarContexto,
    montarParaUsuario,
    listarPorUsuario,
    tarefasDesignadas,
    definirTarefas,
    grupoDoUsuario,
    concluir,
    hojeEmBahia,
    _internos: { datasDaSemana, prazoDoQuadro, referenciaDoMes, rotuloDaReuniao, ocorrenciaDe },
};
