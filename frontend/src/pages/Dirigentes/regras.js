/**
 * Regras do preenchimento automatico da Escala de Dirigentes.
 *
 * Os defaults espelham REGRAS_PADRAO de backend/src/services/EscalaDirigenteAlgoritmo.js.
 * Mantenha os dois lados em sincronia: o backend reaplica os proprios padroes para qualquer
 * chave ausente, entao divergir aqui so causa confusao na tela, nao erro.
 */

export const REGRAS_PADRAO = {
  respeitarIndisponibilidades: true,
  evitarDuplicidadeNoDia: true,
  distribuicaoIgualitaria: true,
  ponderarDisponibilidade: true,
  designarTodos: true,
  evitarRepeticoes: true,
  equilibrarPapeis: true,
  rodizioLocais: true,
  evitarRepetirDupla: true,
  considerarMesAnterior: true,
  preencherSubstituto: true,
  diasDescanso: 7,
};

export const REGRAS_ESSENCIAIS = [
  {
    chave: 'respeitarIndisponibilidades',
    label: 'Respeitar Indisponibilidades',
    desc: 'Nunca escalar um irmão em data que ele marcou como ocupada',
  },
  {
    chave: 'evitarDuplicidadeNoDia',
    label: 'Evitar Duplicidade',
    desc: 'O mesmo irmão no máximo uma vez por dia, mesmo com vários turnos de sábado',
  },
  {
    chave: 'distribuicaoIgualitaria',
    label: 'Distribuição Igualitária',
    desc: 'Equilibrar a quantidade de designações entre todos',
  },
  {
    chave: 'ponderarDisponibilidade',
    label: 'Ponderar Disponibilidade',
    desc: 'Quem está habilitado em poucas saídas não perde as poucas chances que tem para quem cabe em qualquer dia',
  },
  {
    chave: 'designarTodos',
    label: 'Designar Todos',
    desc: 'Garantir pelo menos uma designação para cada dirigente cadastrado',
  },
];

export const REGRAS_AVANCADAS = [
  {
    chave: 'evitarRepeticoes',
    label: 'Intervalo de Descanso',
    desc: 'Espaçar as designações de um mesmo irmão ao longo do mês',
  },
  {
    chave: 'equilibrarPapeis',
    label: 'Alternar Principal e Substituto',
    desc: 'Evitar que alguém seja sempre substituto (ou sempre principal)',
  },
  {
    chave: 'rodizioLocais',
    label: 'Rodízio de Locais',
    desc: 'Variar as saídas de campo de cada irmão em vez de repetir sempre a mesma',
  },
  {
    chave: 'evitarRepetirDupla',
    label: 'Variar as Duplas',
    desc: 'Evitar que a mesma dupla principal + substituto se repita o mês todo',
  },
  {
    chave: 'considerarMesAnterior',
    label: 'Considerar o Mês Anterior',
    desc: 'Compensar quem serviu mais no mês passado e respeitar o descanso na virada',
  },
  {
    chave: 'preencherSubstituto',
    label: 'Preencher Substituto',
    desc: 'Desligue para gerar apenas o dirigente principal de cada saída',
  },
];
