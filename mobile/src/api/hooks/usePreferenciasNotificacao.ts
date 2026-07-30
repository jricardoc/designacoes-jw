import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { PreferenciaNotificacao } from "@/api/types";

/** O que o irmão quer receber e com quanta antecedência. Sempre do usuário logado. */
export function usePreferenciasNotificacao() {
  return useQuery({
    queryKey: qk.preferenciasNotificacao,
    queryFn: () => apiRequest<PreferenciaNotificacao>("/push/preferencias"),
  });
}

export function useSalvarPreferenciasNotificacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { tipos: string[]; antecedencias: string[] }) =>
      apiRequest<{ tipos: string[]; antecedencias: string[] }>(
        "/push/preferencias",
        { method: "PUT", body: payload },
      ),
    // O servidor devolve o que gravou (com os ids desconhecidos já descartados). Escrever
    // isso no cache evita a tela ficar mostrando uma opção que o backend recusou.
    onSuccess: (salvo) => {
      qc.setQueryData<PreferenciaNotificacao>(qk.preferenciasNotificacao, (old) =>
        old ? { ...old, ...salvo } : old,
      );
    },
  });
}
