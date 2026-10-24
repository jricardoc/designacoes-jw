import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { motion } from "@/theme";
import { useConfigPublica } from "@/api/hooks/useMisc";
import { AMBIENTES } from "@/components/layout/Ambientes";
import type { Icone } from "@/components/ministerio/kit";
import type { Ambiente } from "@/utils/ambiente";

const CURVA = Easing.bezier(...motion.curvaSuave);

/** O degradê e o desenho de cada ambiente, tirados da marca dele. O Servir Mais é o "S+". */
export const VISUAL: Record<Ambiente, { fundo: [string, string, string]; icone?: Icone }> = {
  servir: { fundo: ["#7C895F", "#5E6A46", "#404930"] },
  ministerio: { fundo: ["#1B9271", "#086A53", "#04402F"], icone: "leaf" },
  territorio: { fundo: ["#3381E6", "#1F5BB0", "#123A73"], icone: "map" },
  estudo: { fundo: ["#B5506E", "#7E2C45", "#4F1828"], icone: "book" },
};

/**
 * Splash animada da abertura, a do ambiente em que o app vai abrir — recria a tela de
 * splash do design: fundo no degradê do ambiente, a marca dele, anel/glow pulsando,
 * nome, tagline e dots. Toca uma vez na abertura e some chamando onDone.
 *
 * Com `fica`, já começa pronta e não sai: é o fundo do bloqueio por biometria, que põe os
 * botões dele (`children`) no lugar dos dots.
 */
export function SplashAnimated({
  ambiente,
  onDone,
  fica = false,
  children,
}: {
  ambiente: Ambiente;
  onDone?: () => void;
  fica?: boolean;
  children?: ReactNode;
}) {
  const { data: publica } = useConfigPublica();
  const { fundo, icone } = VISUAL[ambiente];
  const { nome, tag } = AMBIENTES.find((a) => a.chave === ambiente) ?? AMBIENTES[0];
  const fade = useSharedValue(1); // opacidade do container (fade-out no fim)
  const logo = useSharedValue(fica ? 1 : 0); // entrada do "S"
  const plus = useSharedValue(fica ? 1 : 0); // pop do "+"
  const ring = useSharedValue(0);
  const glow = useSharedValue(0);
  const d0 = useSharedValue(0);
  const d1 = useSharedValue(0);
  const d2 = useSharedValue(0);

  useEffect(() => {
    ring.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.cubic) }), -1, false);
    glow.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, true);
    if (fica) return;
    // Sem `Easing.back`: ele ultrapassa o tamanho final e volta, e o "+" com back(3)
    // dava um estalo bem mais forte que o resto da abertura do app.
    logo.value = withTiming(1, { duration: 620, easing: CURVA });
    plus.value = withDelay(180, withTiming(1, { duration: 520, easing: CURVA }));
    const bounce = (sv: typeof d0, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(withSequence(withTiming(1, { duration: 620 }), withTiming(0, { duration: 620 })), -1, false),
      );
    };
    bounce(d0, 0);
    bounce(d1, 160);
    bounce(d2, 320);

    const t = setTimeout(() => {
      fade.value = withTiming(0, { duration: 460, easing: Easing.in(Easing.ease) }, (fin) => {
        if (fin && onDone) runOnJS(onDone)();
      });
    }, 2450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [{ scale: 0.78 + logo.value * 0.22 }, { translateY: (1 - logo.value) * 14 }],
  }));
  const plusStyle = useAnimatedStyle(() => ({
    opacity: plus.value,
    transform: [{ scale: 0.1 + plus.value * 0.9 }, { rotate: `${(1 - plus.value) * -30}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value < 0.12 ? ring.value * 4.5 : Math.max(0, 0.55 * (1 - (ring.value - 0.12) / 0.88)),
    transform: [{ scale: 0.58 + ring.value * 1 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.32 + glow.value * 0.28,
    transform: [{ scale: 0.9 + glow.value * 0.25 }],
  }));
  const d0Style = useAnimatedStyle(() => ({ opacity: 0.28 + d0.value * 0.72, transform: [{ translateY: -4 * d0.value }] }));
  const d1Style = useAnimatedStyle(() => ({ opacity: 0.28 + d1.value * 0.72, transform: [{ translateY: -4 * d1.value }] }));
  const d2Style = useAnimatedStyle(() => ({ opacity: 0.28 + d2.value * 0.72, transform: [{ translateY: -4 * d2.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, containerStyle]}>
      <StatusBar style="light" />
      <LinearGradient
        colors={fundo}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.stage}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={[styles.ring, ringStyle]} />
        {icone ? (
          <Animated.View style={logoStyle}>
            <Ionicons name={icone} size={84} color={CREAM} style={styles.icone} />
          </Animated.View>
        ) : (
          <Animated.View style={[styles.markRow, logoStyle]}>
            <Text style={styles.s}>S</Text>
            <Animated.Text style={[styles.plus, plusStyle]}>+</Animated.Text>
          </Animated.View>
        )}
      </View>

      <Animated.Text entering={fica ? undefined : FadeInDown.delay(320).duration(520)} style={styles.word}>
        {nome}
      </Animated.Text>
      <Animated.Text entering={fica ? undefined : FadeIn.delay(520).duration(520)} style={styles.tag}>
        {tag}
      </Animated.Text>

      {fica ? (
        children
      ) : (
        <>
          <View style={styles.dots}>
            <Animated.View style={[styles.dotEl, d0Style]} />
            <Animated.View style={[styles.dotEl, d1Style]} />
            <Animated.View style={[styles.dotEl, d2Style]} />
          </View>

          {/* Só aparece se a resposta chegar a tempo: a splash não espera a rede. */}
          {publica?.congregacao ? (
            <Animated.Text entering={FadeIn.delay(950).duration(620)} style={styles.footer}>
              {publica.congregacao}
            </Animated.Text>
          ) : null}
        </>
      )}
    </Animated.View>
  );
}

export const CREAM = "#FBF7EF";

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", zIndex: 999 },
  stage: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -30,
  },
  glow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(251,247,239,0.16)",
  },
  ring: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: "rgba(251,247,239,0.6)",
  },
  markRow: { flexDirection: "row", alignItems: "flex-start" },
  s: {
    fontSize: 104,
    fontWeight: "800",
    letterSpacing: -4,
    color: CREAM,
    textShadowColor: "rgba(0,0,0,0.22)",
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 24,
    lineHeight: 112,
  },
  icone: { textShadowColor: "rgba(0,0,0,0.22)", textShadowOffset: { width: 0, height: 8 }, textShadowRadius: 24 },
  plus: {
    fontSize: 50,
    fontWeight: "800",
    color: CREAM,
    marginTop: 12,
    marginLeft: 1,
  },
  word: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: CREAM,
    marginTop: 14,
  },
  tag: { fontSize: 13.5, fontWeight: "500", color: CREAM, opacity: 0.72, marginTop: 9 },
  dots: { position: "absolute", bottom: 118, flexDirection: "row", gap: 9 },
  dotEl: { width: 8, height: 8, borderRadius: 999, backgroundColor: CREAM },
  footer: {
    position: "absolute",
    bottom: 64,
    fontSize: 12,
    letterSpacing: 0.5,
    color: "rgba(251,247,239,0.66)",
  },
});
