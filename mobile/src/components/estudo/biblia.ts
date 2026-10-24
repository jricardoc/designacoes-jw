/**
 * A Bíblia do ambiente de estudo: os 66 livros (nomes da Tradução do Novo Mundo) com o número de
 * capítulos, os trechos e os links para ler. O app nunca mostra o texto bíblico: só a referência,
 * e o link abre no JW Library (ou no jw.org) e na Biblioteca On-line.
 */

/** Na ordem da Bíblia: o livro 1 é Gênesis (o índice + 1). */
export const LIVROS: { nome: string; capitulos: number }[] = [
  { nome: "Gênesis", capitulos: 50 },
  { nome: "Êxodo", capitulos: 40 },
  { nome: "Levítico", capitulos: 27 },
  { nome: "Números", capitulos: 36 },
  { nome: "Deuteronômio", capitulos: 34 },
  { nome: "Josué", capitulos: 24 },
  { nome: "Juízes", capitulos: 21 },
  { nome: "Rute", capitulos: 4 },
  { nome: "1 Samuel", capitulos: 31 },
  { nome: "2 Samuel", capitulos: 24 },
  { nome: "1 Reis", capitulos: 22 },
  { nome: "2 Reis", capitulos: 25 },
  { nome: "1 Crônicas", capitulos: 29 },
  { nome: "2 Crônicas", capitulos: 36 },
  { nome: "Esdras", capitulos: 10 },
  { nome: "Neemias", capitulos: 13 },
  { nome: "Ester", capitulos: 10 },
  { nome: "Jó", capitulos: 42 },
  { nome: "Salmos", capitulos: 150 },
  { nome: "Provérbios", capitulos: 31 },
  { nome: "Eclesiastes", capitulos: 12 },
  { nome: "Cântico de Salomão", capitulos: 8 },
  { nome: "Isaías", capitulos: 66 },
  { nome: "Jeremias", capitulos: 52 },
  { nome: "Lamentações", capitulos: 5 },
  { nome: "Ezequiel", capitulos: 48 },
  { nome: "Daniel", capitulos: 12 },
  { nome: "Oseias", capitulos: 14 },
  { nome: "Joel", capitulos: 3 },
  { nome: "Amós", capitulos: 9 },
  { nome: "Obadias", capitulos: 1 },
  { nome: "Jonas", capitulos: 4 },
  { nome: "Miqueias", capitulos: 7 },
  { nome: "Naum", capitulos: 3 },
  { nome: "Habacuque", capitulos: 3 },
  { nome: "Sofonias", capitulos: 3 },
  { nome: "Ageu", capitulos: 2 },
  { nome: "Zacarias", capitulos: 14 },
  { nome: "Malaquias", capitulos: 4 },
  { nome: "Mateus", capitulos: 28 },
  { nome: "Marcos", capitulos: 16 },
  { nome: "Lucas", capitulos: 24 },
  { nome: "João", capitulos: 21 },
  { nome: "Atos", capitulos: 28 },
  { nome: "Romanos", capitulos: 16 },
  { nome: "1 Coríntios", capitulos: 16 },
  { nome: "2 Coríntios", capitulos: 13 },
  { nome: "Gálatas", capitulos: 6 },
  { nome: "Efésios", capitulos: 6 },
  { nome: "Filipenses", capitulos: 4 },
  { nome: "Colossenses", capitulos: 4 },
  { nome: "1 Tessalonicenses", capitulos: 5 },
  { nome: "2 Tessalonicenses", capitulos: 3 },
  { nome: "1 Timóteo", capitulos: 6 },
  { nome: "2 Timóteo", capitulos: 4 },
  { nome: "Tito", capitulos: 3 },
  { nome: "Filêmon", capitulos: 1 },
  { nome: "Hebreus", capitulos: 13 },
  { nome: "Tiago", capitulos: 5 },
  { nome: "1 Pedro", capitulos: 5 },
  { nome: "2 Pedro", capitulos: 3 },
  { nome: "1 João", capitulos: 5 },
  { nome: "2 João", capitulos: 1 },
  { nome: "3 João", capitulos: 1 },
  { nome: "Judas", capitulos: 1 },
  { nome: "Apocalipse", capitulos: 22 },
];

export const nomeDoLivro = (livro: number) => LIVROS[livro - 1]?.nome ?? "";

/**
 * Um pedaço contínuo de um livro: do capítulo `de` ao `ate`. Versículo só nas pontas que não são
 * o capítulo inteiro (o Salmo 119 em duas partes, "Gênesis 6:9–9:19").
 */
export interface Parte {
  livro: number;
  de: number;
  ate: number;
  deVers?: number;
  ateVers?: number;
}

/** "Gênesis 4–7", "Salmos 116–119:63", "Salmos 119:64–176", "Obadias", "1 Reis 8". */
export function rotuloParte(p: Parte) {
  const nome = nomeDoLivro(p.livro);
  if (LIVROS[p.livro - 1]?.capitulos === 1 && p.deVers === undefined && p.ateVers === undefined) return nome;
  const ini = p.deVers !== undefined ? `${p.de}:${p.deVers}` : `${p.de}`;
  if (p.de === p.ate && p.deVers === undefined && p.ateVers === undefined) return `${nome} ${p.de}`;
  // Dentro de um capítulo só, o fim é só o versículo: "119:64–176".
  const fim = p.de === p.ate && p.deVers !== undefined ? `${p.ateVers}` : p.ateVers !== undefined ? `${p.ate}:${p.ateVers}` : `${p.ate}`;
  return `${nome} ${ini}–${fim}`;
}

/** "a", "a e b", "a, b e c". */
export const juntar = (r: string[]) => (r.length > 1 ? `${r.slice(0, -1).join(", ")} e ${r[r.length - 1]}` : r[0] ?? "");

/** Várias partes num trecho só ("Gênesis 6:9–9:19"; "Efésios 5:28–33 e Efésios 6:1–4"). */
export const rotuloPartes = (partes: Parte[]) => juntar(partes.map(rotuloParte));

const tres = (n: number) => String(n).padStart(3, "0");
const codigo = (livro: number, cap: number, vers: number) => `${String(livro).padStart(2, "0")}${tres(cap)}${tres(vers)}`;

/**
 * "Ler": o link do jw.org que abre o trecho no JW Library quando o celular tem o app (sem ele,
 * abre a Bíblia de Estudo no jw.org). Conferido: `01004000-01007999` abre Gênesis 4–7.
 */
export const linkLer = (p: Parte) =>
  `https://www.jw.org/finder?wtlocale=T&prefer=lang&bible=${codigo(p.livro, p.de, p.deVers ?? 0)}-${codigo(p.livro, p.ate, p.ateVers ?? 999)}&pub=nwtsty`;

/** O capítulo na Biblioteca On-line (Bíblia de Estudo, com as notas). */
export const linkWol = (livro: number, capitulo: number) => `https://wol.jw.org/pt/wol/b/r5/lp-t/nwtsty/${livro}/${capitulo}`;

/** Sem acento e em minúsculas: "ISAÍAS" casa com "Isaías". */
const chave = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const POR_NOME = new Map(LIVROS.map((l, i) => [chave(l.nome), i + 1]));
// Como a apostila às vezes escreve.
POR_NOME.set("salmo", 19);
POR_NOME.set("cantico dos canticos", 22);

/**
 * A leitura semanal da apostila ("ISAÍAS 1-2", "SALMOS 120-126", "1 SAMUEL 3", "OSEIAS 8-14")
 * virando trecho. Null quando não dá para ler com segurança: aí o app só mostra o texto.
 */
export function lerLeituraSemanal(texto: string | null | undefined): Parte | null {
  const m = String(texto || "")
    .replace(/[–—]/g, "-")
    .match(/^\s*(\d\s*)?([^\d]+?)\s+(\d+)(?:\s*-\s*(\d+))?\s*$/);
  if (!m) return null;
  const livro = POR_NOME.get(chave(`${m[1] ? `${m[1].trim()} ` : ""}${m[2]}`));
  if (!livro) return null;
  const de = Number(m[3]);
  const ate = m[4] ? Number(m[4]) : de;
  if (de < 1 || ate < de || ate > LIVROS[livro - 1].capitulos) return null;
  return { livro, de, ate };
}

/** Os capítulos ("livro:capítulo") que a parte cobre por inteiro. Ponta com versículo não conta. */
export function capitulosInteiros(p: Parte): string[] {
  const r: string[] = [];
  for (let c = p.de; c <= p.ate; c++) {
    if ((c === p.de && p.deVers !== undefined && p.deVers > 1) || (c === p.ate && p.ateVers !== undefined)) continue;
    r.push(`${p.livro}:${c}`);
  }
  return r;
}
