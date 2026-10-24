import type { PainelPioneiro, TipoVisita } from "@/api/types";

export interface VisitaPendente {
  revisitaId: number;
  tipo: TipoVisita;
}

/**
 * As conversas de hoje com as visitas que ainda esperam a rede: a guardada já conta como feita,
 * como o servidor vai contar quando ela subir. Conferido em scripts/verificarVisitasFila.mjs.
 */
export function conversasComPendentes(c: PainelPioneiro["conversasHoje"], pendentes: VisitaPendente[]): PainelPioneiro["conversasHoje"] {
  if (!pendentes.length) return c;
  const tipoDe = new Map(pendentes.map((p) => [p.revisitaId, p.tipo]));
  let feitas = c.feitas;
  const itens = c.itens.map((i) => {
    const tipo = tipoDe.get(i.id);
    if (i.feita || !tipo) return i;
    feitas += 1;
    return { ...i, feita: tipo };
  });
  return { ...c, itens, feitas };
}
