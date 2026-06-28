/**
 * Design tokens — tema "Terroso" (importado do Claude Design).
 * Paleta quente: creme/areia + verde-oliva + terracota.
 */

export const colors = {
  // Marca (verde-oliva)
  primary: "#5E6B48", // CTA / botões
  primaryDark: "#566239", // ativo / texto forte
  primaryDarker: "#1E1D14", // fundo login mais escuro
  oliveSoft: "#6E7B57", // ícones / oliva claro
  primaryGradient: ["#6E7B57", "#5E6B48"] as const,
  loginGradient: ["#3A382C", "#29281D", "#1E1D14"] as const,

  // Acentos terrosos
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

  // Superfícies
  background: "#F3EDE2", // fundo do app
  surface: "#FBF7EF", // cartões
  surfaceMuted: "#F6F0E4", // inputs
  slotBg: "#F8F3E9", // células de designação
  slotBorder: "#E7DECD",

  // Texto
  text: "#2B2620",
  textSecondary: "#8A8071",
  textMuted: "#A2977F",
  textOnPrimary: "#FBF7EF",

  // Bordas
  border: "#ECE3D3",
  borderStrong: "#E6DCC9",

  // Fundos de status / destaques
  successBg: "#E2E7D2",
  warningBg: "#F1E1D2",
  dangerBg: "#F8EDE8",
  infoBg: "#EEF0E3", // pílula de dia da semana (sage)
} as const;

export const statusConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  rascunho: { label: "Rascunho", color: "#9A5A38", bg: "#F1E1D2" },
  publicado: { label: "Publicado", color: "#54622F", bg: "#E2E7D2" },
  arquivado: { label: "Arquivado", color: "#8A8071", bg: "#EAE3D6" },
};

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
