'use strict';

/**
 * Converte uma data "dd/MM" de um quadro mensal para Date real.
 *
 * Um quadro pode conter dias do mes anterior, porque a escala comeca na segunda-feira da
 * semana que contem o dia 1. Assumir o mes do quadro coloca "30/06" de um quadro de julho
 * no dia 30 de julho.
 */
function resolverDataDeQuadro(dataStr, mesQuadro, anoQuadro) {
    const [dia, mes] = String(dataStr || '').split('/').map(Number);
    if (!dia || !mes) return null;
    // Unico caso em que o mes da data e maior que o do quadro: dezembro num quadro de janeiro.
    const ano = mes > mesQuadro ? anoQuadro - 1 : anoQuadro;
    return new Date(ano, mes - 1, dia);
}

/** Date -> "dd/MM". */
function formatarDiaMes(data) {
    if (!(data instanceof Date) || Number.isNaN(data.getTime())) return '';
    return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`;
}

/** Date -> "yyyy-MM-dd", em horario local (nao usar toISOString: ele converte para UTC). */
function chaveISO(data) {
    if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null;
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Meia-noite de hoje, para comparar "e futuro?" sem sofrer com a hora atual. */
function inicioDeHoje() {
    const agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

const NOMES_DIAS = [
    'Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira',
    'Quinta-Feira', 'Sexta-Feira', 'Sábado'
];

function nomeDoDia(data) {
    if (!(data instanceof Date) || Number.isNaN(data.getTime())) return '';
    return NOMES_DIAS[data.getDay()];
}

module.exports = { resolverDataDeQuadro, formatarDiaMes, chaveISO, inicioDeHoje, nomeDoDia, NOMES_DIAS };
