import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Tema da interface — o mesmo do app mobile (mobile/src/theme/TemaContext.tsx).
 *
 * Só aparência: não toca em dado, rota nem permissão. O provider grava dois
 * atributos no <html> e o CSS em theme.css faz o resto — nenhum componente
 * precisa saber qual tema está ativo.
 *
 *   data-tema="claro|escuro"   data-daltonico="1|0"
 */

const KEY_TEMA = "ajustes_tema";
const KEY_DALTONICO = "ajustes_daltonico";

const TemaContext = createContext(null);

function temaValido(v) {
  return v === "claro" || v === "escuro" || v === "sistema";
}

/** Lê a preferência já na primeira renderização: evita a tela piscar clara. */
function lerInicial(chave, padrao, valida) {
  try {
    const v = localStorage.getItem(chave);
    return valida(v) ? v : padrao;
  } catch {
    return padrao;
  }
}

export function TemaProvider({ children }) {
  const [tema, setTemaState] = useState(() =>
    lerInicial(KEY_TEMA, "sistema", temaValido),
  );
  const [daltonico, setDaltonicoState] = useState(() =>
    lerInicial(KEY_DALTONICO, "0", (v) => v === "0" || v === "1") === "1",
  );

  // "sistema" acompanha a preferência do navegador/SO, e continua acompanhando
  // se ela mudar com a página aberta.
  const [sistemaEscuro, setSistemaEscuro] = useState(() => {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return undefined;
    }
    const aoMudar = (e) => setSistemaEscuro(e.matches);
    mq.addEventListener("change", aoMudar);
    return () => mq.removeEventListener("change", aoMudar);
  }, []);

  const esquema = tema === "sistema" ? (sistemaEscuro ? "escuro" : "claro") : tema;

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.setAttribute("data-tema", esquema);
    raiz.setAttribute("data-daltonico", daltonico ? "1" : "0");
  }, [esquema, daltonico]);

  const setTema = useCallback((t) => {
    setTemaState(t);
    try {
      localStorage.setItem(KEY_TEMA, t);
    } catch {
      /* preferência de aparência é recuperável */
    }
  }, []);

  const setDaltonico = useCallback((d) => {
    setDaltonicoState(d);
    try {
      localStorage.setItem(KEY_DALTONICO, d ? "1" : "0");
    } catch {
      /* idem */
    }
  }, []);

  const value = useMemo(
    () => ({ tema, esquema, daltonico, setTema, setDaltonico }),
    [tema, esquema, daltonico, setTema, setDaltonico],
  );

  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>;
}

export function useTema() {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error("useTema precisa estar dentro de <TemaProvider>");
  return ctx;
}
