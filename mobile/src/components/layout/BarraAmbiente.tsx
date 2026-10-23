import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router, useSegments, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EASE, entrada, LEVE, type Icone } from "@/components/ministerio/kit";
import { useAlturaTeclado } from "@/components/ui/useAlturaTeclado";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

export interface AbaAmbiente {
  /** O segmento da rota dentro do ambiente ("index" é a primeira). */
  chave: string;
  rotulo: string;
  icone: Icone;
  iconeAtivo: Icone;
  href: Href;
}

export interface AtalhoAmbiente {
  chave: string;
  rotulo: string;
  icone: Icone;
  onPress: () => void;
}

/** O vidro da barra, que cada ambiente tinge do seu jeito. */
export interface VidroBarra {
  vidro: string;
  vidroBorda: string;
  tint: "light" | "dark";
}

const ALTURA = 66;
/** O vão do meio, onde o "+" se apoia. */
const VAO = 78;
const MAIS = 62;

/**
 * A barra dos ambientes (Ministério, Território): as abas num vidro flutuante e, com atalhos,
 * o "+" no meio, que os abre subindo em leque. Some nas telas empilhadas e com o teclado aberto.
 */
export function BarraAmbiente({
  abas,
  atalhos,
  vidro,
  rotuloMais,
}: {
  abas: AbaAmbiente[];
  /** Vazio: a barra fica sem o "+". */
  atalhos: AtalhoAmbiente[];
  vidro: VidroBarra;
  rotuloMais: string;
}) {
  const { colors, esquema, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const teclado = useAlturaTeclado() > 0;
  const segments = useSegments() as string[];
  const atual = segments[1] ?? "index";
  const indice = abas.findIndex((a) => a.chave === atual);
  const visivel = indice >= 0 && !teclado;
  const [largura, setLargura] = useState(0);
  const [aberto, setAberto] = useState(false);

  const vao = atalhos.length ? VAO : 0;
  // O "+" fica depois da metade das abas (com três, depois da segunda).
  const meio = Math.ceil(abas.length / 2);
  const cada = largura ? (largura - vao) / abas.length : 0;
  const x = useSharedValue(0);
  const oculta = useSharedValue(0);
  const giro = useSharedValue(0);

  useEffect(() => {
    if (indice < 0 || !cada) return;
    x.value = withTiming(indice < meio ? indice * cada : indice * cada + vao, { duration: LEVE, easing: EASE });
  }, [indice, cada, meio, vao, x]);

  useEffect(() => {
    oculta.value = withTiming(visivel ? 0 : 1, { duration: 260 });
    if (!visivel) setAberto(false);
  }, [visivel, oculta]);

  useEffect(() => {
    giro.value = withTiming(aberto ? 1 : 0, { duration: LEVE, easing: EASE });
    if (!aberto) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setAberto(false);
      return true;
    });
    return () => sub.remove();
  }, [aberto, giro]);

  const estiloBarra = useAnimatedStyle(() => ({ transform: [{ translateY: oculta.value * (ALTURA + 70) }], opacity: 1 - oculta.value }));
  const estiloIndicador = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const estiloMais = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.value * 135}deg` }] }));

  const ir = (i: number) => {
    setAberto(false);
    if (i === indice) return;
    // `replace`: as abas são irmãs. Empilhar faria o voltar refazer o passeio.
    router.replace(abas[i].href);
  };
  const escolher = (a: AtalhoAmbiente) => {
    setAberto(false);
    a.onPress();
  };
  const base = insets.bottom + 10;

  return (
    <>
      {aberto ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAberto(false)} accessibilityLabel="Fechar atalhos" />
        </Animated.View>
      ) : null}
      {aberto ? (
        <View pointerEvents="box-none" style={[styles.atalhos, { bottom: base + ALTURA + 22 }]}>
          {atalhos.map((a, i) => (
            <Animated.View
              key={a.chave}
              entering={entrada(atalhos.length - 1 - i)}
              exiting={FadeOutDown.duration(140)}
            >
              <Pressable onPress={() => escolher(a)} style={({ pressed }) => [styles.atalho, pressed && styles.pressionado]} accessibilityRole="button">
                <Text style={styles.atalhoTexto}>{a.rotulo}</Text>
                <View style={styles.atalhoIcone}>
                  <Ionicons name={a.icone} size={20} color={colors.textOnPrimary} />
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      ) : null}

      <Animated.View pointerEvents={visivel ? "box-none" : "none"} style={[styles.raiz, { bottom: base }, estiloBarra]}>
        <View style={styles.sombra} onLayout={(ev) => setLargura(ev.nativeEvent.layout.width)}>
          <BlurView
            intensity={esquema === "escuro" ? 40 : 60}
            tint={vidro.tint}
            // Sem isto o Android ignora o desfoque e sobra um retângulo translúcido.
            experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
            style={[styles.barra, { backgroundColor: vidro.vidro, borderColor: vidro.vidroBorda }]}
          >
            {cada ? (
              <Animated.View pointerEvents="none" style={[styles.indicador, { width: cada - 8, backgroundColor: `${colors.primary}22` }, estiloIndicador]} />
            ) : null}
            {abas.map((aba, i) => {
              const ativo = i === indice;
              return (
                <Pressable
                  key={aba.chave}
                  onPress={() => ir(i)}
                  style={[styles.aba, vao > 0 && i === meio && { marginLeft: vao }]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativo }}
                  accessibilityLabel={aba.rotulo}
                >
                  <Ionicons name={ativo ? aba.iconeAtivo : aba.icone} size={22} color={ativo ? colors.primary : colors.textMuted} />
                  <Text style={[styles.abaTexto, { color: ativo ? colors.primary : colors.textMuted }]} numberOfLines={1}>
                    {aba.rotulo}
                  </Text>
                </Pressable>
              );
            })}
          </BlurView>
        </View>
        {largura && atalhos.length ? (
          <Pressable
            onPress={() => setAberto((a) => !a)}
            style={({ pressed }) => [styles.mais, { left: meio * cada + vao / 2 - MAIS / 2 }, pressed && { transform: [{ scale: 0.94 }] }]}
            accessibilityRole="button"
            accessibilityLabel={aberto ? "Fechar atalhos" : rotuloMais}
            accessibilityState={{ expanded: aberto }}
          >
            <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.maisCirculo}>
              <Animated.View style={estiloMais}>
                <Ionicons name="add" size={32} color={colors.textOnPrimary} />
              </Animated.View>
            </LinearGradient>
          </Pressable>
        ) : null}
      </Animated.View>
    </>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    pressionado: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    raiz: { position: "absolute", left: 16, right: 16 },
    // A sombra fica fora da BlurView: ela precisa de overflow hidden, que recortaria a sombra.
    sombra: {
      borderRadius: ALTURA / 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 10,
    },
    barra: {
      flexDirection: "row",
      alignItems: "center",
      height: ALTURA,
      borderRadius: ALTURA / 2,
      borderWidth: 1,
      overflow: "hidden",
    },
    indicador: { position: "absolute", left: 4, top: 7, bottom: 7, borderRadius: radius.pill },
    aba: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, height: ALTURA },
    abaTexto: { fontSize: 11, fontWeight: "800" },
    mais: {
      position: "absolute",
      top: -(MAIS - ALTURA) / 2 - 14,
      width: MAIS,
      height: MAIS,
      borderRadius: MAIS / 2,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 14,
      elevation: 12,
    },
    maisCirculo: { flex: 1, borderRadius: MAIS / 2, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.surface },
    atalhos: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 10 },
    atalho: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingLeft: 18,
      paddingRight: 6,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
      elevation: 6,
    },
    atalhoTexto: { fontSize: 15, fontWeight: "800", color: colors.text },
    atalhoIcone: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  });
