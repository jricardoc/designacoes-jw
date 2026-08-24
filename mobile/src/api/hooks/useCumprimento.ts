import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { Designacao, EscalaDirigente, RegistroCumprimento } from "@/api/types";

/**
 * Todas as avaliações de cumprimento (designações + dirigentes), achatadas e
 * já com a data completa. A tela de análise agrega/filtra localmente.
 *
 * `enabled` porque o endpoint exige escopo de designações OU dirigentes — quem
 * não tem não deve nem disparar a consulta (voltaria 403).
 */
export function useCumprimento(enabled = true) {
  return useQuery({
    queryKey: qk.cumprimento,
    queryFn: () =>
      apiRequest<{ registros: RegistroCumprimento[] }>("/cumprimento"),
    enabled,
  });
}

/**
 * Marca (ou desmarca, com null) o cumprimento de um irmão numa designação.
 * A tela faz o update otimista do quadro; aqui só se invalida a análise.
 */
export function useMarcarCumprimentoDesignacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      designacaoId: number;
      campo: "irmao1" | "irmao2";
      cumpriu: boolean | null;
    }) =>
      apiRequest<Designacao>("/quadros/designacao/cumprimento", {
        method: "PUT",
        body: payload,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.cumprimento }),
  });
}

/** Marca (ou desmarca) o cumprimento do dirigente de uma saída. */
export function useMarcarCumprimentoEscala() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { escalaId: number; cumpriu: boolean | null }) =>
      apiRequest<EscalaDirigente>("/dirigentes/escala/cumprimento", {
        method: "PUT",
        body: payload,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.cumprimento }),
  });
}
