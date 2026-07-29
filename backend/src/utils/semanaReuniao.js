'use strict';

/**
 * Conferencia entre o rotulo da semana ("Março 9 - 15") e a data da reuniao ("12/03/2026").
 *
 * Nao e paranoia: a planilha de MARCO/2026 enviada pela congregacao trazia, nas celulas das
 * semanas 2 e 3, "12/02/2026" e "19/01/2026" - dia certo, mes errado, decrescendo a cada
 * semana. O parser lia fielmente o que estava la e o erro entrava no banco em silencio,
 * levando junto as telas de Reuniao e a lista de compromissos de cada irmao.
 *
 * O arquivo de origem nao da para consertar daqui. O que da e detectar a contradicao na hora
 * da importacao, corrigir quando o rotulo for INEQUIVOCO e avisar quem importou.
 */

const MESES_PT = {
    janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
};

function normalizar(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
        .replace(/[^a-z]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Le a faixa da semana e so devolve algo quando ela e INEQUIVOCA: um unico mes citado e dois
 * dias. Faixas que atravessam o mes ("29 Junho - 5 Julho") ou que vem corrompidas com dois
 * meses ("27 Junho - 2 Agosto") sao descartadas - usa-las para corrigir faria o contrario.
 */
function faixaInequivoca(faixaData) {
    const texto = normalizar(faixaData);
    const meses = Object.entries(MESES_PT).filter(([nome]) => texto.includes(nome));
    if (meses.length !== 1) return null;

    const dias = String(faixaData || '').match(/\d{1,2}/g);
    if (!dias || dias.length < 2) return null;

    const inicio = Number(dias[0]);
    const fim = Number(dias[dias.length - 1]);
    if (!(inicio >= 1 && fim >= inicio && fim <= 31)) return null;

    return { mes: meses[0][1], inicio, fim };
}

/**
 * Reconcilia `dataReuniao` com `faixaData`.
 *
 * @returns {{ dataReuniao: string|null, corrigida: boolean, aviso: string|null }}
 *          `dataReuniao` sai no mesmo formato "dd/MM/yyyy" que entrou.
 */
function reconciliarDataReuniao(faixaData, dataReuniao) {
    const m = String(dataReuniao || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return { dataReuniao: dataReuniao || null, corrigida: false, aviso: null };

    const dia = Number(m[1]);
    const mes = Number(m[2]);
    const ano = Number(m[3]);

    const faixa = faixaInequivoca(faixaData);
    if (!faixa || faixa.mes === mes) {
        return { dataReuniao, corrigida: false, aviso: null };
    }

    // O dia precisa caber no intervalo do rotulo e existir no mes alvo.
    const cabeNoRotulo = dia >= faixa.inicio && dia <= faixa.fim;
    const candidata = new Date(ano, faixa.mes - 1, dia);
    const diaExiste = candidata.getDate() === dia;

    if (!cabeNoRotulo || !diaExiste) {
        return {
            dataReuniao,
            corrigida: false,
            aviso: `A semana "${faixaData}" tem data de reunião ${dataReuniao}, que não bate com o rótulo. Confira no arquivo de origem.`
        };
    }

    const corrigido = `${String(dia).padStart(2, '0')}/${String(faixa.mes).padStart(2, '0')}/${ano}`;
    return {
        dataReuniao: corrigido,
        corrigida: true,
        aviso: `A semana "${faixaData}" vinha com a data ${dataReuniao} no arquivo (mês divergente do rótulo). Foi corrigida para ${corrigido}.`
    };
}

/**
 * Aplica a reconciliacao em todas as semanas e devolve os avisos para exibir a quem importou.
 * @returns {{ semanas: Array, avisos: string[] }}
 */
function reconciliarSemanas(semanas) {
    const avisos = [];
    const corrigidas = (semanas || []).map(s => {
        const r = reconciliarDataReuniao(s.faixaData, s.dataReuniao);
        if (r.aviso) avisos.push(r.aviso);
        return r.corrigida ? { ...s, dataReuniao: r.dataReuniao } : s;
    });
    return { semanas: corrigidas, avisos };
}

/** Domingo que fecha a semana da `dataReuniao` (ou o proprio dia, se ja for domingo). */
function domingoDaSemana(dataReuniao) {
    const m = String(dataReuniao || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    const meio = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (Number.isNaN(meio.getTime())) return null;
    const fds = new Date(meio);
    fds.setDate(fds.getDate() + ((7 - meio.getDay()) % 7));
    return fds;
}

module.exports = { reconciliarDataReuniao, reconciliarSemanas, faixaInequivoca, domingoDaSemana, MESES_PT };
