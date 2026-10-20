import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Uma requisicao por carga da pagina, compartilhada por todos os componentes.
let pedido = null;

/**
 * O nome da congregacao como o admin gravou em Ajustes ("Congregação Vila Nova"), vindo de
 * GET /config/publica — publica porque a tela de login tambem mostra. Vazio ate chegar.
 */
export function useCongregacao() {
  const [nome, setNome] = useState("");
  useEffect(() => {
    pedido ??= fetch(`${API_URL}/config/publica`)
      .then((r) => r.json())
      .then((d) => d.congregacao || "")
      .catch(() => "");
    pedido.then(setNome);
  }, []);
  return nome;
}

/** "Congregação Vila Nova" -> "Vila Nova", para onde o rotulo "Congregação" ja aparece. */
export const semPrefixo = (nome) => nome.replace(/^congrega[çc][ãa]o\s+/i, "");
