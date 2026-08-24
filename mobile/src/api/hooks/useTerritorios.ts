import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import { tokenStore } from "@/api/tokenStore";
import type { Territorio } from "@/api/types";
import { API_URL } from "@/config/env";

export function useTerritorios() {
  return useQuery({
    queryKey: qk.territorios,
    queryFn: () => apiRequest<{ territorios: Territorio[] }>("/territorios"),
    // Os cartões só mudam com re-extração + deploy; não precisa reconsultar a
    // cada abertura da tela.
    staleTime: 30 * 60_000,
  });
}

/**
 * Monta o `source` de <Image> para as imagens protegidas dos cartões: URL
 * absoluta + Bearer. Devolve null enquanto o token não foi lido do
 * SecureStore (a leitura é assíncrona) — nesse instante a imagem não renderiza,
 * em vez de disparar uma requisição que voltaria 401.
 */
export function useImagemTerritorio() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    tokenStore
      .get()
      .then((t) => {
        if (ativo) setToken(t);
      })
      .catch(() => {
        if (ativo) setToken(null);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return (caminho: string) =>
    token
      ? {
          uri: `${API_URL}${caminho}`,
          headers: { Authorization: `Bearer ${token}` },
        }
      : null;
}
