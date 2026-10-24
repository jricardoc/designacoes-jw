import type { Icone } from "@/components/ministerio/kit";
import type { TipoAssunto, TipoRotina } from "@/api/types";

/**
 * O que o ambiente diz, sempre tirado dos artigos do jw.org e da Biblioteca On-line, e com o
 * link para o artigo. O app não copia texto de publicação: só dicas curtas com a fonte.
 */

export interface Fonte {
  titulo: string;
  origem: string;
  url: string;
}

export const FONTES = {
  regularidade: {
    titulo: "Como fazer seu estudo pessoal com regularidade?",
    origem: "A Sentinela (Estudo), novembro de 2024",
    url: "https://www.jw.org/pt/biblioteca/revistas/sentinela-estudo-novembro-2024/Como-fazer-seu-estudo-pessoal-com-regularidade/",
  },
  proveito: {
    titulo: "Tire mais proveito do seu estudo pessoal",
    origem: "Apostila Vida e Ministério, junho de 2019",
    url: "https://www.jw.org/pt/biblioteca/jw-apostila-do-mes/junho-2019-mwb/programa-reuniao-10-16junho/tirar-proveito-estudo-pessoal/",
  },
  ideias: {
    titulo: "Ideias para estudo pessoal e adoração em família",
    origem: "A Sentinela (Estudo), janeiro de 2024",
    url: "https://www.jw.org/pt/biblioteca/revistas/sentinela-estudo-janeiro-2024/Ideias-para-estudo-pessoal-e-adora%C3%A7%C3%A3o-em-fam%C3%ADlia/",
  },
  seuEstudo: { titulo: "Seu estudo pessoal", origem: "A Sentinela, 1.º de dezembro de 1956", url: "https://wol.jw.org/pt/wol/d/r5/lp-t/1956331" },
  melhorando: { titulo: "Melhorando o estudo pessoal", origem: "A Sentinela, 1.º de março de 1964", url: "https://wol.jw.org/pt/wol/d/r5/lp-t/1963643" },
  comoEsta: {
    titulo: "Como está seu programa de estudo pessoal?",
    origem: "Nosso Ministério do Reino, fevereiro de 1974",
    url: "https://wol.jw.org/pt/wol/d/r5/lp-t/201973443",
  },
  projetoLeitura: {
    titulo: "Projeto de leitura da Bíblia",
    origem: "jw.org (com o programa em PDF)",
    url: "https://www.jw.org/pt/biblioteca/series/outros-assuntos/projeto-leitura-biblia/",
  },
  comece: {
    titulo: "Comece sua leitura da Bíblia",
    origem: "Seja Feliz para Sempre!",
    url: "https://www.jw.org/pt/biblioteca/livros/seja-feliz-para-sempre/comece-sua-leitura-da-biblia/",
  },
  maisProveito: {
    titulo: "Como tirar mais proveito de sua leitura da Bíblia",
    origem: "A Sentinela (Estudo), fevereiro de 2023",
    url: "https://www.jw.org/pt/biblioteca/revistas/sentinela-estudo-fevereiro-2023/Como-tirar-mais-proveito-de-sua-leitura-da-B%C3%ADblia/",
  },
  todoDia: {
    titulo: "Permite que Deus fale com você todos os dias?",
    origem: "A Sentinela, 1.º de agosto de 2009",
    url: "https://www.jw.org/pt/biblioteca/revistas/wp20090801/tabela-leitura-diaria-da-biblia/",
  },
  leituraEstudo: { titulo: "Leitura e estudo da Bíblia", origem: "jw.org", url: "https://www.jw.org/pt/ensinos-biblicos/fe-em-deus/leitura-estudo-biblia/" },
  ajudas: { titulo: "Ajudas para Estudar a Bíblia", origem: "jw.org", url: "https://www.jw.org/pt/ensinos-biblicos/ajudas-para-estudar-a-biblia/" },
  criacao: {
    titulo: "Aprenda mais sobre Jeová por meio da criação",
    origem: "A Sentinela (Estudo), março de 2023",
    url: "https://www.jw.org/pt/biblioteca/revistas/sentinela-estudo-marco-2023/Aprenda-mais-sobre-Jeov%C3%A1-por-meio-da-cria%C3%A7%C3%A3o/",
  },
} satisfies Record<string, Fonte>;

/** O que se lê na Biblioteca On-line e no jw.org sem sair dali. */
export const LINKS = {
  textoDoDia: "https://wol.jw.org/pt/wol/h/r5/lp-t",
  /** A pesquisa da Biblioteca On-line ("Pesquise", no passo a passo do estudo). */
  pesquisar: (termo: string) => `https://wol.jw.org/pt/wol/s/r5/lp-t?q=${encodeURIComponent(termo.trim())}`,
  /** As reuniões de uma semana (a apostila e A Sentinela de estudo), pela semana ISO. */
  reunioes: (d = new Date()) => {
    const { ano, semana } = semanaIso(d);
    return `https://wol.jw.org/pt/wol/meetings/r5/lp-t/${ano}/${semana}`;
  },
};

/** A semana ISO (segunda a domingo; a semana 1 tem a primeira quinta do ano). */
export function semanaIso(d: Date) {
  const dia = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = dia.getUTCDay() || 7;
  dia.setUTCDate(dia.getUTCDate() + 4 - n);
  const inicioAno = new Date(Date.UTC(dia.getUTCFullYear(), 0, 1));
  return { ano: dia.getUTCFullYear(), semana: Math.ceil(((dia.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7) };
}

/** Antes, durante e depois de ler (Sentinela fev/2023 e 1/8/2009). Uma por dia no "Hoje". */
export const DICAS_LEITURA: { texto: string; fonte: Fonte }[] = [
  { texto: "Ore antes de ler: peça a Jeová ajuda para se concentrar.", fonte: FONTES.maisProveito },
  { texto: "Leia sem pressa. Ler em voz alta ou acompanhar o áudio ajuda a entender.", fonte: FONTES.maisProveito },
  { texto: "Pergunte: quem são os personagens? Quem está falando, com quem e por quê? Onde e quando isso aconteceu?", fonte: FONTES.maisProveito },
  { texto: "Procure joias espirituais: que princípios o relato ensina? O que aprendo sobre Jeová?", fonte: FONTES.maisProveito },
  { texto: "Faça anotações curtas: os pontos principais, uma aplicação, o que você sentiu.", fonte: FONTES.maisProveito },
  { texto: "Tenha um horário fixo e um plano B, para nenhum dia passar sem leitura.", fonte: FONTES.todoDia },
  { texto: "Leia o capítulo inteiro dos versículos citados para entender o contexto.", fonte: FONTES.comece },
  { texto: "Ao terminar, ore de novo: agradeça e peça ajuda para aplicar o que leu.", fonte: FONTES.maisProveito },
];

/** As dicas da rotina (Sentinela nov/2024, w56, km 2/74). */
export const DICAS_ROTINA: { texto: string; fonte: Fonte }[] = [
  { texto: "Deixe a programação num lugar visível e ajuste um aviso pouco antes da hora do estudo.", fonte: FONTES.regularidade },
  { texto: "Sem vontade de estudar? Comece com dez minutos. Pouco tempo é melhor do que nada.", fonte: FONTES.regularidade },
  { texto: "Seja flexível: o mais importante não é o horário, a duração nem o assunto, mas a regularidade.", fonte: FONTES.regularidade },
  { texto: "Escolha um horário em que a mente esteja alerta.", fonte: FONTES.seuEstudo },
  { texto: "Aproveite também os momentos de espera para ler uma parte da Bíblia ou de um artigo.", fonte: FONTES.comoEsta },
];

/** O passo a passo do estudo (Apostila jun/2019, w56, km 2/74). */
export const PASSOS: { titulo: string; texto: string; icone: Icone }[] = [
  { titulo: "Ore", texto: "Comece o estudo com oração.", icone: "heart-outline" },
  { titulo: "Leia e pergunte", texto: "O quê? Quem? Como? Quando? Onde? Por quê?", icone: "book-outline" },
  { titulo: "Pesquise", texto: "Aprenda mais sobre o que leu, por assunto ou pelo texto bíblico.", icone: "search-outline" },
  { titulo: "Medite", texto: "Pense em como isso se aplica à sua vida.", icone: "bulb-outline" },
  { titulo: "Resuma", texto: "Diga a ideia principal com suas palavras, numa frase.", icone: "create-outline" },
  { titulo: "Ponha em prática", texto: "O que você vai fazer com o que aprendeu?", icone: "walk-outline" },
];

/** Os tipos de assunto: as ideias de jan/2024 e a pergunta que surge na semana (nov/2024). */
export const TIPOS_ASSUNTO: Record<TipoAssunto, { rotulo: string; icone: Icone; ideia?: string; fonte?: Fonte }> = {
  assunto: { rotulo: "Assunto ou artigo", icone: "document-text-outline" },
  pergunta: { rotulo: "Pergunta que surgiu", icone: "help-circle-outline", ideia: "Anote as perguntas que surgirem durante a semana.", fonte: FONTES.regularidade },
  reuniao: { rotulo: "Preparar as reuniões", icone: "people-outline", ideia: "Treine os cânticos e prepare um comentário.", fonte: FONTES.ideias },
  relato: { rotulo: "Relato da Bíblia", icone: "reader-outline", ideia: "Leia um relato e anote os pontos principais.", fonte: FONTES.ideias },
  oracao: { rotulo: "Uma oração da Bíblia", icone: "heart-outline", ideia: "Estude uma oração registrada na Bíblia e veja como melhorar as suas.", fonte: FONTES.ideias },
  video: { rotulo: "Vídeo", icone: "play-circle-outline", ideia: "Assista a um vídeo e faça anotações.", fonte: FONTES.ideias },
  campo: { rotulo: "Apresentações para o campo", icone: "chatbubbles-outline", ideia: "Prepare e ensaie apresentações para o ministério.", fonte: FONTES.ideias },
  criacao: { rotulo: "Observar a criação", icone: "leaf-outline", ideia: "Medite no que a criação ensina sobre Jeová.", fonte: FONTES.criacao },
};

export const TIPOS_ROTINA: Record<TipoRotina, { rotulo: string; icone: Icone }> = {
  leitura: { rotulo: "Leitura da Bíblia", icone: "book-outline" },
  estudo: { rotulo: "Estudo pessoal", icone: "bulb-outline" },
  familia: { rotulo: "Adoração em família", icone: "home-outline" },
  reuniao: { rotulo: "Preparar a reunião", icone: "people-outline" },
};

/** Só jw.org e Biblioteca On-line, com https (a mesma regra do servidor). */
export function ehLinkJw(texto: string) {
  try {
    const url = new URL(texto.trim());
    return url.protocol === "https:" && ["jw.org", "www.jw.org", "wol.jw.org"].includes(url.hostname);
  } catch {
    return false;
  }
}
