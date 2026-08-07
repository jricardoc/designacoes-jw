export const qk = {
  quadros: ["quadros"] as const,
  quadro: (id: number | string) => ["quadros", String(id)] as const,
  historico: (quadroId: number | string) =>
    ["historico", String(quadroId)] as const,
  estatisticas: ["estatisticas"] as const,
  irmaos: ["irmaos"] as const,
  indisponibilidadesIrmao: (irmaoId: number | string) =>
    ["indisponibilidades", String(irmaoId)] as const,
  saidasCampo: ["saidas-campo"] as const,
  dirigenteDisponibilidade: (irmaoId: number | string) =>
    ["dirigente-disponibilidade", String(irmaoId)] as const,
  dirigentesQuadros: ["dirigentes-quadros"] as const,
  dirigentesQuadro: (id: number | string) =>
    ["dirigentes-quadros", String(id)] as const,
  reunioes: ["reunioes"] as const,
  compartilhamentosSemana: (semanaId: number | string) =>
    ["compartilhamentos-semana", String(semanaId)] as const,
  usuarios: ["usuarios"] as const,
  catalogoEscopos: ["catalogo-escopos"] as const,
  irmaosDisponiveis: (usuarioId?: number | null) =>
    ["irmaos-disponiveis", String(usuarioId ?? "todos")] as const,
  minhasDesignacoes: (escopo: string) => ["minhas-designacoes", escopo] as const,
  config: ["config"] as const,
  preferenciasNotificacao: ["preferencias-notificacao"] as const,
  // Por usuário: dois logins no mesmo aparelho não podem compartilhar cache.
  notificacoesRemotas: (usuarioId: number | string) =>
    ["notificacoes-remotas", String(usuarioId)] as const,
  carrinho: ["carrinho"] as const,
};
