import type { Designacao, Irmao } from "@/api/types";
import { FUNCAO_LABEL_TO_ID } from "@/utils/funcoes";

export interface GrupoDia {
  data: string;
  dia: string;
  funcoes: Designacao[];
}

/** Brothers eligible for a function label, active and matching, sorted by name. */
export function getIrmaosParaFuncao(irmaos: Irmao[], funcaoLabel: string): Irmao[] {
  const funcaoId = FUNCAO_LABEL_TO_ID[funcaoLabel] ?? "microfone";
  return irmaos
    .filter((i) => i.ativo && i.funcoes.includes(funcaoId))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export function isIndisponivel(irmaos: Irmao[], nome: string, data: string): boolean {
  const irmao = irmaos.find((i) => i.nome === nome);
  if (!irmao) return false;
  return irmao.indisponibilidades?.some((ind) => ind.data === data) ?? false;
}

/** True when the brother already serves on the adjacent (previous/next) day. */
export function isDesignacaoSeguida(
  grupos: GrupoDia[],
  nome: string,
  dataAtual: string,
): boolean {
  if (!nome) return false;
  const idx = grupos.findIndex((g) => g.data === dataAtual);
  if (idx === -1) return false;

  const has = (g?: GrupoDia) =>
    !!g && g.funcoes.some((f) => f.irmao1 === nome || f.irmao2 === nome);

  return has(grupos[idx - 1]) || has(grupos[idx + 1]);
}

/** True when the brother already serves in another function on the same day. */
export function isDesignadoNoMesmoDia(
  grupos: GrupoDia[],
  nome: string,
  dataAtual: string,
  funcaoAtual: string,
  campoAtual: "irmao1" | "irmao2",
): boolean {
  if (!nome) return false;
  const dia = grupos.find((g) => g.data === dataAtual);
  if (!dia) return false;

  return dia.funcoes.some((f) => {
    const mesma = f.funcao === funcaoAtual;
    const c1 = mesma && campoAtual === "irmao1" ? false : f.irmao1 === nome;
    const c2 = mesma && campoAtual === "irmao2" ? false : f.irmao2 === nome;
    return c1 || c2;
  });
}

/** Group designações by date, sorted chronologically by dd/MM. */
export function agruparPorData(designacoes: Designacao[]): GrupoDia[] {
  const map: Record<string, GrupoDia> = {};
  for (const d of designacoes) {
    if (!map[d.data]) map[d.data] = { data: d.data, dia: d.dia, funcoes: [] };
    map[d.data].funcoes.push(d);
  }
  return Object.values(map).sort((a, b) => {
    const [da, ma] = a.data.split("/").map(Number);
    const [db, mb] = b.data.split("/").map(Number);
    return ma * 100 + da - (mb * 100 + db);
  });
}
