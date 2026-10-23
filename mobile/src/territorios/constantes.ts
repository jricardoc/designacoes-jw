import type { Ionicons } from "@expo/vector-icons";
import { Linking } from "react-native";
import type { CasaTrabalhada, SituacaoTerritorio, TipoMarcacao } from "@/api/types";
import type { Cores } from "@/theme";

type Icone = keyof typeof Ionicons.glyphMap;

/**
 * Os tipos de ponto no mapa. A cor vem do tema (funciona no claro, no escuro e no daltônico);
 * a letra vai dentro do pino, para não depender só da cor.
 */
export const MARCACOES: Record<
  TipoMarcacao,
  { rotulo: string; descricao: string; letra: string; icone: Icone; cor: (c: Cores) => string }
> = {
  parada: {
    rotulo: "Paramos aqui",
    descricao: "A última casa da saída",
    letra: "P",
    icone: "flag",
    cor: (c) => c.red,
  },
  proximo: {
    rotulo: "Próximo começa aqui",
    descricao: "Onde a próxima saída deve começar",
    letra: "→",
    icone: "play",
    cor: (c) => c.green,
  },
  concluido: {
    rotulo: "Trecho concluído",
    descricao: "Rua ou lado já trabalhado",
    letra: "✓",
    icone: "checkmark-done",
    cor: (c) => c.teal,
  },
  nao_bater: {
    rotulo: "Não bater",
    descricao: "Casa que pediu para não receber visitas",
    letra: "!",
    icone: "hand-left",
    cor: (c) => c.redDark,
  },
  observacao: {
    rotulo: "Observação",
    descricao: "Portão, cachorro, acesso...",
    letra: "i",
    icone: "information-circle",
    cor: (c) => c.amber,
  },
};

export const TIPOS_MARCACAO = Object.keys(MARCACOES) as TipoMarcacao[];

/** Cores para escolher na área. As mesmas que o servidor dá a quem ainda não escolheu. */
export const PALETA_AREAS = ["#E53935", "#1E88E5", "#43A047", "#8E24AA", "#FB8C00", "#00ACC1", "#D81B60", "#6D4C41"];

export const SITUACOES: Record<
  SituacaoTerritorio,
  { rotulo: string; icone: Icone; cor: (c: Cores) => string; fundo: (c: Cores) => string }
> = {
  concluido: { rotulo: "Concluído", icone: "checkmark-circle", cor: (c) => c.greenDark, fundo: (c) => c.successBg },
  andamento: { rotulo: "Em andamento", icone: "walk", cor: (c) => c.amber, fundo: (c) => c.warningBg },
  nao_iniciado: { rotulo: "Não iniciado", icone: "pause-circle", cor: (c) => c.brown, fundo: (c) => c.sand },
  sem_registro: { rotulo: "Sem registro", icone: "ellipse-outline", cor: (c) => c.textSecondary, fundo: (c) => c.surfaceMuted },
};

export const CASA_TRABALHADA: Record<CasaTrabalhada, { rotulo: string; explicacao: string }> = {
  sim: { rotulo: "Sim", explicacao: "Continuar na próxima casa" },
  nao: { rotulo: "Não", explicacao: "Começar nesta casa" },
  incerto: { rotulo: "Não tenho certeza", explicacao: "Conferir ao chegar" },
  outro_lugar: { rotulo: "Começar em outro lugar", explicacao: "Dizer onde começar" },
};

export const AVISOS: Record<string, string> = {
  acesso_impedido: "Acesso impedido",
  entrada_outra_rua: "Entrar por outra rua",
  trecho_pendente: "Trecho pendente",
  outro: "Aviso",
};

/**
 * O texto do "Não bater" é o endereço na 1ª linha e, se houver, a descrição nas seguintes —
 * no mesmo campo, para a descrição não precisar de coluna nova no servidor (o limite é o do
 * campo: 300 caracteres no total).
 */
export const juntarEnderecoEDescricao = (endereco: string, descricao: string) =>
  [umaLinha(endereco), umaLinha(descricao)].filter(Boolean).join("\n");

/**
 * Quebra de linha vira espaço. Texto colado de outro app (o cartão do app antigo, por exemplo)
 * chega com várias linhas, e a quebra é o que separa o endereço da descrição: sem isto, a 2ª
 * linha colada na Rua virava "descrição" e o número da casa ia parar no fim dela.
 */
export const umaLinha = (texto: string) => texto.replace(/\s*[\r\n]+\s*/g, " ").trim();

export function separarEnderecoEDescricao(texto: string | null | undefined) {
  const [endereco, ...resto] = (texto ?? "").split("\n");
  return { endereco, descricao: resto.join("\n").trim() || null };
}

/** Abre a rota até o ponto no Google Maps (app, se instalado; senão o navegador). */
export const abrirComoChegar = (lat: number, lng: number) =>
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);

/** Dias sem trabalho a partir dos quais o território aparece como parado. */
export const DIAS_PARADO = 30;

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10-18" -> "18 out" */
export function diaCurto(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MESES_CURTOS[Number(m) - 1] ?? ""}`;
}

/** "Hoje", "Ontem", "há 5 dias", "18 out" — para quando foi a última saída. */
export function quandoFoi(iso: string | null | undefined, hoje = new Date()): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("-").map(Number);
  const dias = Math.round(
    (new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime() - new Date(a, m - 1, d).getTime()) / 864e5,
  );
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias > 1 && dias < 30) return `há ${dias} dias`;
  return diaCurto(iso);
}

/** YYYY-MM-DD de `dias` atrás, no relógio do aparelho. */
export function diaISO(diasAtras = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Ponto [lat, lng] dentro do polígono? (ray casting — o mesmo do backend). Mora em onde.ts, que dá para testar. */
export { dentro } from "./onde";
