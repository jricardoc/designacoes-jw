import { Platform } from "react-native";
import type { VidroBarra } from "@/components/layout/BarraAmbiente";
import { ajusteDaltonico, type Cores, type Esquema } from "@/theme";

/**
 * O ambiente Estudo pessoal tem cara de livro: papel creme e vinho, com dourado nas marcas de
 * regularidade. Sem fundo animado: é tela de ler. Os nomes dos tokens são os mesmos dos outros
 * ambientes, então folhas, botões e campos compartilhados se pintam sozinhos em `PaletaPropria`.
 * Contraste conferido (WCAG AA): vinho com branco 8,0; texto secundário no papel 6,7; o mais
 * apagado 4,9; os marcadores (vermelho e azul) no cartão, 5,3.
 */
const claro: Cores = {
  primary: "#8C2F4B",
  primaryDark: "#6E2239",
  primaryDarker: "#2B0E17",
  oliveSoft: "#B0526D",
  primaryGradient: ["#A8435F", "#8C2F4B"],
  loginGradient: ["#3A1420", "#2B0E17", "#1E0910"],

  terracotta: "#C2562F",
  brown: "#6F5A4A",
  sand: "#F3E6DA",
  orange: "#B4610F",
  orangeDark: "#8E4B0B",
  purple: "#5B4FC4",
  purpleDark: "#4338A8",
  green: "#2D7A4E",
  greenDark: "#1F5E3A",
  red: "#C23B36",
  redDark: "#9C2B27",
  amber: "#9A6A12",
  teal: "#1F6FB2",
  tealBg: "#E1EDF8",

  background: "#FAF5EE",
  surface: "#FFFFFF",
  surfaceMuted: "#F6EFE6",
  slotBg: "#FBF7F1",
  slotBorder: "#E9DDD0",

  text: "#2A1B17",
  textSecondary: "#6A5148",
  textMuted: "#7F665B",
  textOnPrimary: "#FFFFFF",

  border: "#EADFD3",
  borderStrong: "#DCCBBB",

  successBg: "#DFF1E5",
  warningBg: "#FBEFD8",
  dangerBg: "#FBE3E1",
  infoBg: "#F5E7ED",

  backdrop: "rgba(43,14,23,0.45)",
  handle: "#E2D3C6",
  mesEtiqueta: "#B08E7C",
  warningStrong: "#9A5A07",
};

/** À noite: papel escuro e vinho claro. O texto sobre o botão vira escuro. */
const escuro: Cores = {
  primary: "#E58FA8",
  primaryDark: "#F2B5C6",
  primaryDarker: "#1A070D",
  oliveSoft: "#D2738F",
  primaryGradient: ["#E58FA8", "#B85A78"],
  loginGradient: ["#3A1420", "#2B0E17", "#1E0910"],

  terracotta: "#FF946B",
  brown: "#CDB8A6",
  sand: "#3A2329",
  orange: "#FFA65A",
  orangeDark: "#FFC48E",
  purple: "#A79EFF",
  purpleDark: "#C4BEFF",
  green: "#5FD39A",
  greenDark: "#8EE6B9",
  red: "#FF7B73",
  redDark: "#FFA19A",
  amber: "#F2C25A",
  teal: "#6FB6F2",
  tealBg: "#10283A",

  background: "#140D0E",
  surface: "#211617",
  surfaceMuted: "#2A1D1F",
  slotBg: "#2A1D1F",
  slotBorder: "#3A2A2C",

  text: "#F5EAE6",
  textSecondary: "#C9B3AC",
  textMuted: "#9C8580",
  textOnPrimary: "#2A0A14",

  border: "#33242A",
  borderStrong: "#45313A",

  successBg: "#12301F",
  warningBg: "#382A10",
  dangerBg: "#3A1A1C",
  infoBg: "#3A1F29",

  backdrop: "rgba(0,0,0,0.6)",
  handle: "#4A3539",
  mesEtiqueta: "#9C7E85",
  warningStrong: "#F2C25A",
};

export function paletaEstudo(esquema: Esquema, daltonico: boolean): Cores {
  const base = esquema === "escuro" ? escuro : claro;
  return daltonico ? { ...base, ...ajusteDaltonico(esquema) } : base;
}

/** O vidro da barra, no tom do papel. */
export function vidroEstudo(esquema: Esquema): VidroBarra {
  return esquema === "escuro"
    ? { vidro: "rgba(33,22,23,0.82)", vidroBorda: "rgba(229,143,168,0.14)", tint: "dark" }
    : { vidro: "rgba(255,255,255,0.84)", vidroBorda: "rgba(140,47,75,0.10)", tint: "light" };
}

/**
 * A letra de livro do ambiente, nos títulos de leitura (a passagem do dia, o assunto do estudo).
 * Sem fonte nova no app: a serifada do sistema (a do Apple Books no iPhone, a Noto Serif no Android).
 */
export const SERIFA = Platform.select({ ios: "Iowan Old Style", default: "serif" });

/**
 * O cartão da leitura de hoje: o degradê vinho da marca do ambiente, com texto creme e o dourado
 * do progresso. Contraste conferido: creme no vinho 6,6 (claro) e 12 (escuro); o creme suave, 5,0.
 */
export function heroiEstudo(esquema: Esquema) {
  return esquema === "escuro"
    ? {
        fundo: ["#5E1B30", "#4A1526", "#33101B"] as const,
        texto: "#FBF1EA",
        suave: "rgba(251,241,234,0.76)",
        ouro: "#F2C25A",
        trilho: "rgba(251,241,234,0.18)",
        vidro: "rgba(251,241,234,0.12)",
        botaoTexto: "#4A1526",
      }
    : {
        fundo: ["#963A56", "#7E2C45", "#5E1B30"] as const,
        texto: "#FFF8F2",
        suave: "rgba(255,248,242,0.82)",
        ouro: "#F6C453",
        trilho: "rgba(255,248,242,0.24)",
        vidro: "rgba(255,248,242,0.14)",
        botaoTexto: "#7E2C45",
      };
}
