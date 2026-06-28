import type { FuncaoId } from "@/api/types";

/** Functions a brother can be assigned, as shown in the editor. */
export const FUNCOES: { id: FuncaoId; label: string; color: string }[] = [
  { id: "microfone", label: "Microfone", color: "#3b82f6" },
  { id: "indicador", label: "Indicador", color: "#10b981" },
  { id: "audioVideo", label: "Áudio e Vídeo", color: "#8b5cf6" },
  { id: "estacionamento", label: "Estacionamento", color: "#f59e0b" },
  { id: "dirigente", label: "Dirigente", color: "#ef4444" },
];

/** Maps the designação `funcao` label (as stored on a Designacao) to a FuncaoId. */
export const FUNCAO_LABEL_TO_ID: Record<string, FuncaoId> = {
  "Microfone Volante": "microfone",
  Indicador: "indicador",
  "Audio e Video": "audioVideo",
  "Áudio e Vídeo": "audioVideo",
  Estacionamento: "estacionamento",
};

/** Canonical order of functions inside a day. */
export const ORDEM_FUNCAO = [
  "Microfone Volante",
  "Indicador",
  "Audio e Video",
  "Estacionamento",
];

export function ordenarFuncoes<T extends { funcao: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => ORDEM_FUNCAO.indexOf(a.funcao) - ORDEM_FUNCAO.indexOf(b.funcao),
  );
}

export function funcaoLabel(id: FuncaoId): string {
  return FUNCOES.find((f) => f.id === id)?.label ?? id;
}

export function funcaoColor(id: FuncaoId): string {
  return FUNCOES.find((f) => f.id === id)?.color ?? "#64748b";
}
