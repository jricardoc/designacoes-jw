import type { VidroBarra } from "@/components/layout/BarraAmbiente";
import { ajusteDaltonico, type Cores, type Esquema } from "@/theme";

/**
 * O ambiente Território: azul de mapa, com laranja no "Paramos aqui" e no "Você está aqui". Feito
 * para a rua: fundo claro, cartões cheios (sem vidro) e texto forte, que se lê no sol. Longe do
 * oliva do Servir Mais e do verde do Ministério. Os tokens são os mesmos (`primary`, `surface`...),
 * então mapa, folhas e botões se pintam sozinhos dentro de `PaletaPropria`.
 */
const claro: Cores = {
  primary: "#1D5FBF",
  primaryDark: "#164A96",
  primaryDarker: "#0A1E3C",
  oliveSoft: "#3B7DD8",
  primaryGradient: ["#3381E6", "#1D5FBF"],
  loginGradient: ["#143563", "#0E274B", "#0A1E3C"],

  terracotta: "#C94A0A",
  // "Não iniciado" no mapa: violeta, para não se confundir com o cinza do "Sem registro".
  brown: "#6349C2",
  sand: "#DDE9F8",
  orange: "#C94A0A",
  orangeDark: "#A33C08",
  purple: "#6A4FD3",
  purpleDark: "#5038B0",
  green: "#16855A",
  greenDark: "#0E6B47",
  // O pino "Paramos aqui" é desta cor: laranja-avermelhado.
  red: "#C9440E",
  redDark: "#A8321A",
  amber: "#9A5800",
  teal: "#0A6F87",
  tealBg: "#D9F0F5",

  background: "#EEF3FA",
  surface: "#FFFFFF",
  surfaceMuted: "#F3F6FB",
  slotBg: "#F5F8FC",
  slotBorder: "#D6E1EF",

  text: "#0C1B2E",
  textSecondary: "#475A73",
  textMuted: "#687C96",
  textOnPrimary: "#FFFFFF",

  border: "#D9E3F0",
  borderStrong: "#C6D3E5",

  successBg: "#DAF1E6",
  warningBg: "#FCEFD8",
  dangerBg: "#FDE6DC",
  infoBg: "#DDE9F8",

  backdrop: "rgba(10,30,60,0.45)",
  handle: "#C9D6E8",
  mesEtiqueta: "#8AA3C2",
  warningStrong: "#9A5800",
};

/** À noite: azul-marinho fundo, com o azul e o laranja acesos. O texto sobre o botão vira escuro. */
const escuro: Cores = {
  primary: "#5B9BFF",
  primaryDark: "#9CC2FF",
  primaryDarker: "#050D1A",
  oliveSoft: "#4F8DF0",
  primaryGradient: ["#5B9BFF", "#2F6FD6"],
  loginGradient: ["#143563", "#0E274B", "#0A1E3C"],

  terracotta: "#FF8A3D",
  brown: "#B4A6FF",
  sand: "#16294A",
  orange: "#FF8A3D",
  orangeDark: "#FFB27A",
  purple: "#A595FF",
  purpleDark: "#C3B8FF",
  green: "#3CCB8C",
  greenDark: "#7EE0B5",
  red: "#FF7A4D",
  redDark: "#FF9E80",
  amber: "#F5B544",
  teal: "#45C8E0",
  tealBg: "#0F2E38",

  background: "#07111F",
  surface: "#0F1C2E",
  surfaceMuted: "#142438",
  slotBg: "#142438",
  slotBorder: "#203651",

  text: "#E6EEF9",
  textSecondary: "#9DB0C9",
  textMuted: "#7489A6",
  textOnPrimary: "#04101F",

  border: "#1B2E47",
  borderStrong: "#243B59",

  successBg: "#0F3324",
  warningBg: "#38290C",
  dangerBg: "#3D1C12",
  infoBg: "#132A4A",

  backdrop: "rgba(0,0,0,0.6)",
  handle: "#2A3F5C",
  mesEtiqueta: "#5C7699",
  warningStrong: "#F5B544",
};

export function paletaTerritorio(esquema: Esquema, daltonico: boolean): Cores {
  const base = esquema === "escuro" ? escuro : claro;
  return daltonico ? { ...base, ...ajusteDaltonico(esquema) } : base;
}

/** O vidro da barra: mais cheio que o do Ministério, para a barra não sumir em cima do mapa. */
export function vidroTerritorio(esquema: Esquema): VidroBarra {
  return esquema === "escuro"
    ? { vidro: "rgba(15,28,46,0.78)", vidroBorda: "rgba(156,194,255,0.14)", tint: "dark" }
    : { vidro: "rgba(255,255,255,0.82)", vidroBorda: "rgba(255,255,255,0.95)", tint: "light" };
}
