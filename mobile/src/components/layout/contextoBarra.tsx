import { createContext, useContext } from "react";

/**
 * Avisa às telas que a barra global (AppHeader) já está desenhada acima delas.
 * Sem isso o GradientHeader some do topo com o safe area de novo e o título da
 * página desce um bloco inteiro abaixo do sanduíche.
 */
const ContextoBarraGlobal = createContext(false);

export const BarraGlobalProvider = ContextoBarraGlobal.Provider;

export function useTemBarraGlobal() {
  return useContext(ContextoBarraGlobal);
}
