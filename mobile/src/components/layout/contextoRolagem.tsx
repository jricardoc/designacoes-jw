import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { espacoDoConteudo } from "./geometriaBarra";

/**
 * O elo entre a rolagem das telas e a barra flutuante.
 *
 * A barra encolhe quando o irmão rola para baixo e volta ao tamanho ao subir. Quem rola é a
 * tela; quem encolhe é a barra — e as duas não se conhecem. Este contexto carrega o valor
 * animado de uma para a outra.
 *
 * O valor é um `SharedValue` do Reanimated, e não um `Animated.Value` do React Native: o
 * resto do app (folhas, menu lateral) já anima por Reanimated, e misturar os dois sistemas na
 * mesma tela custa um segundo runtime de animação sem ganhar nada.
 */

interface Rolagem {
  /** 0 = barra inteira, 1 = encolhida. */
  compacta: SharedValue<number>;
  aoRolar: (evento: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const ContextoRolagem = createContext<Rolagem | null>(null);

/** Quanto o dedo precisa andar para a barra reagir. Abaixo disso é tremor, não intenção. */
const LIMIAR = 6;

/** Perto do topo a barra volta inteira, role-se para onde for. */
const ZONA_DO_TOPO = 12;

/** Quanto tempo leva para encolher ou voltar. */
const DURACAO = 180;

export function ProvedorRolagem({ children }: { children: ReactNode }) {
  const compacta = useSharedValue(0);
  const ultimoY = useRef(0);
  /** O estado JÁ pedido, para não reanimar a cada quadro de uma rolagem contínua. */
  const alvo = useRef<0 | 1>(0);

  const irPara = useCallback(
    (destino: 0 | 1) => {
      if (alvo.current === destino) return;
      alvo.current = destino;
      compacta.value = withTiming(destino, { duration: DURACAO });
    },
    [compacta],
  );

  const aoRolar = useCallback(
    (evento: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = evento.nativeEvent.contentOffset.y;
      const delta = y - ultimoY.current;
      ultimoY.current = y;

      if (y < ZONA_DO_TOPO) {
        irPara(0);
        return;
      }
      if (delta > LIMIAR) irPara(1);
      else if (delta < -LIMIAR) irPara(0);
    },
    [irPara],
  );

  const valor = useMemo(() => ({ compacta, aoRolar }), [compacta, aoRolar]);
  return <ContextoRolagem.Provider value={valor}>{children}</ContextoRolagem.Provider>;
}

/**
 * O valor que a barra lê. Fora do provedor devolve um valor parado em 0 — assim a barra
 * renderiza igual mesmo se alguém a montar sozinha (num teste, por exemplo).
 */
export function useBarraCompacta(): SharedValue<number> {
  const ctx = useContext(ContextoRolagem);
  const parado = useSharedValue(0);
  return ctx?.compacta ?? parado;
}

/**
 * O que toda tela de (tabs) precisa por causa da barra flutuante.
 *
 * CHAME NO TOPO DO COMPONENTE:
 *
 *     const { rolagem, recuo } = useBarraFlutuante();
 *     ...
 *     <ScrollView {...rolagem} contentContainerStyle={[styles.scroll, recuo]} />
 *
 * E nunca espalhando a chamada dentro do JSX. Quase toda tela desenha o ScrollView dentro de
 * um condicional (carregando / vazio / lista), e ali a chamada seria um hook condicional: a
 * ordem dos hooks mudaria na primeira troca de estado.
 *
 * `rolagem` SOBRESCREVE um `onScroll` próprio — nenhuma tela de (tabs) tem um hoje, mas quem
 * for adicionar precisa compor os dois à mão em vez de espalhar por cima.
 *
 * `recuo` é o espaço no fim da rolagem. Ele soma a área segura porque o container de (tabs)
 * deixou de reservá-la: era esse recuo no container que pintava uma faixa de fundo no fim de
 * toda tela e impedia o conteúdo de chegar à borda.
 */
export function useBarraFlutuante() {
  const ctx = useContext(ContextoRolagem);
  const insets = useSafeAreaInsets();

  return {
    rolagem: { onScroll: ctx?.aoRolar, scrollEventThrottle: 16 },
    recuo: { paddingBottom: espacoDoConteudo(insets.bottom) },
  };
}
