import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { GrupoCampo } from "@/api/types";

/**
 * Os grupos de campo da congregação.
 *
 * Leitura livre — o cadastro de publicador precisa da lista para montar o seletor. Criar,
 * renomear e excluir é do admin geral (o backend exige, e a tela de Ajustes só oferece a ele).
 */
export function useGrupos() {
  return useQuery({
    queryKey: qk.grupos,
    queryFn: () => apiRequest<GrupoCampo[]>("/grupos"),
    // Mudam raramente: renomear um grupo é coisa de troca de designação.
    staleTime: 5 * 60_000,
  });
}

/** Invalida a lista de grupos E a de publicadores: o nome do grupo aparece nas duas. */
function useInvalidarGrupos() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.grupos });
    qc.invalidateQueries({ queryKey: qk.irmaos });
  };
}

export function useCriarGrupo() {
  const invalidar = useInvalidarGrupos();
  return useMutation({
    mutationFn: (nome: string) =>
      apiRequest<GrupoCampo>("/grupos", { method: "POST", body: { nome } }),
    onSuccess: invalidar,
  });
}

export function useAtualizarGrupo() {
  const invalidar = useInvalidarGrupos();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; nome?: string; ordem?: number; ativo?: boolean }) =>
      apiRequest<GrupoCampo>(`/grupos/${id}`, { method: "PUT", body }),
    onSuccess: invalidar,
  });
}

export function useExcluirGrupo() {
  const invalidar = useInvalidarGrupos();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest<{ success: boolean; publicadoresSemGrupo: number }>(`/grupos/${id}`, {
        method: "DELETE",
      }),
    onSuccess: invalidar,
  });
}
