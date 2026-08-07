/**
 * Dados fixos das salas de Zoom da congregação. Os links são recorrentes — nunca
 * mudam de reunião para reunião; o que muda no convite (datas, leitura, orador,
 * tema) sai da programação importada.
 */

export const NOME_CONGREGACAO = "Norte de Itapuã";

export const ZOOM_MEIO_SEMANA = {
  link: "https://jworg.zoom.us/j/84981240952",
  id: "849 8124 0952",
  senha: "jw1010",
  /** Horário em que a sala abre, como vai escrito no convite. */
  salaAberta: "19:00",
} as const;

export const ZOOM_FIM_DE_SEMANA = {
  link: "https://jworg.zoom.us/j/84423800527",
  id: "844 2380 0527",
  senha: "jw1010",
  salaAberta: "08:30",
} as const;
