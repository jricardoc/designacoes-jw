import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { IrmaoDisponivel, MinhasDesignacoesResposta, Usuario } from "@/api/types";

/**
 * O irmão responde a própria parte de estudante: true "confirmo", false "não posso", null desfaz.
 * A resposta aparece na hora; se o servidor recusar, volta ao que era.
 */
export function useConfirmarParte() {
  const qc = useQueryClient();
  const lista = { queryKey: ["minhas-designacoes"] };
  return useMutation({
    mutationFn: (body: { id: string; confirmou: boolean | null }) =>
      apiRequest<{ confirmou: boolean | null }>("/minhas-designacoes/confirmacao", { method: "PUT", body }),
    onMutate: async ({ id, confirmou }) => {
      await qc.cancelQueries(lista);
      const antes = qc.getQueriesData<MinhasDesignacoesResposta>(lista);
      qc.setQueriesData<MinhasDesignacoesResposta>(lista, (r) =>
        r ? { ...r, compromissos: r.compromissos.map((c) => (c.id === id && c.confirmacao ? { ...c, confirmacao: { confirmou } } : c)) } : r,
      );
      return { antes };
    },
    onError: (_e, _v, ctx) => ctx?.antes.forEach(([chave, dados]) => qc.setQueryData(chave, dados)),
    onSettled: () => {
      qc.invalidateQueries(lista);
      qc.invalidateQueries({ queryKey: ["confirmacoes"] });
    },
  });
}

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
