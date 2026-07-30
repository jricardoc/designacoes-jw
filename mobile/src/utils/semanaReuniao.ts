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

/** Interpreta "dd/MM/yyyy". Devolve null para qualquer outro formato. */
function parseData(valor?: string | null): Date | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(valor ?? ""));
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * { meio, fds } da semana. Qualquer um dos dois pode ser null quando a importação não trouxe
 * a data — a tela cai no rótulo textual nesse caso, em vez de inventar um dia.
 */
export function datasDaSemana(semana: SemanaReuniao): {
  meio: DataDaSemana | null;
  fds: DataDaSemana | null;
} {
  const meio = parseData(semana.dataReuniao);
  if (!meio) return { meio: null, fds: null };

  // O domingo que fecha a semana (ou o próprio dia, se já for domingo).
  const fds = new Date(meio);
  fds.setDate(fds.getDate() + ((7 - meio.getDay()) % 7));

  return { meio: descrever(meio), fds: descrever(fds) };
}

/** "03/08 a 09/08" para o cabeçalho, ou o rótulo do PDF quando não há datas. */
export function faixaLegivel(semana: SemanaReuniao): string {
  const { meio, fds } = datasDaSemana(semana);
  if (!meio || !fds) return semana.faixaData;
  return `${meio.diaMes} a ${fds.diaMes}`;
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
 * O título da parte vem com a hora colada ("19:36 1. Joias espirituais (10 min)").
 * Espelha `renderTitleTime` do web: separa para a hora poder ir numa coluna própria.
 */
export function parteTitulo(titulo?: string | null): { hora: string | null; texto: string } | null {
  const t = String(titulo ?? "").trim();
  if (!t || t === "-" || t === "__DELETADO__") return null;

  const m = /^(\d{1,2}:\d{2})\s+(.*)$/.exec(t);
  return m ? { hora: m[1], texto: m[2] } : { hora: null, texto: t };
}
