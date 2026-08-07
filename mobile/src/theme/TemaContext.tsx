import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import {
  paletaDe,
  statusConfigDe,
  type Cores,
  type Esquema,
  type StatusVisual,
} from "@/theme";

/**
 * Tema escolhido em Ajustes. "sistema" segue o claro/escuro do aparelho —
 * precisa do `userInterfaceStyle: "automatic"` no app.json, que só passa a
 * valer num build nativo novo; até lá o sistema reporta sempre claro.
 */
export type TemaPreferido = "claro" | "escuro" | "sistema";

const KEY_TEMA = "ajustes_tema";
const KEY_DALTONICO = "ajustes_daltonico";

export interface Tema {
  colors: Cores;
  statusConfig: Record<string, StatusVisual>;
  /** O que está de fato na tela, depois de resolver "sistema". */
  esquema: Esquema;
  tema: TemaPreferido;
  daltonico: boolean;
  setTema: (t: TemaPreferido) => void;
  setDaltonico: (d: boolean) => void;
}

const TemaCtx = createContext<Tema | null>(null);

function temaValido(v: unknown): v is TemaPreferido {
  return v === "claro" || v === "escuro" || v === "sistema";
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<TemaPreferido>("sistema");
  const [daltonico, setDaltonicoState] = useState(false);
  // Sem esta espera a primeira pintura sairia sempre clara e piscaria para o
  // escuro logo depois. A splash animada cobre a tela nesse meio tempo.
  const [carregado, setCarregado] = useState(false);
  const sistemaEscuro = useColorScheme() === "dark";

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [t, d] = await AsyncStorage.multiGet([KEY_TEMA, KEY_DALTONICO]);
        if (!ativo) return;
        if (temaValido(t[1])) setTemaState(t[1]);
        setDaltonicoState(d[1] === "1");
      } catch {
        // fica no padrão — preferências de aparência são recuperáveis
      } finally {
        if (ativo) setCarregado(true);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const setTema = useCallback((t: TemaPreferido) => {
    setTemaState(t);
    AsyncStorage.setItem(KEY_TEMA, t).catch(() => {});
  }, []);

  const setDaltonico = useCallback((d: boolean) => {
    setDaltonicoState(d);
    AsyncStorage.setItem(KEY_DALTONICO, d ? "1" : "0").catch(() => {});
  }, []);

  const esquema: Esquema =
    tema === "sistema" ? (sistemaEscuro ? "escuro" : "claro") : tema;

  const value = useMemo<Tema>(
    () => ({
      colors: paletaDe(esquema, daltonico),
      statusConfig: statusConfigDe(esquema, daltonico),
      esquema,
      tema,
      daltonico,
      setTema,
      setDaltonico,
    }),
    [esquema, tema, daltonico, setTema, setDaltonico],
  );

  if (!carregado) return null;

  return <TemaCtx.Provider value={value}>{children}</TemaCtx.Provider>;
}

/**
 * O tema atual — e, com uma fábrica de estilos, os estilos já na paleta certa.
 *
 *   const criarEstilos = (colors: Cores) => StyleSheet.create({ ... });
 *   const { colors, styles } = useTema(criarEstilos);
 *
 * A fábrica deve ser uma const de módulo: a memoização usa a identidade dela.
 */
export function useTema(): Tema;
export function useTema<T>(criarEstilos: (c: Cores) => T): Tema & { styles: T };
export function useTema<T>(criarEstilos?: (c: Cores) => T) {
  const tema = useContext(TemaCtx);
  if (!tema) {
    throw new Error("useTema precisa estar dentro de <TemaProvider>");
  }
  const styles = useMemo(
    () => (criarEstilos ? criarEstilos(tema.colors) : null),
    [criarEstilos, tema.colors],
  );
  return useMemo(
    () => (criarEstilos ? { ...tema, styles } : tema),
    [criarEstilos, tema, styles],
  );
}
