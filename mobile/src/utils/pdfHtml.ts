import type { Quadro, SemanaReuniao } from "@/api/types";
import type { GrupoDia } from "@/utils/designacaoRules";
import { ordenarFuncoes } from "@/utils/funcoes";
import { canticoLegivel, parteTitulo } from "@/utils/semanaReuniao";

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
    saidaCampo?: { local: string; horario: string };
  }[];
}

const SEMANAS_POR_PAGINA_DIRIGENTES = 2;

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
      const headerSemana = `<tr><td colspan="5" class="semana-title-row">SEMANA ${semanaInicial + semanaIdx}</td></tr>`;
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
              return `<tr class="${className}">${cellsDataDia}<td class="cell-local">${esc(escala.saidaCampo?.local)}</td><td class="cell-horario">${esc(escala.saidaCampo?.horario)}</td><td class="cell-nome">${esc(escala.principal)}</td></tr>`;
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

  // Paginar por SEMANA, não por dia. Cortar de N em N dias só coincide com 2 semanas enquanto
  // todo mês tiver 6 dias por semana; basta um dia excluído para a página cortar no meio de uma
  // semana e duas páginas imprimirem o mesmo "SEMANA N". Agrupando antes, o corte cai sempre no
  // fim de uma semana e a numeração global fica correta.
  const semanas = agruparPorSemana(grupos);
  const paginas = chunk(semanas, SEMANAS_POR_PAGINA_DIRIGENTES);

  const body = paginas
    .map((pg, i) =>
      paginaDirigentesHtml(
        pg.flat(),
        titulo,
        subtitulo,
        i * SEMANAS_POR_PAGINA_DIRIGENTES + 1,
        i < paginas.length - 1,
      ),
    )
    .join("");

  return `<!DOCTYPE html><html><head>${DOC_HEAD}<style>${DIRIGENTES_CSS}</style></head><body>${body}</body></html>`;
}

// ============================================================
// PROGRAMAÇÃO DA SEMANA (réplica do pôster da ReuniaoV2 do web)
// ============================================================

const SEMANA_CSS = `
  @page { size: A4 landscape; margin: 0; }
  .pg { width: 297mm; height: 210mm; padding: 6mm 7mm; font-family: Roboto, Inter, sans-serif;
        display: flex; flex-direction: column; background: #fff; }
  .top { display: flex; justify-content: space-between; align-items: center;
         border-bottom: 0.8mm solid #5E6B48; padding-bottom: 2mm; margin-bottom: 3mm; }
  .top .mes { font-size: 4mm; font-weight: 800; color: #5E6B48; letter-spacing: 0.5mm; }
  .top .faixa { font-size: 7mm; font-weight: 800; color: #2B2620; }
  .top .cong { text-align: right; }
  .top .cong h2 { margin: 0; font-size: 5.6mm; font-weight: 800; color: #2B2620; }
  .top .cong h3 { margin: 0; font-size: 4mm; font-weight: 600; color: #8A8071; }
  .cols { display: flex; gap: 5mm; flex: 1; }
  .col { flex: 1; display: flex; flex-direction: column; gap: 2mm; }
  /* O meio de semana tem 3x mais conteúdo que o fim de semana; com 50/50 os títulos das
     partes quebravam em duas linhas e o pôster passava para uma segunda página. */
  .col-meio { flex: 1.75; }
  .col-fim { flex: 1; }
  .colhead { background: #5E6B48; color: #fff; border-radius: 2mm; padding: 1.5mm 3mm;
             display: flex; justify-content: space-between; align-items: baseline; }
  .colhead .t { font-size: 4.8mm; font-weight: 800; text-transform: uppercase; }
  .colhead .d { font-size: 4mm; font-weight: 600; opacity: 0.92; }
  .leitura { font-size: 3.9mm; color: #5E6B48; font-weight: 700; }
  .sec { border: 0.3mm solid #E6DCC9; border-radius: 2mm; overflow: hidden; }
  .sec > .h { background: #F3EDE2; padding: 1.2mm 2.5mm; font-size: 3.9mm; font-weight: 800;
              color: #566239; text-transform: uppercase; letter-spacing: 0.2mm; }
  .row { display: flex; gap: 2mm; padding: 0.9mm 2.5mm; border-top: 0.25mm solid #F0E9DB;
         align-items: baseline; line-height: 1.15; }
  .row:first-of-type { border-top: none; }
  .row .lbl { font-size: 3.7mm; color: #8A8071; font-weight: 700; min-width: 30mm; }
  .row .hora { font-size: 3.5mm; color: #8A8071; font-weight: 700; min-width: 13mm; }
  .row .val { font-size: 3.9mm; color: #2B2620; font-weight: 600; flex: 1; }
  .row .tit { font-size: 3.8mm; color: #2B2620; flex: 1; }
  .row .quem { font-size: 3.8mm; color: #2B2620; font-weight: 700; text-align: right;
               min-width: 36mm; }
  .row .salab { font-size: 3.3mm; color: #8A8071; font-weight: 600; display: block;
                 margin-top: 0.3mm; }
  .vazio { padding: 2mm 2.5mm; font-size: 3.7mm; color: #A2977F; }
  /* Presidência sem cabeçalho de seção: os três papéis lado a lado, nome centralizado
     embaixo do rótulo. Ganha a altura que o título da seção ocupava e sobra espaço para
     a fonte maior que a congregação pediu. */
  .presid { display: flex; border: 0.3mm solid #E6DCC9; border-radius: 2mm; overflow: hidden; }
  .presid .p { flex: 1; text-align: center; padding: 1.4mm 1.5mm; }
  .presid .p + .p { border-left: 0.25mm solid #F0E9DB; }
  .presid .rot { font-size: 3.4mm; color: #8A8071; font-weight: 700; text-transform: uppercase;
                 letter-spacing: 0.15mm; display: block; }
  .presid .nome { font-size: 4.1mm; color: #2B2620; font-weight: 700; display: block;
                  margin-top: 0.6mm; }
  .cantico1 { font-size: 3.6mm; color: #566239; font-weight: 700; text-align: center; }
`;

const naoVazio = (v: unknown): string | null => {
  const t = String(v ?? "").trim();
  return !t || t === "__DELETADO__" || t === "-" ? null : t;
};

/** Linha "rótulo: valor", omitida quando não há valor. */
function linhaHtml(label: string, valor?: string | null): string {
  const v = naoVazio(valor);
  if (!v) return "";
  return `<div class="row"><div class="lbl">${esc(label)}</div><div class="val">${esc(v)}</div></div>`;
}

/** Linha de parte: hora + título à esquerda, quem faz à direita (com a Sala B embaixo). */
function parteHtml(titulo?: string | null, principal?: string | null, salaB?: string | null): string {
  const t = parteTitulo(titulo);
  const p = naoVazio(principal);
  const b = naoVazio(salaB);
  if (!t && !p && !b) return "";
  return `<div class="row">
    ${t?.hora ? `<div class="hora">${esc(t.hora)}</div>` : ""}
    <div class="tit">${esc(t?.texto || "—")}</div>
    <div class="quem">${esc(p || "—")}${b ? `<span class="salab">Sala B: ${esc(b)}</span>` : ""}</div>
  </div>`;
}

/** Linha de cântico, já sem o pipe do importador. */
function canticoHtml(label: string, valor?: string | null): string {
  const v = canticoLegivel(valor);
  if (!v) return "";
  return `<div class="row"><div class="lbl">${esc(label)}</div><div class="val">${esc(v)}</div></div>`;
}

function secaoHtml(titulo: string, corpo: string): string {
  if (!corpo.trim()) return "";
  return `<div class="sec"><div class="h">${esc(titulo)}</div>${corpo}</div>`;
}

/**
 * Presidente, Conselheiro B e Oração inicial numa faixa só: rótulo em cima, irmão embaixo,
 * os três centralizados lado a lado. Sem cabeçalho de seção — é o corte de altura que paga
 * a fonte maior no resto do pôster.
 */
function presidenciaHtml(
  presidente?: string | null,
  conselheiro?: string | null,
  oracao?: string | null,
): string {
  const papeis: [string, string | null][] = [
    ["Presidente", naoVazio(presidente)],
    ["Conselheiro B", naoVazio(conselheiro)],
    ["Oração inicial", naoVazio(oracao)],
  ];
  if (papeis.every(([, nome]) => !nome)) return "";

  const colunas = papeis
    .map(
      ([rotulo, nome]) =>
        `<div class="p"><span class="rot">${esc(rotulo)}</span><span class="nome">${esc(nome || "—")}</span></div>`,
    )
    .join("");
  return `<div class="presid">${colunas}</div>`;
}

/**
 * Um pôster A4 paisagem com a semana inteira: meio de semana à esquerda, fim de semana à
 * direita. Espelha o layout do `ReuniaoV2` do web (pages/ReuniaoV2/posterA4.css) para o
 * irmão reconhecer o mesmo papel que já é afixado no quadro.
 *
 * `datas` vem pronto de utils/semanaReuniao para o PDF não repetir a derivação do domingo.
 */
export function gerarHtmlSemana(
  reuniao: { mes: number; ano: number },
  semana: SemanaReuniao,
  datas: { meio?: { diaMes: string; diaSemana: string } | null; fds?: { diaMes: string; diaSemana: string } | null },
): string {
  // `keyof` de propósito: um nome de campo digitado errado vira erro de compilação em vez de
  // uma seção que some em silêncio do PDF.
  const g = (campo: keyof SemanaReuniao) => naoVazio(semana[campo]);

  // O cântico inicial morava dentro de "Presidência"; sem a seção ele vira uma linha fina
  // logo abaixo da faixa, para não sumir do pôster.
  const canticoInicial = canticoLegivel(g("canticoInicial"));

  const meioSemana = [
    presidenciaHtml(g("presidente"), g("conselheiroB"), g("oracaoInicial")),
    canticoInicial ? `<div class="cantico1">${esc(canticoInicial)}</div>` : "",
    secaoHtml(
      "Tesouros da Palavra de Deus",
      parteHtml(g("tesouro1_titulo"), g("tesouro1_irmao")) +
        parteHtml(g("tesouro2_titulo"), g("tesouro2_irmao")) +
        parteHtml(g("tesouro3_titulo"), g("tesouro3_principal"), g("tesouro3_salaB")),
    ),
    secaoHtml(
      "Faça Seu Melhor no Ministério",
      parteHtml(g("ministerio1_titulo"), g("ministerio1_principal"), g("ministerio1_salaB")) +
        parteHtml(g("ministerio2_titulo"), g("ministerio2_principal"), g("ministerio2_salaB")) +
        parteHtml(g("ministerio3_titulo"), g("ministerio3_principal"), g("ministerio3_salaB")) +
        parteHtml(g("ministerio4_titulo"), g("ministerio4_principal"), g("ministerio4_salaB")),
    ),
    secaoHtml(
      "Nossa Vida Cristã",
      canticoHtml("Cântico", g("canticoMeio")) +
        parteHtml(g("vidaCrista1_titulo"), g("vidaCrista1_irmao")) +
        parteHtml(g("vidaCrista2_titulo"), g("vidaCrista2_irmao")) +
        linhaHtml("Estudo — dirigente", g("estudoBiblico_dirigente")) +
        linhaHtml("Estudo — leitor", g("estudoBiblico_leitor")) +
        canticoHtml("Cântico final", g("canticoFinal")) +
        linhaHtml("Oração final", g("oracaoFinal")),
    ),
  ].join("");

  const fimDeSemana = [
    secaoHtml(
      "Reunião pública",
      linhaHtml("Presidente", g("fds_presidente")) +
        linhaHtml("Tema", g("fds_tema")) +
        linhaHtml("Orador", g("fds_orador")) +
        linhaHtml("Congregação", g("fds_congregacao")),
    ),
    secaoHtml("A Sentinela", linhaHtml("Leitor", g("fds_leitor"))),
    secaoHtml("Limpeza", linhaHtml("Responsável", g("limpeza"))),
  ].join("");

  const leitura = g("leituraSemanal");
  const faixa =
    datas.meio && datas.fds
      ? `${datas.meio.diaMes} a ${datas.fds.diaMes}`
      : semana.faixaData;

  const body = `
    <div class="pg">
      <div class="top">
        <div>
          <div class="mes">${esc((MESES_LONGO[reuniao.mes] || "").toUpperCase())} / ${esc(reuniao.ano)}</div>
          <div class="faixa">${esc(faixa)}</div>
        </div>
        <div class="cong">
          <h2>Programação da Congregação</h2>
          <h3>Norte de Itapuã</h3>
        </div>
      </div>
      <div class="cols">
        <div class="col col-meio">
          <div class="colhead">
            <span class="t">Meio da semana</span>
            <span class="d">${esc(datas.meio ? `${datas.meio.diaSemana}, ${datas.meio.diaMes}` : "")}</span>
          </div>
          ${leitura ? `<div class="leitura">Leitura da semana: ${esc(leitura)}</div>` : ""}
          ${meioSemana || '<div class="vazio">Sem partes importadas.</div>'}
        </div>
        <div class="col col-fim">
          <div class="colhead">
            <span class="t">Fim de semana</span>
            <span class="d">${esc(datas.fds ? `${datas.fds.diaSemana}, ${datas.fds.diaMes}` : "")}</span>
          </div>
          ${fimDeSemana || '<div class="vazio">Sem partes importadas.</div>'}
        </div>
      </div>
    </div>`;

  return `<!DOCTYPE html><html><head>${DOC_HEAD}<style>${SEMANA_CSS}</style></head><body>${body}</body></html>`;
}
