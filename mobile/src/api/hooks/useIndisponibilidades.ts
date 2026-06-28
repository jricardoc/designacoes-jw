import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { Indisponibilidade } from "@/api/types";

export function useIndisponibilidadesIrmao(irmaoId: number | undefined) {
  return useQuery({
    queryKey: qk.indisponibilidadesIrmao(irmaoId ?? 0),
    queryFn: () =>
      apiRequest<Indisponibilidade[]>(`/indisponibilidades/irmao/${irmaoId}`),
    enabled: !!irmaoId,
  });
}

export function useCriarIndisponibilidade(irmaoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { data: string; motivo?: string }) =>
      apiRequest<Indisponibilidade>("/indisponibilidades", {
        method: "POST",
        body: { irmaoId, ...payload },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.indisponibilidadesIrmao(irmaoId) });
      qc.invalidateQueries({ queryKey: qk.irmaos });
    },
  });
}

export function useExcluirIndisponibilidade(irmaoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/indisponibilidades/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.indisponibilidadesIrmao(irmaoId) });
      qc.invalidateQueries({ queryKey: qk.irmaos });
    },
  });
}
