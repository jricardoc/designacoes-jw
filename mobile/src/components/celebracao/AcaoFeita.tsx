import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { motion, radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * O "feito!" das ações do dia a dia: marcar um pino, registrar a saída, reconfirmar uma casa.
 *
 * É o primo pequeno da comemoração: o confete fica para o que fecha um ciclo (tarefa cumprida,
 * território concluído); aqui é só o retorno de que a ação pegou. Um círculo na cor do que foi
 * feito aparece com o ícone, uma onda sai dele, e tudo some sozinho em pouco mais de um
 * segundo, sem bloquear o toque.
 *
 * Só curvas que desaceleram, nunca mola: nada passa do ponto e volta.
 */

export interface Feito {
  titulo: string;
  detalhe?: string | null;
  /** Ícone dentro do círculo. Sem ele, um check. */
  icone?: keyof typeof Ionicons.glyphMap;
  /** Cor do círculo. Sem ela, a primária. */
  cor?: string;
}

/** O disparo carrega um id: duas ações iguais seguidas recomeçam a animação. */
export type FeitoDisparado = Feito & { id: number };

const DESACELERA = Easing.out(Easing.cubic);
/** Quanto fica parado na tela depois de entrar. */
const NA_TELA = 1100;

export function AcaoFeita({ feito, onFim }: { feito: FeitoDisparado | null; onFim: () => void }) {
  const { colors, styles } = useTema(criarEstilos);
  const reduzir = useReducedMotion();
  const opacidade = useSharedValue(0);
  const escala = useSharedValue(1);
  const circulo = useSharedValue(1);
  const onda = useSharedValue(1);

  useEffect(() => {
    if (!feito) return;
    AccessibilityInfo.announceForAccessibility(feito.titulo);
    // A camada mora na raiz, por baixo de qualquer Modal. Espera a folha de onde a ação
    // costuma vir terminar de sair, senão a primeira parte acontece escondida atrás dela.
    const atraso = motion.fundo;
    opacidade.value = 0;
    opacidade.value = withDelay(
      atraso,
      withSequence(
        withTiming(1, { duration: 180, easing: DESACELERA }),
        withDelay(
          NA_TELA,
          withTiming(0, { duration: motion.saida }, (terminou) => {
            if (terminou) runOnJS(onFim)();
          }),
        ),
      ),
    );
    if (reduzir) return;
    escala.value = 0.92;
    escala.value = withDelay(atraso, withTiming(1, { duration: 260, easing: DESACELERA }));
    circulo.value = 0.5;
    circulo.value = withDelay(atraso + 60, withTiming(1, { duration: 320, easing: DESACELERA }));
    onda.value = 0;
    onda.value = withDelay(atraso + 220, withTiming(1, { duration: 750, easing: DESACELERA }));
    // Só o id dispara: o resto do objeto vem junto com ele.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feito?.id]);

  const estiloCartao = useAnimatedStyle(() => ({ opacity: opacidade.value, transform: [{ scale: escala.value }] }));
  const estiloCirculo = useAnimatedStyle(() => ({ transform: [{ scale: circulo.value }] }));
  const estiloOnda = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - onda.value),
    transform: [{ scale: 1 + onda.value * 0.8 }],
  }));

  if (!feito) return null;
  const cor = feito.cor ?? colors.primary;

  return (
    <View style={styles.camada} pointerEvents="none">
      <Animated.View style={[styles.cartao, estiloCartao]}>
        <View style={styles.marca}>
          <Animated.View style={[styles.onda, { borderColor: cor }, estiloOnda]} />
          <Animated.View style={[styles.circulo, { backgroundColor: cor }, estiloCirculo]}>
            <Ionicons name={feito.icone ?? "checkmark"} size={30} color="#fff" />
          </Animated.View>
        </View>
        <Text style={styles.titulo}>{feito.titulo}</Text>
        {feito.detalhe ? <Text style={styles.detalhe}>{feito.detalhe}</Text> : null}
      </Animated.View>
    </View>
  );
}

const TAMANHO = 64;

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    camada: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 50,
      elevation: 50,
    },
    cartao: {
      minWidth: 200,
      maxWidth: 280,
      alignItems: "center",
      gap: 10,
      paddingVertical: 22,
      paddingHorizontal: 24,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      ...shadow.raised,
    },
    marca: { width: TAMANHO, height: TAMANHO, alignItems: "center", justifyContent: "center", marginBottom: 2 },
    onda: {
      position: "absolute",
      width: TAMANHO,
      height: TAMANHO,
      borderRadius: TAMANHO / 2,
      borderWidth: 3,
    },
    circulo: {
      width: TAMANHO,
      height: TAMANHO,
      borderRadius: TAMANHO / 2,
      alignItems: "center",
      justifyContent: "center",
    },
    titulo: { fontSize: 17, fontWeight: "800", color: colors.text, textAlign: "center" },
    detalhe: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: -4 },
  });
