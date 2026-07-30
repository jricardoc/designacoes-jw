import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";

/**
 * Registra o Expo Push Token do aparelho para o usuário logado.
 * Exportada solta porque também é chamada fora de componente (no hook de push).
 */
export function registrarPushToken(token: string, platform?: string) {
  return apiRequest<{ ok: boolean }>("/push/token", {
    method: "POST",
    body: { token, platform },
  });
}

/** Remove o token do backend. Chamada no logout, fora de componente. */
export function removerPushToken(token: string) {
  return apiRequest("/push/token", {
    method: "DELETE",
    body: { token },
  });
}

// Sem invalidação de cache: não existe query de push tokens.
export function useRegistrarPushToken() {
  return useMutation({
    mutationFn: (payload: { token: string; platform?: string }) =>
      registrarPushToken(payload.token, payload.platform),
  });
}

export function useRemoverPushToken() {
  return useMutation({
    mutationFn: (token: string) => removerPushToken(token),
  });
}
