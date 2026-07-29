'use strict';

/**
 * Ordem canonica dos dias da semana no sistema.
 *
 * `SaidaCampo.diaSemana` e uma string, entao `orderBy: { diaSemana: 'asc' }` no Prisma ordena
 * em ordem ALFABETICA - quarta, quinta, sabado, segunda, sexta, terca -, que nao e a ordem em
 * que ninguem pensa numa semana. Cada tela que se importava com isso reordenava por conta
 * propria no cliente, e as que nao reordenavam exibiam a lista embaralhada.
 *
 * Aqui fica o criterio unico: o backend devolve na ordem certa e todo consumidor herda.
 */

const ORDEM_DIAS = {
    // A semana da congregacao vai de segunda a sabado (gerarDiasDoMes exclui domingo), entao
    // uma saida de domingo - que o modal do mobile permite cadastrar - vai para o fim, e nao
    // para o inicio. E a mesma convencao que o EditarIrmaoModal ja usava no cliente.
    segunda: 1, 'segunda-feira': 1,
    terca: 2, 'terça': 2, 'terça-feira': 2, 'terca-feira': 2,
    quarta: 3, 'quarta-feira': 3,
    quinta: 4, 'quinta-feira': 4,
    sexta: 5, 'sexta-feira': 5,
    sabado: 6, 'sábado': 6,
    domingo: 7
};

/** Peso de um dia da semana; valores desconhecidos vao para o fim, sem quebrar a ordenacao. */
function pesoDiaSemana(diaSemana) {
    const chave = String(diaSemana || '').trim().toLowerCase();
    return ORDEM_DIAS[chave] !== undefined ? ORDEM_DIAS[chave] : 99;
}

/**
 * Compara duas saidas de campo: dia da semana, depois turno, depois horario, depois id.
 * O id no fim garante ordem estavel mesmo com cadastros identicos.
 */
function compararSaidasCampo(a, b) {
    const dia = pesoDiaSemana(a.diaSemana) - pesoDiaSemana(b.diaSemana);
    if (dia !== 0) return dia;

    const turno = (a.turno || 0) - (b.turno || 0);
    if (turno !== 0) return turno;

    const horario = String(a.horario || '').localeCompare(String(b.horario || ''));
    if (horario !== 0) return horario;

    return (a.id || 0) - (b.id || 0);
}

module.exports = { ORDEM_DIAS, pesoDiaSemana, compararSaidasCampo };
