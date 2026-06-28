/** Sort comparator for "dd/MM" date strings. */
export function compareDataBR(a: string, b: string): number {
  const [diaA, mesA] = a.split("/").map(Number);
  const [diaB, mesB] = b.split("/").map(Number);
  return mesA * 100 + diaA - (mesB * 100 + diaB);
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
