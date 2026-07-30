import type { RegrasEscala } from "@/api/types";

/**
 * Regras do preenchimento automático da Escala de Dirigentes.
 *
 * Espelham REGRAS_PADRAO de backend/src/services/EscalaDirigenteAlgoritmo.js. Não acrescente
 * chave aqui sem acrescentar lá: `sanearRegras` (DirigentesController) itera exatamente sobre
 * as chaves de REGRAS_PADRAO e descarta em silêncio tudo o que não está nela, então uma regra
 * a mais nesta tela vira um controle que o usuário mexe e que não muda nada na escala.
 *
 * Com a regra de ouro (rodízio puro) não há mais peso, cota nem intervalo configurável: o que
 * era "distribuição igualitária", "designar todos" e "intervalo de descanso" é consequência da
 * própria fila. Sobraram as duas RESTRIÇÕES abaixo.
 */
export const REGRAS_PADRAO: RegrasEscala = {
  respeitarIndisponibilidades: true,
  evitarDuplicidadeNoDia: true,
};

export type ChaveRegraBooleana = keyof RegrasEscala;

export interface DescricaoRegra {
  chave: ChaveRegraBooleana;
  label: string;
  desc: string;
}

export const REGRAS_ESSENCIAIS: DescricaoRegra[] = [
  {
    chave: "respeitarIndisponibilidades",
    label: "Respeitar Indisponibilidades",
    desc: "Nunca escalar um irmão em data que ele marcou como ocupada",
  },
  {
    chave: "evitarDuplicidadeNoDia",
    label: "Evitar Duplicidade",
    desc: "O mesmo irmão no máximo uma vez por dia, mesmo com vários turnos de sábado",
  },
];
