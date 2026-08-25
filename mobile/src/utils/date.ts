/**
 * Comparador para datas "dd/MM" dentro de um quadro mensal.
 *
 * Um quadro pode conter dias do mês anterior — a escala começa na segunda-feira da semana
 * que contém o dia 1. Comparar por `mes * 100 + dia` funciona em quase todos os meses, mas
 * quebra na virada do ano: num quadro de JANEIRO, "29/12" daria 1229 e "01/01" daria 101,
 * jogando dezembro para o fim da lista. O PDF então numerava as semanas erradas.
 *
 * Passando o mês do quadro, o mês maior que ele é reconhecido como do ano anterior e recebe
 * peso negativo. Sem o parâmetro o comportamento antigo é mantido.
 */
export function compareDataBR(a: string, b: string, mesQuadro?: number): number {
  return chaveDataBR(a, mesQuadro) - chaveDataBR(b, mesQuadro);
}

function chaveDataBR(data: string, mesQuadro?: number): number {
  const [dia, mes] = data.split("/").map(Number);
  const mesRelativo = mesQuadro && mes > mesQuadro ? mes - 12 : mes;
  return mesRelativo * 100 + dia;
}

/**
 * Data completa de um dia "dd/MM" de um quadro mensal. Mês maior que o do
 * quadro é do ano ANTERIOR — a mesma regra de chaveDataBR acima: um quadro
 * pode abrir com dias do mês anterior (a semana que contém o dia 1), nunca
 * com dias do mês seguinte.
 */
export function dataDoQuadro(
  data: string,
  mesQuadro: number,
  anoQuadro: number,
): Date | null {
  const [dia, mes] = data.split("/").map(Number);
  if (!dia || !mes) return null;
  const ano = mes > mesQuadro ? anoQuadro - 1 : anoQuadro;
  const d = new Date(ano, mes - 1, dia);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format an ISO timestamp as dd/MM/yyyy. */
export function formatDateBR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

/** Format an ISO timestamp as dd/MM/yyyy HH:mm. */
export function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
