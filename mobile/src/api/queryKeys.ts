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
  grupos: ["grupos"] as const,
  reunioes: ["reunioes"] as const,
  // Com o recorte no nome: a lista "so as proximas" e a "com as passadas" sao consultas
  // diferentes, e uma nao pode servir cache para a outra.
  confirmacoes: (passadas: boolean) => ["confirmacoes", passadas] as const,
  assistencias: ["assistencias"] as const,
  cumprimento: ["cumprimento"] as const,
  territorios: ["territorios"] as const,
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
  // As tarefas do próprio irmão. Sem o id do usuário na chave porque o logout limpa o
  // cache inteiro (ver AuthContext) — igual a `minhasDesignacoes`.
  tarefas: ["tarefas"] as const,
  catalogoTarefas: ["catalogo-tarefas"] as const,
  tarefasUsuario: (usuarioId: number | string) =>
    ["tarefas-usuario", String(usuarioId)] as const,
  // A janela entra na chave: 30 e 90 dias são consultas diferentes, e uma não pode
  // servir de cache para a outra.
  painelTarefas: (janelaDias: number) => ["painel-tarefas", janelaDias] as const,
};
