import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useNotificacoes } from "@/notifications/historicoNotificacoes";
import { motion, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

const CURVA = Easing.bezier(...motion.curvaSuave);

/** Pausa entre um balanço e o próximo — é ela que deixa o aviso discreto. */
const PAUSA = 3200;

interface SinoNotificacoesProps {
  onPress: () => void;
}

/**
 * Sino da barra global. Com notificação não lida ganha um pontinho vermelho e um
 * balanço curto que se repete de longe em longe; sem nada por ler, fica parado.
 */
export function SinoNotificacoes({ onPress }: SinoNotificacoesProps) {
  const { colors, styles } = useTema(criarEstilos);
  const { naoLidas } = useNotificacoes();
  const temNaoLida = naoLidas > 0;
  const giro = useSharedValue(0);

  useEffect(() => {
    if (!temNaoLida) {
      // Sem worklet rodando à toa: cancela o loop e volta ao repouso.
      cancelAnimation(giro);
      giro.value = withTiming(0, { duration: motion.saida, easing: CURVA });
      return;
    }

    giro.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 90, easing: CURVA }),
        withTiming(7, { duration: 150, easing: CURVA }),
        withTiming(-5, { duration: 140, easing: CURVA }),
        withTiming(4, { duration: 130, easing: CURVA }),
        withTiming(0, { duration: 110, easing: CURVA }),
        // O descanso vai dentro da sequência: repetir sem pausa viraria uma
        // tremedeira contínua, e o usuário pediu vibração bem leve.
        withDelay(PAUSA, withTiming(0, { duration: 0 })),
      ),
      -1,
    );

    return () => {
      cancelAnimation(giro);
    };
  }, [temNaoLida, giro]);

  const estiloSino = useAnimatedStyle(() => ({
    transform: [{ rotate: `${giro.value}deg` }],
  }));

  return (
    <Pressable
      hitSlop={10}
      onPress={onPress}
      style={styles.botao}
      accessibilityRole="button"
      accessibilityLabel={
        temNaoLida
          ? `Notificações, ${naoLidas} não lida(s)`
          : "Notificações"
      }
    >
      <Animated.View style={estiloSino}>
        <Ionicons name="notifications-outline" size={22} color={colors.text} />
      </Animated.View>
      {temNaoLida ? <View style={styles.ponto} /> : null}
    </Pressable>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    botao: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    ponto: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 9,
      height: 9,
      borderRadius: radius.pill,
      // Vermelho de propósito: o verde se misturava com o resto da marca e o
      // aviso passava batido.
      backgroundColor: colors.red,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
  });
