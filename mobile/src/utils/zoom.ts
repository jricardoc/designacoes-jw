import { DIAS_CURTOS } from "@/theme";

const dois = (n: number) => String(n).padStart(2, "0");

export const TIPO_REUNIAO: Record<string, string> = { meio: "Meio de semana", fds: "Fim de semana" };

/** "19:30" */
export const hora = (isoData: string | null) => {
  if (!isoData) return "—";
  const d = new Date(isoData);
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

/** "Qui, 22/10 · 19:30" */
export function quandoFoi(inicio: string | null) {
  if (!inicio) return "Sem horário";
  const d = new Date(inicio);
  return `${DIAS_CURTOS[d.getDay()]}, ${dois(d.getDate())}/${dois(d.getMonth() + 1)} · ${hora(inicio)}`;
}

/** 6360 -> "1h46", 600 -> "10 min" */
export function duracao(segundos: number) {
  const min = Math.round(segundos / 60);
  return min >= 60 ? `${Math.floor(min / 60)}h${dois(min % 60)}` : `${min} min`;
}
