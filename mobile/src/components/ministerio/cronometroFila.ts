import type { CronometroPioneiro } from "@/api/types";

export type AcaoCronometro = "iniciar" | "pausar" | "parar" | "descartar";

/**
 * O cronômetro com as ações que ainda esperam a rede, na ordem: o mesmo que o servidor faz
 * (PioneiroService.cronometro), para o relógio andar no celular sem internet. Conferido em
 * scripts/verificarCronometro.mjs.
 */
export function comPendentes(c: CronometroPioneiro, acoes: { acao: AcaoCronometro; em: number }[]): CronometroPioneiro {
  return acoes.reduce<CronometroPioneiro>((s, { acao, em }) => {
    if (acao === "iniciar") return s.inicio ? s : { rodando: true, inicio: new Date(em).toISOString(), acumuladoSeg: s.acumuladoSeg };
    if (acao === "pausar") {
      if (!s.inicio) return s;
      return { rodando: false, inicio: null, acumuladoSeg: s.acumuladoSeg + Math.max(0, Math.floor((em - Date.parse(s.inicio)) / 1000)) };
    }
    return { rodando: false, inicio: null, acumuladoSeg: 0 };
  }, c);
}
