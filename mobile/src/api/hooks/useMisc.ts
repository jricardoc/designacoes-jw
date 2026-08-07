import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type {
  Config,
  EscopoAdmin,
  EstatisticasGlobais,
  Historico,
  OpcaoEscopo,
  Reuniao,
  Usuario,
} from "@/api/types";

export function useEstatisticas() {
  return useQuery({
    queryKey: qk.estatisticas,
    queryFn: () => apiRequest<EstatisticasGlobais>("/estatisticas"),
  });
}

export function useHistoricoQuadro(quadroId: string | number) {
  return useQuery({
    queryKey: qk.historico(quadroId),
    queryFn: () => apiRequest<Historico[]>(`/historico/quadro/${quadroId}`),
    enabled: String(quadroId).length > 0,
  });
}

export function useReunioes() {
  return useQuery({
    queryKey: qk.reunioes,
    queryFn: () => apiRequest<Reuniao[]>("/reunioes"),
  });
}

export function useAtualizarSemana() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      semanaId: number;
      campo: string;
      valor: string;
    }) =>
      apiRequest(`/reunioes/semanas/${payload.semanaId}`, {
        method: "PUT",
        body: { campo: payload.campo, valor: payload.valor },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.reunioes }),
  });
}

// ===== Usuários (admin) =====
export function useUsuarios(enabled: boolean) {
  return useQuery({
    queryKey: qk.usuarios,
    queryFn: () => apiRequest<Usuario[]>("/usuarios"),
    enabled,
  });
}

export function useCriarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { nome: string; nickname: string; irmaoId?: number | null }) =>
      apiRequest<Usuario>("/usuarios", { method: "POST", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.usuarios }),
  });
}

export function useToggleAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/usuarios/${id}/admin`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.usuarios }),
  });
}

/**
 * Define as áreas que o usuário administra. Substitui a lista inteira — a tela
 * manda o estado final das caixas marcadas.
 */
export function useAtualizarEscopos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, escopos }: { id: number; escopos: EscopoAdmin[] }) =>
      apiRequest(`/usuarios/${id}/escopos`, { method: "PUT", body: { escopos } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.usuarios }),
  });
}

/**
 * O catálogo de áreas vem do backend, não de uma lista aqui: uma área nova
 * aparece no app sem precisar de build.
 */
export function useCatalogoEscopos(enabled = true) {
  return useQuery({
    queryKey: qk.catalogoEscopos,
    queryFn: () =>
      apiRequest<{ escopos: OpcaoEscopo[] }>("/usuarios/escopos/catalogo"),
    enabled,
    staleTime: 30 * 60_000,
  });
}

export function useResetSenhaUsuario() {
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/usuarios/${id}/reset-senha`, { method: "PUT" }),
  });
}

export function useExcluirUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/usuarios/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.usuarios }),
  });
}

// ===== Conta (self) =====
export function useAlterarNome() {
  return useMutation({
    mutationFn: (nome: string) =>
      apiRequest<Usuario>("/auth/nome", { method: "PUT", body: { nome } }),
  });
}

export function useAlterarNickname() {
  return useMutation({
    mutationFn: (nickname: string) =>
      apiRequest<Usuario>("/usuarios/nickname", {
        method: "PUT",
        body: { nickname },
      }),
  });
}

export function useAlterarSenha() {
  return useMutation({
    mutationFn: (payload: { senhaAtual: string; novaSenha: string }) =>
      apiRequest("/auth/senha", { method: "PUT", body: payload }),
  });
}

export function useResetDatabase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest("/config/reset", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ===== Configuração da congregação =====
export function useConfig() {
  return useQuery({
    queryKey: qk.config,
    queryFn: () => apiRequest<Config>("/config"),
  });
}

export function useAtualizarConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: Partial<
        Pick<
          Config,
          "titulo" | "subtitulo" | "mes" | "horaMeioSemana" | "horaFimDeSemana"
        >
      >,
    ) => apiRequest("/config", { method: "PUT", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.config });
      // O horário da reunião é o que traduz "3 horas antes" em hora do relógio: mudou aqui,
      // a tela de notificações precisa reler para não mostrar a conta antiga.
      qc.invalidateQueries({ queryKey: qk.preferenciasNotificacao });
    },
  });
}
