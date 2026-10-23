import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/** Trocas de vista (lista de áreas, cartão do mapa) só aparecem e somem: nada desliza nem quica. */
export const APARECE = FadeIn.duration(220);
export const SOME = FadeOut.duration(160);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Card que afunda um pouco sob o dedo: o retorno de que o toque pegou, antes de a tela mudar. */
export function Pressionavel({ style, ...props }: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> }) {
  const escala = useSharedValue(1);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={() => {
        escala.value = withTiming(0.98, { duration: 90 });
      }}
      onPressOut={() => {
        escala.value = withTiming(1, { duration: 140 });
      }}
      style={[style, animado]}
    />
  );
}

/** Barra de concluídos. Parada: numa lista que rola, encher a cada card que entra virava movimento sem fim. */
export function Progresso({ fracao, cor }: { fracao: number; cor?: string }) {
  const { styles } = useTema(criarEstilos);
  return (
    <View style={styles.progresso}>
      <View style={[styles.progressoCheio, { width: `${fracao * 100}%` }, cor ? { backgroundColor: cor } : null]} />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    progresso: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: "hidden", marginTop: 6 },
    progressoCheio: { height: 6, borderRadius: 3, backgroundColor: colors.greenDark },
  });
