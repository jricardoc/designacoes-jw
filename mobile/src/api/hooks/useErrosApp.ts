import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { ErroApp } from "@/api/types";

/** Os erros que o app de cada um mandou, do mais recente (admin geral). */
export function useErrosApp() {
  return useQuery({
    queryKey: qk.errosApp,
    queryFn: () => apiRequest<{ erros: ErroApp[] }>("/erros-app"),
    select: (r) => r.erros,
  });
}

export function useLimparErrosApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<{ apagados: number }>("/erros-app", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.errosApp }),
  });
}
