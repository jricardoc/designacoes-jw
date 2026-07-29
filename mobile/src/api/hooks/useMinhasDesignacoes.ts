import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { IrmaoDisponivel, MinhasDesignacoesResposta, Usuario } from "@/api/types";

export function useMinhasDesignacoes(escopo: "proximas" | "todas") {
  return useQuery({
    queryKey: qk.minhasDesignacoes(escopo),
    queryFn: () =>
      apiRequest<MinhasDesignacoesResposta>(`/minhas-designacoes?escopo=${escopo}`),
  });
}

/** Irmãos que ainda não têm conta (mais o já vinculado ao usuário informado). */
export function useIrmaosDisponiveis(usuarioId?: number | null, enabled = true) {
  return useQuery({
    queryKey: qk.irmaosDisponiveis(usuarioId),
    queryFn: () =>
      apiRequest<IrmaoDisponivel[]>(
        `/usuarios/irmaos-disponiveis${usuarioId ? `?usuarioId=${usuarioId}` : ""}`,
      ),
    enabled,
  });
}

export function useVincularIrmao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioId, irmaoId }: { usuarioId: number; irmaoId: number | null }) =>
      apiRequest<Usuario>(`/usuarios/${usuarioId}/irmao`, {
        method: "PUT",
        body: { irmaoId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.usuarios });
      qc.invalidateQueries({ queryKey: ["irmaos-disponiveis"] });
      qc.invalidateQueries({ queryKey: ["minhas-designacoes"] });
    },
  });
}
