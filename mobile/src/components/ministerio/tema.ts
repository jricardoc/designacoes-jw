import { ajusteDaltonico, type Cores, type Esquema } from "@/theme";

/**
 * O ambiente Ministério tem cara própria: verde-esmeralda e menta sobre um fundo que respira,
 * longe do terroso do Servir Mais. Os nomes dos tokens são os mesmos (`primary`, `surface`...),
 * então folhas, botões e campos compartilhados se pintam sozinhos dentro de `PaletaPropria`.
 */
const claro: Cores = {
  primary: "#0A7F61",
  primaryDark: "#08694F",
  primaryDarker: "#05261D",
  oliveSoft: "#23A982",
  primaryGradient: ["#17B288", "#0A7F61"],
  loginGradient: ["#0E3B30", "#082A22", "#05261D"],

  terracotta: "#D9693C",
  brown: "#6F6250",
  sand: "#D9F2E8",
  orange: "#C76A12",
  orangeDark: "#9A4F0A",
  purple: "#5B52D6",
  purpleDark: "#433BB3",
  green: "#109A64",
  greenDark: "#0A7349",
  red: "#D2453D",
  redDark: "#A8322B",
  amber: "#9E6408",
  teal: "#0B8EA3",
  tealBg: "#DBF2F6",

  background: "#ECF6F1",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F8F4",
  slotBg: "#F4FAF7",
  slotBorder: "#D5E8DF",

  text: "#0E2A21",
  textSecondary: "#4F6B61",
  textMuted: "#7E988E",
  textOnPrimary: "#FFFFFF",

  border: "#D8EAE2",
  borderStrong: "#C5DDD2",

  successBg: "#D9F3E6",
  warningBg: "#FCEFD9",
  dangerBg: "#FCE4E2",
  infoBg: "#DFF0FA",

  backdrop: "rgba(5,38,29,0.45)",
  handle: "#C9E0D6",
  mesEtiqueta: "#79B39E",
  warningStrong: "#A35F07",
};

/** À noite: verde-petróleo profundo com menta acesa. O texto sobre o botão vira escuro. */
const escuro: Cores = {
  primary: "#2CCF9C",
  primaryDark: "#74E6C2",
  primaryDarker: "#03140F",
  oliveSoft: "#3CC497",
  primaryGradient: ["#2CCF9C", "#109A74"],
  loginGradient: ["#0E3B30", "#082A22", "#05261D"],

  terracotta: "#FF9468",
  brown: "#C7B79E",
  sand: "#123A2F",
  orange: "#FFA65A",
  orangeDark: "#FFC48E",
  purple: "#9C95FF",
  purpleDark: "#BEB9FF",
  green: "#34D399",
  greenDark: "#7BE8BF",
  red: "#FF7B71",
  redDark: "#FFA199",
  amber: "#F5B83D",
  teal: "#3ED3E6",
  tealBg: "#0D2E35",

  background: "#06130F",
  surface: "#0E211B",
  surfaceMuted: "#132922",
  slotBg: "#132922",
  slotBorder: "#1E3C32",

  text: "#E4F5EE",
  textSecondary: "#9CBDB1",
  textMuted: "#6D9083",
  textOnPrimary: "#03140F",

  border: "#1A362D",
  borderStrong: "#23473B",

  successBg: "#0E3326",
  warningBg: "#382A0F",
  dangerBg: "#3A1B19",
  infoBg: "#0E293A",

  backdrop: "rgba(0,0,0,0.6)",
  handle: "#2A4A40",
  mesEtiqueta: "#4E8E78",
  warningStrong: "#F5B83D",
};

export function paletaMinisterio(esquema: Esquema, daltonico: boolean): Cores {
  const base = esquema === "escuro" ? escuro : claro;
  return daltonico ? { ...base, ...ajusteDaltonico(esquema) } : base;
}

/** O que não é cor de componente: o fundo animado e o vidro. */
export function efeitosDe(esquema: Esquema) {
  return esquema === "escuro"
    ? {
        fundo: ["#04110D", "#061A15", "#08121C"] as const,
        bolhas: ["#0FA77C", "#137CB0", "#6B4CD6"] as const,
        vidro: "rgba(14,33,27,0.62)",
        vidroAndroid: "rgba(14,33,27,0.9)",
        vidroBorda: "rgba(124,255,214,0.10)",
        tint: "dark" as const,
      }
    : {
        fundo: ["#E6F7EF", "#F3FBF7", "#E7F2FB"] as const,
        bolhas: ["#7FE3C1", "#93D2F7", "#FFD8A3"] as const,
        vidro: "rgba(255,255,255,0.68)",
        vidroAndroid: "rgba(255,255,255,0.88)",
        vidroBorda: "rgba(255,255,255,0.95)",
        tint: "light" as const,
      };
}

/** As medalhas: o degradê de cada nível (do brilho para a sombra). */
export const METAL = {
  ouro: ["#FFE7A0", "#F2B93F", "#C88A10"],
  prata: ["#F4F7FA", "#C9D2DC", "#8D9AA9"],
  bronze: ["#F8D2AE", "#DA915A", "#A65C2B"],
} as const;
