import type { Quadro } from "@/api/types";
import type { GrupoDia } from "@/utils/designacaoRules";
import { ordenarFuncoes } from "@/utils/funcoes";

/**
 * Geradores de HTML que reproduzem EXATAMENTE o layout dos PDFs do front-end web
 * (componentes TabelaPDF e TabelaDirigentesPDF), para impressão via expo-print.
 */

const MESES_CURTO = [
  "", "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

const MESES_LONGO = [
  "", "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

const MESES_NOME = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const DOC_HEAD = `
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
`;

// ============================================================
// QUADRO DE DESIGNAÇÕES (réplica de TabelaPDF) — 9 dias por página
// ============================================================

const ITEMS_POR_PAGINA_QUADRO = 9;

function paginaQuadroHtml(
  grupos: GrupoDia[],
  mesCurto: string,
  titulo: string,
  pageBreak: boolean,
): string {
  const linhas = grupos
    .map((dia, diaIndex) => {
      const funcoes = ordenarFuncoes(dia.funcoes);
      const isDomingo = dia.dia === "Domingo";
      const funcoesHtml = funcoes
        .map((f, idx) => {
          const borda =
            idx < funcoes.length - 1 ? "0.3mm solid #e5e7eb" : "none";
          return `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;padding:0.5mm 2mm;border-bottom:${borda};align-items:center;flex:1;">
              <div style="text-align:center;">
                <span style="display:inline-block;padding:0;font-size:3mm;font-weight:800;color:#000;text-transform:uppercase;">${esc(f.funcao)}</span>
              </div>
              <div style="text-align:center;font-weight:600;color:#374151;font-size:4mm;">${esc(f.irmao1) || "-"}</div>
              <div style="text-align:center;font-weight:600;color:#374151;font-size:4mm;">${esc(f.irmao2) || "-"}</div>
            </div>`;
        })
        .join("");

      return `
        <div style="display:grid;grid-template-columns:25mm 25mm 1fr;background:${diaIndex % 2 === 0 ? "#f3f4f6" : "white"};border-bottom:0.5mm solid #e5e7eb;flex:1;">
          <div style="background:#2563eb;color:white;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:1mm;border-right:1mm solid #7c3aed;">
            <span style="font-size:8mm;font-weight:800;line-height:1;">${esc(dia.data.split("/")[0])}</span>
            <span style="font-size:3mm;font-weight:600;opacity:0.9;">${esc(mesCurto)}</span>
          </div>
          <div style="display:flex;justify-content:center;align-items:center;padding:1mm;">
            <span style="display:inline-block;padding:1.5mm 3mm;border-radius:10mm;font-size:3mm;font-weight:700;text-transform:uppercase;background:${isDomingo ? "#f59e0b" : "#10b981"};color:${isDomingo ? "#78350f" : "#064e3b"};">${esc(dia.dia)}</span>
          </div>
          <div style="display:flex;flex-direction:column;flex:1;">${funcoesHtml}</div>
        </div>`;
    })
    .join("");

  return `
    <div style="background:white;width:210mm;height:297mm;padding:4mm;font-family:Roboto, Inter, sans-serif;display:flex;flex-direction:column;${pageBreak ? "page-break-after:always;" : ""}">
      <div style="background:linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);padding:4mm 10mm;border-radius:3mm;text-align:center;margin-bottom:1.5mm;">
        <h2 style="color:white;font-size:6mm;font-weight:700;margin:0;">${esc(titulo)}</h2>
      </div>
      <div style="display:grid;grid-template-columns:25mm 25mm 1fr 1fr 1fr;background:#1f2937;color:white;font-weight:600;font-size:3.5mm;text-transform:uppercase;border-radius:2mm 2mm 0 0;">
        <div style="padding:2mm 3mm;text-align:center;">Data</div>
        <div style="padding:2mm 3mm;text-align:center;">Dia</div>
        <div style="padding:2mm 3mm;text-align:center;">Função</div>
        <div style="padding:2mm 3mm;text-align:center;">Irmão 01</div>
        <div style="padding:2mm 3mm;text-align:center;">Irmão 02</div>
      </div>
      <div style="display:flex;flex-direction:column;flex:1;">${linhas}</div>
    </div>`;
}

export function gerarHtmlQuadro(quadro: Quadro, grupos: GrupoDia[]): string {
  const mesCurto = MESES_CURTO[quadro.mes] || "JAN";
  const mesLongo = MESES_LONGO[quadro.mes] || "JANEIRO";
  const titulo = `Quadro de Designações ${mesLongo} ${quadro.ano}`;
  const paginas = chunk(grupos, ITEMS_POR_PAGINA_QUADRO);

  const body = paginas
    .map((pg, i) => paginaQuadroHtml(pg, mesCurto, titulo, i < paginas.length - 1))
    .join("");

  return `<!DOCTYPE html><html><head>${DOC_HEAD}</head><body>${body}</body></html>`;
}

// ============================================================
// ESCALA DE DIRIGENTES (réplica de TabelaDirigentesPDF) — 12 dias por página
// ============================================================

export interface GrupoEscalaPdf {
  data: string;
  dia: string;
  escalas: {
    id: number;
    data: string;
    dia: string;
    principal: string;
    substituto: string;
    saidaCampo?: { local: string; horario: string };
  }[];
}

const ITEMS_POR_PAGINA_DIRIGENTES = 12;

const DIRIGENTES_CSS = `
  .pdf-container { width:210mm; min-height:297mm; padding:15mm; background-color:white; font-family:Arial, Helvetica, sans-serif; color:black; }
  .pdf-header { text-align:center; margin-bottom:20px; border-bottom:2px solid #1e3a8a; padding-bottom:12px; }
  .pdf-title { font-size:24px; font-weight:bold; margin:0; text-transform:uppercase; color:#1e3a8a; }
  .pdf-subtitle { font-size:18px; margin:8px 0 0 0; color:#2563eb; }
  .tabela-pdf { width:100%; border-collapse:collapse; font-size:14px; }
  .tabela-pdf th, .tabela-pdf td { border:1px solid #bfdbfe; padding:10px 8px; text-align:center; vertical-align:middle; }
  .tabela-pdf th { background-color:#dbeafe; color:#1e3a8a; font-weight:bold; text-align:center; font-size:13px; padding:12px 8px; }
  .cell-data { text-align:center; font-weight:bold; font-size:16px; color:#1e40af; }
  .semana-title-row { background-color:#1e40af !important; color:white !important; font-weight:bold; text-align:center !important; padding:10px !important; font-size:14px !important; letter-spacing:2px; border-bottom:2px solid #1e3a8a !important; }
  .cell-dia { font-weight:bold; text-align:center; color:#1e40af; font-size:14px; }
  .cell-local { font-size:14px; }
  .cell-horario { text-align:center; font-weight:bold; }
  .cell-nome { font-size:14px; text-transform:uppercase; }
  .border-bottom-thick td { border-bottom:2px solid #60a5fa; }
  .border-bottom-semana td { border-bottom:4px double #2563eb; }
`;

function agruparPorSemana(dados: GrupoEscalaPdf[]): GrupoEscalaPdf[][] {
  const semanas: GrupoEscalaPdf[][] = [];
  let atual: GrupoEscalaPdf[] = [];
  for (const grupo of dados) {
    if (grupo.escalas[0]?.dia === "Segunda-Feira" && atual.length > 0) {
      semanas.push(atual);
      atual = [];
    }
    atual.push(grupo);
  }
  if (atual.length > 0) semanas.push(atual);
  return semanas;
}

function paginaDirigentesHtml(
  grupos: GrupoEscalaPdf[],
  titulo: string,
  subtitulo: string,
  semanaInicial: number,
  pageBreak: boolean,
): string {
  const semanas = agruparPorSemana(grupos);

  const corpo = semanas
    .map((semana, semanaIdx) => {
      const headerSemana = `<tr><td colspan="6" class="semana-title-row">SEMANA ${semanaInicial + semanaIdx}</td></tr>`;
      const linhas = semana
        .map((diaGrupo, diaIdx) =>
          diaGrupo.escalas
            .map((escala, index) => {
              const isFirst = index === 0;
              const isLast = index === diaGrupo.escalas.length - 1;
              const rowSpan = diaGrupo.escalas.length;
              const isUltimoDiaSemana = diaIdx === semana.length - 1;
              const isUltimaSemana = semanaIdx === semanas.length - 1;
              const separador = isLast && isUltimoDiaSemana && !isUltimaSemana;
              const className = separador
                ? "border-bottom-semana"
                : isLast
                  ? "border-bottom-thick"
                  : "";
              const cellsDataDia = isFirst
                ? `<td rowspan="${rowSpan}" class="cell-data">${esc(escala.data)}</td><td rowspan="${rowSpan}" class="cell-dia">${esc(escala.dia)}</td>`
                : "";
              return `<tr class="${className}">${cellsDataDia}<td class="cell-local">${esc(escala.saidaCampo?.local)}</td><td class="cell-horario">${esc(escala.saidaCampo?.horario)}</td><td class="cell-nome">${esc(escala.principal)}</td><td class="cell-nome">${esc(escala.substituto)}</td></tr>`;
            })
            .join(""),
        )
        .join("");
      return headerSemana + linhas;
    })
    .join("");

  return `
    <div class="pdf-container" style="${pageBreak ? "page-break-after:always;" : ""}">
      <div class="pdf-header">
        <h1 class="pdf-title">${esc(titulo)}</h1>
        <h2 class="pdf-subtitle">${esc(subtitulo)}</h2>
      </div>
      <table class="tabela-pdf">
        <thead>
          <tr>
            <th class="col-data">DATA</th>
            <th class="col-dia">DIA</th>
            <th class="col-local">LOCAL</th>
            <th class="col-horario">HORÁRIO</th>
            <th class="col-principal">DIRIGENTE PRINCIPAL</th>
            <th class="col-substituto">SUBSTITUTO</th>
          </tr>
        </thead>
        <tbody>${corpo}</tbody>
      </table>
    </div>`;
}

export function gerarHtmlDirigentes(
  quadro: { mes: number; ano: number },
  grupos: GrupoEscalaPdf[],
): string {
  const titulo = "ESCALA DE DIRIGENTES DE CAMPO";
  const subtitulo = `${(MESES_NOME[quadro.mes] || "").toUpperCase()} ${quadro.ano}`;
  const paginas = chunk(grupos, ITEMS_POR_PAGINA_DIRIGENTES);

  const body = paginas
    .map((pg, i) =>
      paginaDirigentesHtml(pg, titulo, subtitulo, i * 2 + 1, i < paginas.length - 1),
    )
    .join("");

  return `<!DOCTYPE html><html><head>${DOC_HEAD}<style>${DIRIGENTES_CSS}</style></head><body>${body}</body></html>`;
}
