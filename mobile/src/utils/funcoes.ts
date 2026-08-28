import type { FuncaoId, PrivilegioId } from "@/api/types";

/**
 * Privilégios de serviço. Espelha frontend/src/utils/privilegios.js e os valores aceitos por
 * `normalizarPrivilegio` em backend/src/controllers/IrmaoController.js.
 * O irmão tem no máximo um, e pode não ter nenhum.
 */
export const PRIVILEGIOS: {
  id: PrivilegioId;
  label: string;
  abreviacao: string;
  color: string;
  bg: string;
}[] = [
  { id: "anciao", label: "Ancião", abreviacao: "Ancião", color: "#7A5C9E", bg: "#EFE9F5" },
  {
    id: "servoMinisterial",
    label: "Servo Ministerial",
    abreviacao: "Servo Min.",
    color: "#2F6F7E",
    bg: "#E4EFF2",
  },
];

export function privilegioInfo(id: PrivilegioId | null | undefined) {
  if (!id) return null;
  return PRIVILEGIOS.find((p) => p.id === id) ?? null;
}

export function privilegioLabel(id: PrivilegioId | null | undefined): string {
  return privilegioInfo(id)?.label ?? "";
}

/** Functions a brother can be assigned, as shown in the editor. */
export const FUNCOES: { id: FuncaoId; label: string; color: string }[] = [
  { id: "microfone", label: "Microfone", color: "#3b82f6" },
  { id: "indicador", label: "Indicador", color: "#10b981" },
  { id: "audioVideo", label: "Áudio e Vídeo", color: "#8b5cf6" },
  { id: "estacionamento", label: "Estacionamento", color: "#f59e0b" },
  { id: "dirigente", label: "Dirigente", color: "#ef4444" },
  { id: "carrinho", label: "Carrinho", color: "#0ea5a4" },
];

/**
 * As funções que cada tratamento pode receber.
 *
 * As designações mecânicas e a escala de dirigentes são de irmãos — o quadro e a escala são
 * montados só com eles. O carrinho é de todos. Separar aqui evita oferecer na tela uma função
 * que nunca vai ser usada, e evita o engano de marcar uma irmã como indicadora.
 */
export const FUNCOES_POR_GENERO: Record<"irmao" | "irma", FuncaoId[]> = {
  irmao: FUNCOES.map((f) => f.id),
  irma: ["carrinho"],
};

/** As funções oferecidas para quem ainda não tem tratamento definido: todas. */
export function funcoesDisponiveis(genero: "irmao" | "irma" | null | undefined) {
  const permitidas = genero ? FUNCOES_POR_GENERO[genero] : FUNCOES.map((f) => f.id);
  return FUNCOES.filter((f) => permitidas.includes(f.id));
}

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
