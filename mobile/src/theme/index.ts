/**
 * Design tokens — tema "Terroso" (importado do Claude Design).
 * Paleta quente: creme/areia + verde-oliva + terracota.
 *
 * As cores existem em quatro paletas: claro/escuro × normal/daltônico. Quem
 * desenha tela NÃO importa `colors` daqui — usa `useTema()` de
 * `@/theme/TemaContext`, que entrega a paleta escolhida em Ajustes. O export
 * estático `colors` (sempre claro) fica só para o que é imagem/PDF exportado:
 * o cartão compartilhado tem que sair igual para todo mundo, seja qual for o
 * tema do aparelho de quem gerou.
 */

export interface Cores {
  // Marca (verde-oliva)
  primary: string;
  primaryDark: string;
  primaryDarker: string;
  oliveSoft: string;
  primaryGradient: readonly [string, string];
  loginGradient: readonly [string, string, string];

  // Acentos terrosos
  terracotta: string;
  brown: string;
  sand: string;
  orange: string;
  orangeDark: string;
  purple: string;
  purpleDark: string;
  green: string;
  greenDark: string;
  red: string;
  redDark: string;
  amber: string;
  /**
   * Terceira cor de categoria (a "Reunião" na lista de compromissos). O terroso
   * é todo quente — sem um tom frio, quadro e reunião viram o mesmo oliva. Não
   * é decoração: é o que deixa a lista legível de relance.
   */
  teal: string;
  tealBg: string;

  // Superfícies
  background: string;
  surface: string;
  surfaceMuted: string;
  slotBg: string;
  slotBorder: string;

  // Texto
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;

  // Bordas
  border: string;
  borderStrong: string;

  // Fundos de status / destaques
  successBg: string;
  warningBg: string;
  dangerBg: string;
  infoBg: string;

  // Detalhes de componente
  /** Escurecimento atrás de modais e sheets. */
  backdrop: string;
  /** A alça (handle) do bottom sheet. */
  handle: string;
  /** Etiqueta pequena de mês ao lado do número do dia. */
  mesEtiqueta: string;
  /** Texto/ícone de aviso forte ("Seguida"). */
  warningStrong: string;
}

const claro: Cores = {
  primary: "#5E6B48", // CTA / botões
  primaryDark: "#566239", // ativo / texto forte
  primaryDarker: "#1E1D14", // fundo login mais escuro
  oliveSoft: "#6E7B57", // ícones / oliva claro
  primaryGradient: ["#6E7B57", "#5E6B48"],
  loginGradient: ["#3A382C", "#29281D", "#1E1D14"],

  terracotta: "#B06A43", // números de dia
  brown: "#9A7E55", // ícone de arquivo / sand stroke
  sand: "#EDE6D5", // caixa de ícone / avatar areia
  orange: "#9A7E55",
  orangeDark: "#7A6340",
  purple: "#6E7B57",
  purpleDark: "#566239",
  green: "#5E6B48",
  greenDark: "#566239",
  red: "#A8503B", // terracota (excluir)
  redDark: "#9A4632",
  amber: "#9A5A38",
  teal: "#2F6F7E",
  tealBg: "#E4EFF2",

  background: "#F3EDE2", // fundo do app
  surface: "#FBF7EF", // cartões
  surfaceMuted: "#F6F0E4", // inputs
  slotBg: "#F8F3E9", // células de designação
  slotBorder: "#E7DECD",

  text: "#2B2620",
  textSecondary: "#8A8071",
  textMuted: "#A2977F",
  textOnPrimary: "#FBF7EF",

  border: "#ECE3D3",
  borderStrong: "#E6DCC9",

  successBg: "#E2E7D2",
  warningBg: "#F1E1D2",
  dangerBg: "#F8EDE8",
  infoBg: "#EEF0E3", // pílula de dia da semana (sage)

  backdrop: "rgba(28,27,20,0.5)",
  handle: "#E2D9C7",
  mesEtiqueta: "#C2A98C",
  warningStrong: "#b45309",
};

/**
 * O terroso à noite: os mesmos marrons quentes, invertidos. Tokens com sufixo
 * "Dark" são TEXTO FORTE em cima dos fundos suaves — no escuro eles precisam
 * clarear, não escurecer, senão somem no fundo.
 */
const escuro: Cores = {
  primary: "#77855A",
  primaryDark: "#96A578",
  primaryDarker: "#12110B",
  oliveSoft: "#8C9A6F",
  primaryGradient: ["#55613F", "#404A2F"],
  loginGradient: ["#3A382C", "#29281D", "#1E1D14"],

  terracotta: "#CE8F66",
  brown: "#B7A077",
  sand: "#38321F",
  orange: "#B7A077",
  orangeDark: "#D3B385",
  purple: "#8C9A6F",
  purpleDark: "#A9B78C",
  green: "#8CA268",
  greenDark: "#A5BA82",
  red: "#D07B63",
  redDark: "#DE9179",
  amber: "#CE9166",
  teal: "#6FA9B8",
  tealBg: "#1E2E33",

  background: "#1A1712",
  surface: "#242019",
  surfaceMuted: "#2B261D",
  slotBg: "#2B261D",
  slotBorder: "#3C3528",

  text: "#EDE7DA",
  textSecondary: "#A89D88",
  textMuted: "#8A7F6B",
  textOnPrimary: "#FBF7EF",

  border: "#332D22",
  borderStrong: "#413A2C",

  successBg: "#2A3120",
  warningBg: "#3B2F1E",
  dangerBg: "#3C271F",
  infoBg: "#2D3223",

  backdrop: "rgba(0,0,0,0.62)",
  handle: "#4A4232",
  mesEtiqueta: "#8F805F",
  warningStrong: "#D9A05B",
};

/**
 * Modo daltônico: troca o eixo de cor do app inteiro, não só os selos.
 *
 * O tema terroso é construído sobre oliva (marca) e terracota (destaques) — que
 * é exatamente o eixo vermelho-verde que protanopia e deuteranopia colapsam:
 * simulados, os dois viram o mesmo marrom acinzentado. Mexer só em "sucesso" e
 * "perigo" não resolvia nada, porque o que o irmão olha o dia inteiro é o oliva
 * da marca e o terracota dos números de dia.
 *
 * Aqui a paleta vai para o eixo AZUL × LARANJA (base Okabe-Ito), que sobrevive
 * aos três tipos de daltonismo: a marca vira azul, os acentos quentes viram
 * laranja/âmbar francos e o "sucesso" vira azul-esverdeado — os três continuam
 * separáveis entre si. Todos os pares foram conferidos em contraste WCAG contra
 * o fundo em que aparecem.
 */
const daltonicoClaro: Partial<Cores> = {
  // Marca: oliva -> azul
  primary: "#1F6FA8",
  primaryDark: "#17557F",
  oliveSoft: "#2E7FB5",
  primaryGradient: ["#2E7FB5", "#1F6FA8"],
  purple: "#2E7FB5",
  purpleDark: "#17557F",

  // Sucesso: azul-esverdeado (distinto do azul da marca e do laranja de perigo)
  green: "#0F7B63",
  greenDark: "#0B6350",
  successBg: "#D6EBE5",
  teal: "#0F7B63",
  tealBg: "#D6EBE5",

  // Perigo: laranja-vermelho franco
  red: "#C2410C",
  redDark: "#9C3306",
  dangerBg: "#FBE6DA",

  // Acentos quentes: laranja/âmbar de verdade, longe do marrom
  terracotta: "#B45309",
  orange: "#B45309",
  orangeDark: "#92400E",
  amber: "#8F5706",
  warningStrong: "#8F5706",
  warningBg: "#FBEFD4",

  // Pílulas e caixas de ícone acompanham a marca
  infoBg: "#DCEAF4",
  sand: "#DCEAF4",
  // O marrom vira azul junto: ele é o ícone DENTRO da caixa `sand`, e sobre o
  // fundo azulado o marrom original ficava em 3.1:1, no limite do legível.
  brown: "#17557F",
  mesEtiqueta: "#8FA9BD",
};

const daltonicoEscuro: Partial<Cores> = {
  primary: "#276E9E",
  primaryDark: "#7FB6E0",
  oliveSoft: "#5EA3D2",
  primaryGradient: ["#276E9E", "#1D5478"],
  purple: "#5EA3D2",
  purpleDark: "#7FB6E0",

  green: "#3E9C84",
  greenDark: "#6FC2AB",
  successBg: "#17332C",
  teal: "#6FC2AB",
  tealBg: "#17332C",

  red: "#C2410C",
  redDark: "#F0975F",
  dangerBg: "#3A2416",

  terracotta: "#E0954F",
  orange: "#E0954F",
  orangeDark: "#EFAE6B",
  amber: "#E0A94C",
  warningStrong: "#E0A94C",
  warningBg: "#3A2E17",

  infoBg: "#1D3040",
  sand: "#1D3040",
  brown: "#7FB6E0",
  mesEtiqueta: "#6E90A8",
};

export type Esquema = "claro" | "escuro";

export function paletaDe(esquema: Esquema, daltonico: boolean): Cores {
  const base = esquema === "escuro" ? escuro : claro;
  if (!daltonico) return base;
  return { ...base, ...(esquema === "escuro" ? daltonicoEscuro : daltonicoClaro) };
}

/**
 * Estático de propósito — SÓ para o que sai do aparelho (cartões de imagem,
 * HTML de PDF, cor do canal de notificação). Tela usa useTema().
 */
export const colors: Cores = claro;

export interface StatusVisual {
  label: string;
  color: string;
  bg: string;
}

export function statusConfigDe(
  esquema: Esquema,
  daltonico: boolean,
): Record<string, StatusVisual> {
  const escuroAtivo = esquema === "escuro";
  // Publicado × Rascunho é o par que mais precisa ser lido de relance na lista
  // de quadros: no daltônico vira azul-esverdeado × âmbar, não verde × marrom.
  const publicado = daltonico
    ? escuroAtivo
      ? { color: "#6FC2AB", bg: "#17332C" }
      : { color: "#0B6350", bg: "#D6EBE5" }
    : escuroAtivo
      ? { color: "#B3C68B", bg: "#2A3120" }
      : { color: "#54622F", bg: "#E2E7D2" };

  const rascunho = daltonico
    ? escuroAtivo
      ? { color: "#E0A94C", bg: "#3A2E17" }
      : { color: "#8F5706", bg: "#FBEFD4" }
    : escuroAtivo
      ? { color: "#D9A874", bg: "#3B2F1E" }
      : { color: "#9A5A38", bg: "#F1E1D2" };

  return {
    rascunho: { label: "Rascunho", ...rascunho },
    publicado: { label: "Publicado", ...publicado },
    arquivado: escuroAtivo
      ? { label: "Arquivado", color: "#A89D88", bg: "#332D22" }
      : { label: "Arquivado", color: "#8A8071", bg: "#EAE3D6" },
  };
}

/** Estático (claro) — mesmo aviso do `colors` acima: só para exportações. */
export const statusConfig: Record<string, StatusVisual> = statusConfigDe(
  "claro",
  false,
);

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: "#2B2620",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  raised: {
    shadowColor: "#1E1D14",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 6,
  },
} as const;

export const MESES = [
  "",
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const MESES_CURTO = [
  "",
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
] as const;

/**
 * Movimento das superfícies que entram na tela (folha, toast, splash).
 *
 * Entrada é desaceleração pura, sem mola. A mola de antes passava do ponto de
 * chegada e voltava — num sheet de tela cheia esse retorno vira um salto de uns
 * 20px, e é ele que faz o modal parecer que bateu ao abrir.
 *
 * `curvaSuave` são os pontos de controle de um ease-out longo: arranca rápido e
 * encosta devagar, sem nunca ultrapassar o destino. Serve tanto para o `Easing`
 * do Reanimated quanto para o do react-native — os dois aceitam bezier com os
 * mesmos quatro números.
 */
export const motion = {
  /** ms — entrada de uma superfície (folha subindo, toast descendo). */
  entrada: 380,
  /** ms — saída e fades curtos. */
  saida: 220,
  /** ms — fade do backdrop. Um pouco mais longo que a saída, para o escurecimento
   *  não chegar antes da folha. */
  fundo: 300,
  curvaSuave: [0.16, 1, 0.3, 1],
} as const;

/** Indexado por `Date.getDay()` — 0 = domingo, como o `diaSemana` da API. */
export const DIAS_CURTOS = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
] as const;
