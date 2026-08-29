import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Celebracao } from "./Celebracao";

/**
 * Quem pode comemorar, e de onde.
 *
 * O provedor mora na RAIZ do app, e não na lista de tarefas, por duas razões: a comemoração
 * precisa cobrir a tela inteira (dentro da lista ela ficaria presa ao card), e o botão de
 * testar o efeito vive noutra tela. Uma fonte só, dois gatilhos.
 */

interface Celebrar {
  /** @param detalhe linha opcional sobre o que foi cumprido. */
  celebrar: (detalhe?: string | null) => void;
}

const ContextoCelebracao = createContext<Celebrar | null>(null);

export function ProvedorCelebracao({ children }: { children: ReactNode }) {
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [visivel, setVisivel] = useState(false);

  const celebrar = useCallback((texto?: string | null) => {
    setDetalhe(texto ?? null);
    setVisivel(true);
  }, []);

  const encerrar = useCallback(() => setVisivel(false), []);

  const valor = useMemo(() => ({ celebrar }), [celebrar]);

  return (
    <ContextoCelebracao.Provider value={valor}>
      {children}
      <Celebracao visivel={visivel} onFim={encerrar} detalhe={detalhe} />
    </ContextoCelebracao.Provider>
  );
}

/**
 * Fora do provedor devolve uma função que não faz nada, em vez de estourar: falhar em
 * comemorar não pode derrubar a tela que acabou de salvar a tarefa.
 */
export function useCelebracao(): Celebrar {
  return useContext(ContextoCelebracao) ?? { celebrar: () => {} };
}
