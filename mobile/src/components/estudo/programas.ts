import type { LeituraFeita, PerfilEstudo, Reuniao } from "@/api/types";
import { datasDaSemana, faixaSemana } from "@/utils/semanaReuniao";
import { capitulosInteiros, juntar, lerLeituraSemanal, LIVROS, rotuloParte, type Parte } from "./biblia";

/**
 * Os programas de leitura da Bíblia do ambiente de estudo, todos do jw.org:
 *  - o "Leitura da Bíblia — Programa" (jw.org, sbr-T), transcrito do PDF oficial;
 *  - o "Comece sua leitura da Bíblia", do livro Seja Feliz para Sempre!;
 *  - a leitura semanal da reunião, da programação importada no app;
 *  - a leitura livre, capítulo por capítulo.
 * O servidor guarda só o que foi marcado (o `id` de cada trecho); as listas moram aqui.
 */

export type Plano = PerfilEstudo["plano"];
export type Marca = "vermelho" | "azul";

/** Um trecho para ler de uma vez: um "grupo de capítulos" do programa, uma passagem, uma semana. */
export interface Trecho {
  /** Estável: é o que fica salvo no servidor. */
  id: string;
  titulo: string;
  /** Referências menores embaixo do título (as passagens do "Comece", a faixa da semana). */
  detalhe?: string;
  /** O que o "Ler" abre. Vazio quando a referência não pôde ser lida (só o texto aparece). */
  partes: Parte[];
  marca?: Marca;
  /** O grupo onde ele aparece na lista (a categoria do programa, o tema do "Comece"). */
  grupo?: string;
  /** No "Comece": cada passagem com o seu link. */
  passagens?: { texto: string; parte: Parte }[];
  /** O dia planejado ("2026-10-24"), quando o programa tem início e ritmo. */
  data?: string;
}

/** "116-119.63" -> Salmos 116 a 119:63; "119.64-119.176"; "8" -> só o capítulo 8. */
function parte(livro: number, faixa: string): Parte {
  const m = faixa.match(/^(\d+)(?:\.(\d+))?(?:-(\d+)(?:\.(\d+))?)?$/);
  if (!m) throw new Error(`faixa inválida: ${faixa}`);
  const de = Number(m[1]);
  const p: Parte = { livro, de, ate: m[3] ? Number(m[3]) : de };
  if (m[2]) p.deVers = Number(m[2]);
  if (m[4]) p.ateVers = Number(m[4]);
  return p;
}

const livroInteiro = (livro: number): Parte => ({ livro, de: 1, ate: LIVROS[livro - 1].capitulos });

/** O id de um trecho é o da primeira parte: "1:4-7", "11:8", "19:116-119.63", "31:1". */
function idDe(p: Parte) {
  const ini = `${p.de}${p.deVers !== undefined ? `.${p.deVers}` : ""}`;
  const fim = `${p.ate}${p.ateVers !== undefined ? `.${p.ateVers}` : ""}`;
  return `${p.livro}:${ini === fim ? ini : `${ini}-${fim}`}`;
}

// ---------------------------------------------------------------------------
// O programa do jw.org
// ---------------------------------------------------------------------------

/**
 * Os grupos de capítulos como estão no PDF, por categoria. "V" antes do grupo = marcador
 * VERMELHO (visão histórica geral dos tratos de Deus com os israelitas); "A" = AZUL (visão
 * cronológica geral do desenvolvimento da congregação cristã). Livros juntos num grupo só
 * (Obadias/Jonas...) vêm como lista. Um grupo por dia lê a Bíblia inteira em um ano.
 */
const CATEGORIAS_JW: { nome: string; livros: [number | number[], string][] }[] = [
  {
    nome: "Os escritos de Moisés",
    livros: [
      [1, "1-3 4-7 8-11 V12-15 V16-18 V19-22 V23-24 V25-27 V28-30 V31-32 V33-34 V35-37 V38-40 V41-42 V43-45 V46-48 V49-50"],
      [2, "V1-4 V5-7 V8-10 V11-13 V14-15 V16-18 V19-21 22-25 26-28 29-30 V31-33 V34-35 36-38 39-40"],
      [3, "1-4 5-7 8-10 11-13 14-15 16-18 19-21 22-23 24-25 26-27"],
      [4, "1-3 4-6 7-9 V10-12 V13-15 V16-18 V19-21 V22-24 V25-27 28-30 V31-32 V33-36"],
      [5, "1-2 V3-4 5-7 8-10 11-13 14-16 V17-19 20-22 23-26 27-28 V29-31 V32 V33-34"],
    ],
  },
  {
    nome: "Israel entra na Terra Prometida",
    livros: [
      [6, "V1-4 V5-7 V8-9 V10-12 V13-15 V16-18 V19-21 V22-24"],
      [7, "V1-2 V3-5 V6-7 V8-9 V10-11 V12-13 V14-16 V17-19 V20-21"],
      [8, "V1-4"],
    ],
  },
  {
    nome: "Quando os reis governavam Israel",
    livros: [
      [9, "V1-2 V3-6 V7-9 V10-12 V13-14 V15-16 V17-18 V19-21 V22-24 V25-27 V28-31"],
      [10, "V1-2 V3-5 V6-8 V9-12 V13-14 V15-16 V17-18 V19-20 V21-22 V23-24"],
      [11, "V1-2 V3-5 V6-7 V8 V9-10 V11-12 V13-14 V15-17 V18-19 V20-21 V22"],
      [12, "V1-3 V4-5 V6-8 V9-10 V11-13 V14-15 V16-17 V18-19 V20-22 V23-25"],
      [13, "1-2 3-5 6-7 8-10 11-12 13-15 16-17 18-20 21-23 24-26 27-29"],
      [14, "1-3 4-6 7-9 10-14 15-18 19-22 23-25 26-28 29-30 31-33 34-36"],
    ],
  },
  {
    nome: "Os judeus retornam do exílio",
    livros: [
      [15, "V1-3 V4-7 V8-10"],
      [16, "V1-3 V4-6 V7-8 V9-10 V11-13"],
      [17, "V1-4 V5-10"],
    ],
  },
  { nome: "Os escritos de Moisés", livros: [[18, "1-5 6-9 10-14 15-18 19-20 21-24 25-29 30-31 32-34 35-38 39-42"]] },
  {
    nome: "Livros de cânticos e de sabedoria prática",
    livros: [
      [
        19,
        "1-8 9-16 17-19 20-25 26-31 32-35 36-38 39-42 43-47 48-52 53-58 59-64 65-68 69-72 73-77 78-79 80-86 87-90 91-96 97-103 104-105 106-108 109-115 116-119.63 119.64-119.176 120-129 130-138 139-144 145-150",
      ],
      [20, "1-4 5-8 9-12 13-16 17-19 20-22 23-27 28-31"],
      [21, "1-4 5-8 9-12"],
      [22, "1-8"],
    ],
  },
  {
    nome: "Os profetas",
    livros: [
      [23, "1-4 5-7 8-10 11-14 15-19 20-24 25-28 29-31 32-35 36-37 38-40 41-43 44-47 48-50 51-55 56-58 59-62 63-66"],
      [24, "1-3 4-5 6-7 8-10 11-13 14-16 17-20 21-23 24-26 27-29 30-31 32-33 34-36 37-39 40-42 43-44 45-48 49-50 51-52"],
      [25, "1-2 3-5"],
      [26, "1-3 4-6 7-9 10-12 13-15 16 17-18 19-21 22-23 24-26 27-28 29-31 32-33 34-36 37-38 39-40 41-43 44-45 46-48"],
      [27, "1-2 3-4 5-7 8-10 11-12"],
      [28, "1-7 8-14"],
      [29, "1-3"],
      [30, "1-5 6-9"],
      [[31, 32], "*"],
      [33, "1-7"],
      [[34, 35], "*"],
      [[36, 37], "*"],
      [38, "1-7 8-11 12-14"],
      [39, "1-4"],
    ],
  },
  {
    nome: "Relatos da vida e do ministério de Jesus",
    livros: [
      [40, "1-4 5-7 8-10 11-13 14-17 18-20 21-23 24-25 26 27-28"],
      [41, "A1-3 A4-5 A6-8 A9-10 A11-13 A14-16"],
      [42, "1-2 3-5 6-7 8-9 10-11 12-13 14-17 18-19 20-22 23-24"],
      [43, "1-3 4-5 6-7 8-9 10-12 13-15 16-18 19-21"],
    ],
  },
  { nome: "Crescimento da congregação cristã", livros: [[44, "A1-3 A4-6 A7-8 A9-11 A12-14 A15-16 A17-19 A20-21 A22-23 A24-26 A27-28"]] },
  {
    nome: "As cartas de Paulo",
    livros: [
      [45, "1-3 4-7 8-11 12-16"],
      [46, "1-6 7-10 11-14 15-16"],
      [47, "1-6 7-10 11-13"],
      [48, "1-6"],
      [49, "1-6"],
      [50, "1-4"],
      [51, "1-4"],
      [52, "1-5"],
      [53, "1-3"],
      [54, "1-6"],
      [55, "1-4"],
      [[56, 57], "*"],
      [58, "1-6 7-10 11-13"],
    ],
  },
  {
    nome: "Escritos de outros apóstolos e discípulos",
    livros: [
      [59, "1-5"],
      [60, "1-5"],
      [61, "1-3"],
      [62, "1-5"],
      [[63, 64, 65], "*"],
      [66, "1-4 5-9 10-14 15-18 19-22"],
    ],
  },
];

/** As 11 categorias, com os livros de cada uma ("Gênesis a Deuteronômio"). */
export const CATEGORIAS = CATEGORIAS_JW.map((c) => {
  const livros = c.livros.flatMap(([l]) => (Array.isArray(l) ? l : [l]));
  const [primeiro, ultimo] = [LIVROS[livros[0] - 1].nome, LIVROS[livros[livros.length - 1] - 1].nome];
  return { nome: c.nome, livros: primeiro === ultimo ? primeiro : `${primeiro} a ${ultimo}` };
});

export const PROGRAMA_JW: (Trecho & { categoria: number })[] = CATEGORIAS_JW.flatMap((c, categoria) =>
  c.livros.flatMap(([livro, grupos]) => {
    if (Array.isArray(livro)) {
      // Livros inteiros juntos, como no PDF ("Obadias/Jonas"): só os nomes.
      const partes = livro.map(livroInteiro);
      return [{ id: idDe(partes[0]), titulo: juntar(livro.map((l) => LIVROS[l - 1].nome)), partes, categoria, grupo: c.nome }];
    }
    return grupos.split(" ").map((g) => {
      const marca: Marca | undefined = g[0] === "V" ? "vermelho" : g[0] === "A" ? "azul" : undefined;
      const p = parte(livro, marca ? g.slice(1) : g);
      return { id: idDe(p), titulo: rotuloParte(p), partes: [p], marca, categoria, grupo: c.nome };
    });
  }),
);

/**
 * Quem cobre cada capítulo no programa do jw.org ("19:119" -> as duas metades do Salmo 119). O
 * capítulo conta como lido no mapa quando todos os trechos que o cobrem foram lidos.
 */
const DONOS_JW = new Map<string, string[]>();
for (const t of PROGRAMA_JW) {
  for (const p of t.partes) {
    for (let c = p.de; c <= p.ate; c++) {
      const k = `${p.livro}:${c}`;
      DONOS_JW.set(k, [...(DONOS_JW.get(k) ?? []), t.id]);
    }
  }
}

// ---------------------------------------------------------------------------
// "Comece sua leitura da Bíblia" (Seja Feliz para Sempre!)
// ---------------------------------------------------------------------------

const ps = (texto: string, livro: number, faixa: string) => ({ texto, parte: parte(livro, faixa) });

const COMECE_TEMAS: { tema: string; itens: { id: string; titulo: string; passagens: { texto: string; parte: Parte }[] }[] }[] = [
  {
    tema: "Pessoas e histórias bem conhecidas",
    itens: [
      { id: "noe", titulo: "Noé e o Dilúvio", passagens: [ps("Gênesis 6:9–9:19", 1, "6.9-9.19")] },
      { id: "moises", titulo: "Moisés e o Mar Vermelho", passagens: [ps("Êxodo 13:17–14:31", 2, "13.17-14.31")] },
      { id: "rute", titulo: "Rute e Noemi", passagens: [ps("Rute 1–4", 8, "1-4")] },
      { id: "davi", titulo: "Davi e Golias", passagens: [ps("1 Samuel 17", 9, "17")] },
      { id: "abigail", titulo: "Abigail", passagens: [ps("1 Samuel 25:2-35", 9, "25.2-25.35")] },
      { id: "daniel", titulo: "Daniel na cova dos leões", passagens: [ps("Daniel 6", 27, "6")] },
      { id: "elisabete-maria", titulo: "Elisabete e Maria", passagens: [ps("Lucas 1–2", 42, "1-2")] },
    ],
  },
  {
    tema: "Bons conselhos para o dia a dia",
    itens: [
      { id: "familia", titulo: "Família", passagens: [ps("Efésios 5:28, 29, 33", 49, "5.28-5.33"), ps("Efésios 6:1-4", 49, "6.1-6.4")] },
      {
        id: "amizades",
        titulo: "Amizades",
        passagens: [ps("Provérbios 13:20", 20, "13.20-13.20"), ps("Provérbios 17:17", 20, "17.17-17.17"), ps("Provérbios 27:17", 20, "27.17-27.17")],
      },
      { id: "oracao", titulo: "Oração", passagens: [ps("Salmo 55:22", 19, "55.22-55.22"), ps("Salmo 62:8", 19, "62.8-62.8"), ps("1 João 5:14", 62, "5.14-5.14")] },
      { id: "sermao", titulo: "Sermão do Monte", passagens: [ps("Mateus 5–7", 40, "5-7")] },
      {
        id: "trabalho",
        titulo: "Trabalho",
        passagens: [ps("Provérbios 14:23", 20, "14.23-14.23"), ps("Eclesiastes 3:12, 13", 21, "3.12-3.13"), ps("Eclesiastes 4:6", 21, "4.6-4.6")],
      },
    ],
  },
  {
    tema: "Quando você precisar de ajuda para lidar com . . .",
    itens: [
      { id: "desanimo", titulo: "Desânimo", passagens: [ps("Salmo 23", 19, "23"), ps("Isaías 41:10", 23, "41.10-41.10")] },
      { id: "luto", titulo: "Luto", passagens: [ps("2 Coríntios 1:3, 4", 47, "1.3-1.4"), ps("1 Pedro 5:7", 60, "5.7-5.7")] },
      { id: "culpa", titulo: "Sentimentos de culpa", passagens: [ps("Salmo 86:5", 19, "86.5-86.5"), ps("Ezequiel 18:21, 22", 26, "18.21-18.22")] },
    ],
  },
  {
    tema: "O que a Bíblia diz sobre . . .",
    itens: [
      { id: "ultimos-dias", titulo: "Os últimos dias", passagens: [ps("Mateus 24:3-14", 40, "24.3-24.14"), ps("2 Timóteo 3:1-5", 55, "3.1-3.5")] },
      { id: "esperanca", titulo: "Ter esperança para o futuro", passagens: [ps("Salmo 37:10, 11, 29", 19, "37.10-37.29"), ps("Apocalipse 21:3, 4", 66, "21.3-21.4")] },
    ],
  },
];

export const PROGRAMA_COMECE: Trecho[] = COMECE_TEMAS.flatMap((t) =>
  t.itens.map((i) => ({
    id: i.id,
    titulo: i.titulo,
    detalhe: i.passagens.map((p) => p.texto).join("; "),
    partes: [i.passagens[0].parte],
    passagens: i.passagens,
    grupo: t.tema,
  })),
);

// ---------------------------------------------------------------------------
// A leitura semanal da reunião
// ---------------------------------------------------------------------------

const isoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** As semanas da programação importada que têm leitura, em ordem. O id é o dia da reunião. */
export function semanasDaReuniao(reunioes: Reuniao[] | undefined): (Trecho & { fim: string })[] {
  const r: (Trecho & { fim: string })[] = [];
  for (const reuniao of reunioes ?? []) {
    for (const s of reuniao.semanas) {
      const { meio, inicio, fds } = datasDaSemana(s);
      if (!s.leituraSemanal || !meio || !inicio || !fds) continue;
      const p = lerLeituraSemanal(s.leituraSemanal);
      r.push({
        id: isoDe(meio.data),
        titulo: p ? rotuloParte(p) : s.leituraSemanal,
        detalhe: `Semana de ${faixaSemana(s)}`,
        partes: p ? [p] : [],
        data: isoDe(inicio.data),
        fim: isoDe(fds.data),
        grupo: "Leitura semanal da reunião",
      });
    }
  }
  return r.sort((a, b) => a.id.localeCompare(b.id)).filter((t, i, todos) => i === 0 || todos[i - 1].id !== t.id);
}

/** A semana da reunião em que `hoje` cai, se a programação dela foi importada. */
export const semanaDeHoje = (reunioes: Reuniao[] | undefined, hoje: string) =>
  semanasDaReuniao(reunioes).find((s) => s.data! <= hoje && hoje <= s.fim) ?? null;

// ---------------------------------------------------------------------------
// O programa escolhido: os trechos, as datas e onde a pessoa está
// ---------------------------------------------------------------------------

/** "2026-10-24" + n dias. */
export function somarDias(dia: string, n: number) {
  const [a, m, d] = dia.split("-").map(Number);
  return isoDe(new Date(a, m - 1, d + n));
}

/** Dias de `a` até `b` ("2026-10-20" -> "2026-10-24" = 4). */
export function diasEntre(a: string, b: string) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Os trechos do programa do jw.org conforme a opção (toda a Bíblia, vermelhos, azuis ou uma categoria). */
export function trechosJw(opcao: string) {
  if (opcao === "vermelho" || opcao === "azul") return PROGRAMA_JW.filter((t) => t.marca === opcao);
  const cat = opcao.startsWith("cat:") ? Number(opcao.slice(4)) : null;
  return cat === null ? PROGRAMA_JW : PROGRAMA_JW.filter((t) => t.categoria === cat);
}

/**
 * Os trechos do programa escolhido, com o dia planejado de cada um (o início mais o ritmo, como a
 * coluna "Data" do PDF). A leitura livre não tem lista: é a grade dos livros.
 */
export function trechosDoPlano(perfil: Pick<PerfilEstudo, "plano" | "opcao" | "inicio" | "ritmo">, reunioes: Reuniao[] | undefined): Trecho[] {
  if (perfil.plano === "reuniao") return semanasDaReuniao(reunioes);
  if (perfil.plano === "livre") return [];
  const lista = perfil.plano === "comece" ? PROGRAMA_COMECE : trechosJw(perfil.opcao);
  const inicio = perfil.inicio;
  return inicio ? lista.map((t, i) => ({ ...t, data: somarDias(inicio, i * perfil.ritmo) })) : lista;
}

/** Os ids lidos de um programa. */
export const lidosDo = (leituras: LeituraFeita[], plano: Plano) => new Set(leituras.filter((l) => l.plano === plano).map((l) => l.item));

/**
 * Onde a pessoa está: o primeiro trecho ainda não lido e quantos dias ele está atrasado (positivo)
 * ou adiantado (negativo) em relação ao planejado. Na reunião, é a semana de hoje.
 */
export function proximoTrecho(trechos: Trecho[], lidos: Set<string>, hoje: string, plano: Plano) {
  if (plano === "reuniao") {
    const t = trechos.find((s) => s.data! <= hoje && hoje <= (s as Trecho & { fim: string }).fim) ?? null;
    return t ? { trecho: t, indice: trechos.indexOf(t), atraso: 0 } : null;
  }
  const indice = trechos.findIndex((t) => !lidos.has(t.id));
  if (indice < 0) return null;
  const t = trechos[indice];
  return { trecho: t, indice, atraso: t.data ? diasEntre(t.data, hoje) : 0 };
}

/** "Reprogramar a partir de hoje": o início que põe o próximo trecho em hoje. */
export const inicioParaHoje = (indice: number, ritmo: number, hoje: string) => somarDias(hoje, -indice * ritmo);

/** A leitura livre: o capítulo seguinte ao último marcado (ou Gênesis 1). */
export function proximoCapituloLivre(leituras: LeituraFeita[]): Parte {
  const ultimo = [...leituras].reverse().find((l) => l.plano === "livre");
  if (!ultimo) return { livro: 1, de: 1, ate: 1 };
  const [livro, cap] = ultimo.item.split(":").map(Number);
  if (cap < LIVROS[livro - 1].capitulos) return { livro, de: cap + 1, ate: cap + 1 };
  return livro < 66 ? { livro: livro + 1, de: 1, ate: 1 } : { livro: 1, de: 1, ate: 1 };
}

/**
 * "Você lembra onde parou?": os capítulos lidos ("livro:capítulo"), somando os programas. As
 * passagens do "Comece" são trechos de capítulos e não entram.
 */
export function capitulosLidos(leituras: LeituraFeita[], reunioes: Reuniao[] | undefined) {
  const lidos = new Set<string>();
  const jw = lidosDo(leituras, "jw");
  for (const [cap, donos] of DONOS_JW) if (donos.every((d) => jw.has(d))) lidos.add(cap);
  const semanas = leituras.some((l) => l.plano === "reuniao") ? semanasDaReuniao(reunioes) : [];
  for (const l of leituras) {
    if (l.plano === "livre") lidos.add(l.item);
    if (l.plano === "reuniao") semanas.find((s) => s.id === l.item)?.partes.forEach((p) => capitulosInteiros(p).forEach((c) => lidos.add(c)));
  }
  return lidos;
}

/** O nome do programa ativo, para os cartões ("Programa do jw.org · vermelhos"). */
export function nomeDoPlano(perfil: Pick<PerfilEstudo, "plano" | "opcao">) {
  if (perfil.plano === "comece") return "Comece sua leitura da Bíblia";
  if (perfil.plano === "reuniao") return "Leitura semanal da reunião";
  if (perfil.plano === "livre") return "Leitura livre";
  if (perfil.opcao === "vermelho") return "Programa do jw.org · marcador vermelho";
  if (perfil.opcao === "azul") return "Programa do jw.org · marcador azul";
  if (perfil.opcao.startsWith("cat:")) return `Programa do jw.org · ${CATEGORIAS[Number(perfil.opcao.slice(4))]?.nome ?? ""}`;
  return "Programa de leitura do jw.org";
}
