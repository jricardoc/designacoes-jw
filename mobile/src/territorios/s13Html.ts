import type { S13 } from "@/api/types";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** "2026-10-18" -> "18/10/26", como se preenche à mão no formulário. */
const data = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : "");

/** Designações por linha do formulário: o S-13 tem quatro blocos "Designado a". */
const POR_LINHA = 4;

/**
 * O "Registro de designação de território" (S-13) em HTML para o expo-print: A4 paisagem, uma
 * linha por território e quatro blocos de designação; território com mais designações no ano
 * continua na linha de baixo, como no papel.
 */
export function gerarHtmlS13(s13: S13, congregacao = ""): string {
  const linhas = s13.territorios
    .flatMap((t) => {
      const blocos = t.designacoes.length ? t.designacoes : [];
      const grupos = Math.max(1, Math.ceil(blocos.length / POR_LINHA));
      return Array.from({ length: grupos }, (_, g) => {
        const fatia = blocos.slice(g * POR_LINHA, g * POR_LINHA + POR_LINHA);
        const celulas = Array.from({ length: POR_LINHA }, (_, i) => {
          const d = fatia[i];
          return `<td class="nome" colspan="2">${esc(d?.dirigente)}</td>`;
        }).join("");
        const datas = Array.from({ length: POR_LINHA }, (_, i) => {
          const d = fatia[i];
          return `<td class="data">${data(d?.dia ?? null)}</td><td class="data">${data(d?.concluidoEm ?? null)}</td>`;
        }).join("");
        const primeira = g === 0;
        return `<tr>
          <td class="num" rowspan="2">${primeira ? esc(t.numero) : ""}</td>
          <td class="ult" rowspan="2">${primeira ? data(t.ultimaConclusao) : ""}</td>${celulas}</tr>
          <tr>${datas}</tr>`;
      });
    })
    .join("");

  const cabecalhoBlocos = Array.from({ length: POR_LINHA }, () => `<th colspan="2">Designado a</th>`).join("");
  const subBlocos = Array.from({ length: POR_LINHA }, () => `<th>Data da designação</th><th>Data da conclusão</th>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: -apple-system, Roboto, Arial, sans-serif; color: #111; }
    h1 { font-size: 15pt; text-align: center; margin: 0 0 2mm; letter-spacing: .5pt; }
    .topo { display: flex; justify-content: space-between; font-size: 10pt; margin-bottom: 3mm; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; }
    th, td { border: 0.6pt solid #333; padding: 1.2mm 1mm; text-align: center; vertical-align: middle; }
    th { background: #eee; font-weight: 700; }
    td.num { font-weight: 700; font-size: 10pt; width: 11mm; }
    td.ult { width: 20mm; }
    td.nome { text-align: left; font-weight: 600; height: 5mm; }
    td.data { height: 5mm; }
    .rodape { font-size: 8pt; margin-top: 3mm; color: #444; }
  </style></head><body>
    <h1>REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO</h1>
    <div class="topo"><span>${esc(congregacao)}</span><span>Ano de serviço: ${s13.ano - 1}/${s13.ano}</span></div>
    <table>
      <thead>
        <tr><th rowspan="2" style="width:11mm">Terr. nº</th><th rowspan="2" style="width:20mm">Última data concluída*</th>${cabecalhoBlocos}</tr>
        <tr>${subBlocos}</tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="rodape">*Última data em que o território foi concluído antes deste ano de serviço (${data(s13.de)} a ${data(s13.ate)}).</div>
  </body></html>`;
}
