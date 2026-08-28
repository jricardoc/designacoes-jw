import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { ConfirmacoesResposta } from "@/api/types";

/**
 * As partes de estudante que precisam de confirmação, agrupadas por reunião.
 *
 * `staleTime` curto de propósito: o `texto` e o link de WhatsApp já vêm montados do backend
 * com a saudação da HORA. Guardar isso por muito tempo faria a tela oferecer "Bom dia" numa
 * mensagem enviada à tarde — então a lista revalida ao voltar para a tela.
 */
export function useConfirmacoes(habilitado = true, incluirPassadas = false) {
  return useQuery({
    queryKey: qk.confirmacoes(incluirPassadas),
    queryFn: () =>
      apiRequest<ConfirmacoesResposta>(
        `/confirmacoes${incluirPassadas ? "?passadas=1" : ""}`,
      ),
    enabled: habilitado,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export interface RegistroConfirmacao {
  data: string;
  campo: string;
  nome: string;
  /** true = vai cumprir, false = não vai, null = volta a "sem resposta". */
  confirmou: boolean | null;
}

export function useRegistrarConfirmacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (registro: RegistroConfirmacao) =>
      apiRequest("/confirmacoes", { method: "PUT", body: registro }),
    // Invalida as duas listas (com e sem passadas): a mesma parte aparece nas duas quando a
    // reunião é de hoje.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["confirmacoes"] }),
  });
}
