/**
 * As contas da assistência por mês. Sem import nenhum, para dar para conferir com
 * `node --no-warnings scripts/verificarAssistencia.mjs`.
 */

export interface RegistroAssistencia {
  /** "dd/MM/yyyy" */
  data: string;
  tipo: "meio" | "fds";
  presencial: number;
  zoom: number;
}

export interface ResumoMes {
  reunioes: number;
  total: number;
  /** Médias por reunião, arredondadas como no cartão S-88 (inteiro mais próximo). */
  media: number;
  mediaPresencial: number;
  mediaZoom: number;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "16/10/2026" -> "2026-10" (null se a data não for legível). */
export function chaveMes(data: string): string | null {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(data);
  return m ? `${m[3]}-${m[2]}` : null;
}

/** "2026-10" -> "outubro de 2026"; curto -> "out". */
export function nomeMes(mes: string, curto = false): string {
  const [ano, numero] = mes.split("-").map(Number);
  const nome = MESES[numero - 1] ?? "?";
  return curto ? nome.slice(0, 3) : `${nome} de ${ano}`;
}

/** Soma `delta` meses a "2026-10" (cruzando o ano). */
export function somarMeses(mes: string, delta: number): string {
  const [ano, numero] = mes.split("-").map(Number);
  const total = ano * 12 + (numero - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Os `n` meses que terminam em `mes`, do mais antigo ao mais novo. */
export function mesesAte(mes: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somarMeses(mes, i - n + 1));
}

/** As reuniões do mês (de um tipo, ou das duas), da mais antiga à mais nova. */
export function reunioesDoMes<T extends RegistroAssistencia>(registros: T[], mes: string, tipo?: "meio" | "fds"): T[] {
  const dia = (r: T) => Number(r.data.slice(0, 2));
  return registros
    .filter((r) => chaveMes(r.data) === mes && (!tipo || r.tipo === tipo))
    .sort((a, b) => dia(a) - dia(b));
}

/** Reuniões, total e médias do mês; null quando não há nenhuma reunião registrada. */
export function resumoDoMes(registros: RegistroAssistencia[], mes: string, tipo?: "meio" | "fds"): ResumoMes | null {
  const doMes = reunioesDoMes(registros, mes, tipo);
  if (doMes.length === 0) return null;
  const soma = (f: (r: RegistroAssistencia) => number) => doMes.reduce((s, r) => s + f(r), 0);
  const total = soma((r) => r.presencial + r.zoom);
  return {
    reunioes: doMes.length,
    total,
    media: Math.round(total / doMes.length),
    mediaPresencial: Math.round(soma((r) => r.presencial) / doMes.length),
    mediaZoom: Math.round(soma((r) => r.zoom) / doMes.length),
  };
}

/** Variação em % de `anterior` para `atual` (inteiro); null sem base para comparar. */
export function variacao(atual: number, anterior: number | null | undefined): number | null {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}
