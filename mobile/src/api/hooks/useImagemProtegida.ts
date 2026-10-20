import { useEffect, useState } from "react";
import { tokenStore } from "@/api/tokenStore";
import { API_URL } from "@/config/env";

/**
 * Monta o `source` de <Image> para as imagens protegidas (cartões de território, fotos de
 * perfil): URL absoluta + Bearer. Devolve null enquanto o token não foi lido do
 * SecureStore (a leitura é assíncrona) — nesse instante a imagem não renderiza,
 * em vez de disparar uma requisição que voltaria 401.
 */
export function useImagemProtegida() {
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
