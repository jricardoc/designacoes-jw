'use strict';

const prisma = require('../prisma');
const Regras = require('./RegrasTarefas');
const TarefasService = require('./TarefasService');
const { resolverDataDeQuadro, chaveISO } = require('../utils/datas');

/**
 * O painel do admin geral: quem esta com o que, o que atrasou e como a congregacao vem se
 * saindo.
 *
 * A lista do irmao responde "o que EU tenho de fazer". Este responde "as tarefas estao sendo
 * feitas?" — e sao perguntas diferentes o bastante para justificarem servicos diferentes: uma
 * olha um usuario e o presente, o outro olha todos e o passado.
 *
 * O QUE E MEDIDO, E O QUE NAO E
 * As tres tarefas de conclusao manual (Zoom, Compartilhar Quadro, Confirmacoes) tem registro
 * exato por pessoa e por ocorrencia — `TarefaConcluida`, com a data do check. Delas sai a
 * taxa por pessoa.
 *
 * As duas de quadro nao: elas se cumprem PUBLICANDO, e publicar e trabalho compartilhado —
 * quem aperta o botao nao e necessariamente quem montou. Por isso elas nao entram na taxa por
 * pessoa (seria numero inventado) e aparecem numa secao propria, mes a mes, com quem publicou
 * e se saiu no prazo. Inventar rateio ali daria um painel bonito e errado.
 */

/** Janela padrao do desempenho. Tres meses pega os dois quadros e umas doze semanas. */
const JANELA_PADRAO = 90;

const IDS_MANUAIS = Regras.TIPOS.filter(t => t.conclusao === 'manual').map(t => t.id);

/**
 * O check caiu dentro do prazo?
 *
 * O prazo vale ate o FIM do dia do vencimento — quem concluiu as 23h do dia do prazo cumpriu.
 * A comparacao e por DIA DE CALENDARIO DA CONGREGACAO, e nao por instante: `concluidoEm` e um
 * timestamp UTC, e as 22h de Bahia ja sao o dia seguinte la — comparar cru marcaria como
 * atrasado quem concluiu a tempo.
 */
function concluiuNoPrazo(concluidoEm, vencimentoISO) {
    if (!concluidoEm || !vencimentoISO) return false;
    return TarefasService.hojeEmBahia(concluidoEm) <= vencimentoISO;
}

// ---------------------------------------------------------------------------
// Pendencias de agora
// ---------------------------------------------------------------------------

/**
 * Tudo que esta pendente AGORA, de todo mundo.
 *
 * Reaproveita `montarParaUsuario` em vez de refazer o recorte: a tela do irmao e o painel
 * precisam concordar sobre o que esta pendente, e duas implementacoes divergiriam no primeiro
 * ajuste de janela.
 */
function pendenciasDe(usuarios, contexto) {
    const pendencias = [];

    for (const usuario of usuarios) {
        const grupo = TarefasService.grupoDoUsuario(usuario, contexto.grupos);

        const tarefas = TarefasService.montarParaUsuario({
            contexto,
            designadas: usuario.tarefas.map(t => t.tipo),
            concluidas: new Set(usuario.tarefasConcluidas.map(c => `${c.tipo}|${c.ocorrencia}`)),
            grupoId: grupo?.id ?? null,
        });

        for (const tarefa of tarefas) {
            // A limpeza fica de fora do painel: ela nao e entrega de ninguem, e listar a
            // semana de limpeza de 128 pessoas afogaria o que de fato precisa de olho.
            if (tarefa.situacao === 'informativa') continue;

            pendencias.push({
                usuarioId: usuario.id,
                nome: usuario.nome,
                tipo: tarefa.tipo,
                label: tarefa.label,
                icone: tarefa.icone,
                ocorrencia: tarefa.ocorrencia,
                titulo: tarefa.titulo,
                detalhe: tarefa.detalhe,
                vencimentoISO: tarefa.vencimentoISO,
                prazo: tarefa.prazo,
                diasAteVencer: tarefa.diasAteVencer,
                situacao: tarefa.situacao,
            });
        }
    }

    // Atrasadas no topo, e dentro de cada grupo o prazo mais apertado primeiro.
    return pendencias.sort(
        (a, b) =>
            (a.diasAteVencer ?? 999) - (b.diasAteVencer ?? 999) || a.nome.localeCompare(b.nome),
    );
}

// ---------------------------------------------------------------------------
// Desempenho das tarefas manuais
// ---------------------------------------------------------------------------

/**
 * Quantas ocorrencias cada irmao DEVERIA ter cumprido na janela, e quantas cumpriu.
 *
 * O corte por `createdAt` da atribuicao e o que impede o numero de mentir: quem recebeu a
 * tarefa ontem apareceria com 3 meses de faltas, e a taxa dele diria mais sobre quando ele foi
 * designado do que sobre o trabalho dele.
 */
function desempenhoManual(usuarios, contexto, inicioISO, hojeISO) {
    const porPessoa = [];
    const porTarefa = new Map(IDS_MANUAIS.map(id => [id, { previstas: 0, cumpridas: 0, noPrazo: 0 }]));
    const geral = { previstas: 0, cumpridas: 0, noPrazo: 0 };

    for (const usuario of usuarios) {
        const checks = new Map(
            usuario.tarefasConcluidas.map(c => [`${c.tipo}|${c.ocorrencia}`, c.concluidoEm]),
        );

        const linha = { usuarioId: usuario.id, nome: usuario.nome, previstas: 0, cumpridas: 0, noPrazo: 0 };

        for (const atribuicao of usuario.tarefas) {
            if (!IDS_MANUAIS.includes(atribuicao.tipo)) continue;

            const desde = TarefasService.hojeEmBahia(atribuicao.createdAt);

            for (const oc of contexto.porTipo[atribuicao.tipo] || []) {
                if (!oc.vencimentoISO) continue;
                if (oc.vencimentoISO < inicioISO || oc.vencimentoISO > hojeISO) continue;
                // Antes de ele receber a tarefa, a ocorrencia nao era dele.
                if (oc.vencimentoISO < desde) continue;

                const concluidoEm = checks.get(`${atribuicao.tipo}|${oc.ocorrencia}`);
                const cumpriu = !!concluidoEm;
                const noPrazo = cumpriu && concluiuNoPrazo(concluidoEm, oc.vencimentoISO);

                linha.previstas += 1;
                if (cumpriu) linha.cumpridas += 1;
                if (noPrazo) linha.noPrazo += 1;

                const tarefa = porTarefa.get(atribuicao.tipo);
                tarefa.previstas += 1;
                if (cumpriu) tarefa.cumpridas += 1;
                if (noPrazo) tarefa.noPrazo += 1;

                geral.previstas += 1;
                if (cumpriu) geral.cumpridas += 1;
                if (noPrazo) geral.noPrazo += 1;
            }
        }

        // Quem nao tinha nenhuma tarefa manual na janela nao vira linha de zero: uma taxa de
        // 0% para quem nunca teve o que fazer acusa a pessoa errada.
        if (linha.previstas > 0) porPessoa.push({ ...linha, taxa: linha.cumpridas / linha.previstas });
    }

    porPessoa.sort((a, b) => a.taxa - b.taxa || b.previstas - a.previstas);

    return {
        geral: { ...geral, taxa: geral.previstas > 0 ? geral.cumpridas / geral.previstas : null },
        porPessoa,
        porTarefa: IDS_MANUAIS.map(id => {
            const t = porTarefa.get(id);
            return {
                tipo: id,
                label: Regras.tipoPorId(id).label,
                ...t,
                taxa: t.previstas > 0 ? t.cumpridas / t.previstas : null,
            };
        }),
    };
}

// ---------------------------------------------------------------------------
// Historico dos quadros
// ---------------------------------------------------------------------------

/** O ultimo dia coberto por um quadro, a partir das datas "dd/MM" das linhas dele. */
function ultimoDiaCoberto(quadro, datas) {
    const isos = datas
        .map(d => chaveISO(resolverDataDeQuadro(d, quadro.mes, quadro.ano)))
        .filter(Boolean)
        .sort();
    return isos.length > 0 ? isos[isos.length - 1] : Regras.ultimoDiaDoMes(quadro.ano, quadro.mes);
}

/**
 * Mes a mes: quando cada quadro saiu, por quem, e se saiu antes de o anterior acabar.
 *
 * O prazo de um quadro e o ULTIMO DIA COBERTO PELO ANTERIOR — e por isso o primeiro quadro da
 * lista nunca e avaliado: nao existe anterior de onde tirar prazo.
 */
function linhaDoTempoDosQuadros(quadros, tipoId, inicioISO) {
    const linhas = [];

    for (let i = 1; i < quadros.length; i += 1) {
        const anterior = quadros[i - 1];
        const atual = quadros[i];

        const vencimentoISO = anterior.ultimoDia;
        if (vencimentoISO < inicioISO) continue;

        const publicadoISO = atual.publicadoEm ? TarefasService.hojeEmBahia(atual.publicadoEm) : null;
        const atraso = publicadoISO ? Regras.diasAte(vencimentoISO, publicadoISO) : null;

        linhas.push({
            tipo: tipoId,
            label: Regras.tipoPorId(tipoId).label,
            referencia: `${Regras.NOMES_MESES[atual.mes - 1]} de ${atual.ano}`,
            vencimentoISO,
            publicadoEm: publicadoISO,
            publicadoPor: atual.publicadoPor?.nome ?? null,
            // Negativo = dias de atraso. `null` = publicado antes de existir a coluna que
            // guarda a data, e o painel diz isso em vez de contar como pontual.
            diasDeAtraso: atraso === null ? null : Math.max(0, -atraso),
            situacao: publicadoISO === null ? 'semRegistro' : atraso >= 0 ? 'noPrazo' : 'atrasado',
        });
    }

    return linhas.reverse();
}

async function quadrosDeDesignacoes() {
    const quadros = await prisma.quadro.findMany({
        where: { status: 'publicado' },
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
        select: {
            mes: true, ano: true, publicadoEm: true,
            publicadoPor: { select: { nome: true } },
            designacoes: { select: { data: true } },
        },
    });
    return quadros.map(q => ({ ...q, ultimoDia: ultimoDiaCoberto(q, q.designacoes.map(d => d.data)) }));
}

async function quadrosDeDirigentes() {
    const quadros = await prisma.quadroDirigente.findMany({
        where: { status: 'publicado' },
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
        select: {
            mes: true, ano: true, publicadoEm: true,
            publicadoPor: { select: { nome: true } },
            escalas: { where: { removido: false }, select: { data: true } },
        },
    });
    return quadros.map(q => ({ ...q, ultimoDia: ultimoDiaCoberto(q, q.escalas.map(e => e.data)) }));
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

async function montar({ agora = new Date(), janelaDias = JANELA_PADRAO } = {}) {
    const contexto = await TarefasService.carregarContexto(agora);
    const hojeISO = contexto.hojeISO;
    const inicioISO = Regras.somarDias(hojeISO, -janelaDias);

    const [usuarios, designacoes, dirigentes] = await Promise.all([
        prisma.usuario.findMany({
            select: {
                id: true,
                nome: true,
                nickname: true,
                irmaoId: true,
                tarefas: { select: { tipo: true, createdAt: true } },
                tarefasConcluidas: { select: { tipo: true, ocorrencia: true, concluidoEm: true } },
                pushTokens: { select: { id: true } },
            },
            orderBy: { nome: 'asc' },
        }),
        quadrosDeDesignacoes(),
        quadrosDeDirigentes(),
    ]);

    const comTarefa = usuarios.filter(u => u.tarefas.length > 0);

    const pendencias = pendenciasDe(usuarios, contexto).map(p => ({
        ...p,
        // Sem aparelho registrado o lembrete nao chega, e o botao so frustraria.
        temAparelho: usuarios.find(u => u.id === p.usuarioId)?.pushTokens.length > 0,
    }));

    const atribuidos = new Set(usuarios.flatMap(u => u.tarefas.map(t => t.tipo)));

    return {
        hoje: hojeISO,
        janelaDias,
        inicioISO,
        resumo: {
            pessoasComTarefa: comTarefa.length,
            pendentes: pendencias.length,
            atrasadas: pendencias.filter(p => p.situacao === 'atrasada').length,
            alerta: pendencias.filter(p => p.situacao === 'alerta').length,
        },
        pendencias,
        // Tarefa que ninguem faz e o buraco mais caro do sistema, e o unico jeito de ve-lo e
        // dizer o nome dela.
        semResponsavel: Regras.CATALOGO.filter(t => !atribuidos.has(t.id)).map(t => ({
            id: t.id,
            label: t.label,
        })),
        desempenho: desempenhoManual(usuarios, contexto, inicioISO, hojeISO),
        quadros: [
            ...linhaDoTempoDosQuadros(designacoes, 'quadroDesignacoes', inicioISO),
            ...linhaDoTempoDosQuadros(dirigentes, 'quadroDirigentes', inicioISO),
        ].sort((a, b) => b.vencimentoISO.localeCompare(a.vencimentoISO)),
        equipe: usuarios.map(u => ({
            id: u.id,
            nome: u.nome,
            nickname: u.nickname,
            vinculado: u.irmaoId !== null,
            temAparelho: u.pushTokens.length > 0,
            tarefas: Regras.sanearTarefas(u.tarefas.map(t => t.tipo)),
        })),
    };
}

module.exports = {
    montar,
    JANELA_PADRAO,
    _internos: { pendenciasDe, desempenhoManual, linhaDoTempoDosQuadros, ultimoDiaCoberto, concluiuNoPrazo },
};
