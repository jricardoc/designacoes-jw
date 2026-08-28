import type { SemanaReuniao } from "@/api/types";

/**
 * Datas de uma semana de programação.
 *
 * Espelha `domingoDaSemana` de backend/src/utils/semanaReuniao.js: o PDF importado traz só a
 * data do meio de semana, e a do fim de semana é o domingo que fecha aquela semana. Sem isso
 * a tela só teria o rótulo textual ("Agosto 03 - 09"), que não diz em que dia o irmão serve.
 */

const DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const MESES_CURTO = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

export interface DataDaSemana {
  data: Date;
  /** "05" — o número grande do cartão. */
  dia: string;
  /** "AGO" */
  mes: string;
  /** "Quarta" */
  diaSemana: string;
  /** "05/08" */
  diaMes: string;
}

function descrever(data: Date): DataDaSemana {
  return {
    data,
    dia: String(data.getDate()).padStart(2, "0"),
    mes: MESES_CURTO[data.getMonth()] ?? "",
    diaSemana: DIAS[data.getDay()] ?? "",
    diaMes: `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}`,
  };
}

// Sentinela gravada pela web para marcar uma linha como excluida.
const SENTINELA_DELETADO = "__DELETADO__";

/**
 * O valor de um campo da programação, ou null quando não há nada de útil ali: vazio, "-" ou
 * a sentinela de exclusão que a web grava.
 */
export function limpar(value?: string | null): string | null {
  if (!value || value === SENTINELA_DELETADO) return null;
  const t = String(value).trim();
  return t && t !== "-" ? t : null;
}

/** Interpreta "dd/MM/yyyy". Devolve null para qualquer outro formato. */
function parseData(valor?: string | null): Date | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(valor ?? ""));
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * As datas da semana. Qualquer uma pode ser null quando a importação não trouxe a data — a
 * tela cai no rótulo textual nesse caso, em vez de inventar um dia.
 *
 *   inicio — a segunda-feira que abre a semana
 *   meio   — a reunião do meio de semana (a única data que o PDF importado traz)
 *   fds    — o domingo que fecha a semana
 */
export function datasDaSemana(semana: SemanaReuniao): {
  inicio: DataDaSemana | null;
  meio: DataDaSemana | null;
  fds: DataDaSemana | null;
} {
  const meio = parseData(semana.dataReuniao);
  if (!meio) return { inicio: null, meio: null, fds: null };

  // O domingo que fecha a semana (ou o próprio dia, se já for domingo).
  const fds = new Date(meio);
  fds.setDate(fds.getDate() + ((7 - meio.getDay()) % 7));

  // A segunda que abre a semana. getDay(): 0=domingo ... 6=sábado, então (dia + 6) % 7 é
  // quantos dias recuar — e para um domingo recua 6, ficando na segunda que o antecede,
  // que é a semana que aquele domingo fecha.
  const inicio = new Date(meio);
  inicio.setDate(inicio.getDate() - ((meio.getDay() + 6) % 7));

  return { inicio: descrever(inicio), meio: descrever(meio), fds: descrever(fds) };
}

/**
 * A faixa da SEMANA, de segunda a domingo: "17/08 a 23/08".
 *
 * Não é "reunião do meio de semana até a do fim de semana" (que daria 20/08 a 23/08): a
 * semana da programação começa na segunda, e é assim que o rótulo do PDF importado e o
 * pôster do web (faixaDaSemana em pages/ReuniaoV2) a descrevem.
 */
export function faixaSemana(semana: SemanaReuniao): string {
  const { inicio, fds } = datasDaSemana(semana);
  if (!inicio || !fds) return semana.faixaData;
  return `${inicio.diaMes} a ${fds.diaMes}`;
}

/**
 * O cântico é gravado como "HH:MM|NUM" pelo importador (ex.: "19:30|56"). Mostrar o valor
 * cru vazaria o pipe para o irmão; espelha `renderCantico` de pages/ReuniaoV2 do web.
 *
 * "19:30|56" -> "19:30 · Cântico 56"; "56" -> "Cântico 56"; vazio -> null.
 */
export function canticoLegivel(valor?: string | null): string | null {
  const t = String(valor ?? "").trim();
  if (!t || t === "-" || t === "__DELETADO__") return null;

  if (!t.includes("|")) return `Cântico ${t}`;

  const [hora, num] = t.split("|");
  const numero = (num ?? "").trim();
  if (!numero) return null;
  const h = hora?.trim();
  return h && h !== "null" ? `${h} · Cântico ${numero}` : `Cântico ${numero}`;
}

/**
 * A duração nunca deve quebrar no meio: sem isto o título termina com "(4" numa linha e
 * "min)" na seguinte. O espaço vira NBSP (U+00A0), que segura as duas partes juntas tanto
 * no React Native quanto no HTML do PDF — a quebra passa a acontecer ANTES do parêntese.
 */
const duracaoInteira = (texto: string) =>
  texto.replace(/\((\d+)\s+min\)/gi, (_, n) => `(${n} min)`);

/**
 * O título da parte vem com a hora colada ("19:36 1. Joias espirituais (10 min)").
 * Espelha `renderTitleTime` do web: separa para a hora poder ir numa coluna própria.
 */
export function parteTitulo(titulo?: string | null): { hora: string | null; texto: string } | null {
  const t = String(titulo ?? "").trim();
  if (!t || t === "-" || t === "__DELETADO__") return null;

  const m = /^(\d{1,2}:\d{2})\s+(.*)$/.exec(t);
  return m
    ? { hora: m[1], texto: duracaoInteira(m[2]) }
    : { hora: null, texto: duracaoInteira(t) };
}
