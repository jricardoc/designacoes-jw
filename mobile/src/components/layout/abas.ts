import type { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";

/**
 * As cinco abas da barra flutuante, em ordem.
 *
 * Ficam num módulo próprio porque agora DOIS componentes dependem delas e da mesma ordem: a
 * barra, que acende a ativa, e o gesto de arrastar para o lado, que anda para a vizinha.
 * Duplicar a lista faria o swipe pular para uma tela diferente da que o indicador aponta.
 */

export interface Aba {
  /** O nome do arquivo da rota — é por ele que a aba acende. */
  chave: string;
  rotulo: string;
  href: Href;
  icone: keyof typeof Ionicons.glyphMap;
  iconeAtivo: keyof typeof Ionicons.glyphMap;
  /** Glifos com muito ar interno parecem menores; compensa-se por aba. */
  tamanho?: number;
}

export const ABAS: Aba[] = [
  { chave: "minhas", rotulo: "Início", href: "/(tabs)/minhas", icone: "home-outline", iconeAtivo: "home" },
  { chave: "index", rotulo: "Designações", href: "/(tabs)", icone: "clipboard-outline", iconeAtivo: "clipboard" },
  { chave: "dirigentes", rotulo: "Dirigentes", href: "/(tabs)/dirigentes", icone: "people-outline", iconeAtivo: "people" },
  { chave: "reuniao", rotulo: "Reunião", href: "/(tabs)/reuniao", icone: "calendar-outline", iconeAtivo: "calendar" },
  { chave: "conta", rotulo: "Conta", href: "/(tabs)/conta", icone: "person-circle-outline", iconeAtivo: "person-circle", tamanho: 28 },
];

/**
 * Qual rota está aberta, pelo nome do arquivo.
 *
 * A mesma leitura que o menu lateral faz. Divergir aqui faria a aba acender numa tela e o
 * menu marcar outra.
 */
export function chaveDaRotaAtual(segments: string[]): string {
  const grupo = segments[0] as string | undefined;
  if (grupo === "(tabs)") return (segments[1] as string | undefined) ?? "index";
  return grupo ?? "";
}

/** O índice da aba aberta, ou -1 fora das cinco (Território, Carrinho, Ajustes...). */
export function indiceDaAba(segments: string[]): number {
  const atual = chaveDaRotaAtual(segments);
  return ABAS.findIndex((a) => a.chave === atual);
}
