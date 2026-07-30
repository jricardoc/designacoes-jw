/**
 * Regras do preenchimento automatico da Escala de Dirigentes.
 *
 * Espelham REGRAS_PADRAO de backend/src/services/EscalaDirigenteAlgoritmo.js. Nao acrescente
 * chave aqui sem acrescentar la: `sanearRegras` (DirigentesController) itera exatamente sobre
 * as chaves de REGRAS_PADRAO e descarta em silencio tudo o que nao esta nela, entao uma regra
 * a mais nesta tela vira um controle que o usuario mexe e que nao muda nada na escala.
 *
 * Com a regra de ouro (rodizio puro) nao ha mais peso, cota nem intervalo configuravel: o que
 * era "distribuicao igualitaria", "designar todos" e "intervalo de descanso" e consequencia da
 * propria fila. Sobraram as duas RESTRICOES abaixo.
 */

export const REGRAS_PADRAO = {
  respeitarIndisponibilidades: true,
  evitarDuplicidadeNoDia: true,
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
];
