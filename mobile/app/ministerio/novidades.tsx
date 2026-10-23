import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Icone } from "@/components/ministerio/kit";
import { Button } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { KEY_TOUR_MINISTERIO } from "@/utils/ambiente";

const PAGINAS: { icone: Icone; cores: readonly [string, string]; titulo: string; texto: string }[] = [
  {
    icone: "leaf",
    cores: ["#2FD3A4", "#0A7F61"],
    titulo: "Bem-vindo ao Ministério",
    texto: "Um app só para o seu ministério de pioneiro, dentro do Servir Mais. Para voltar às designações, toque na marca lá no alto.",
  },
  {
    icone: "timer",
    cores: ["#3ED3E6", "#0B6F8F"],
    titulo: "O seu dia no Início",
    texto: "O cronômetro conta o tempo, o anel mostra a meta do mês e as conversas de hoje ficam à mão: Conversei ou Não em casa.",
  },
  {
    icone: "map",
    cores: ["#9C95FF", "#4B43B0"],
    titulo: "Contatos na lista e no mapa",
    texto: "Revisitas e estudos com a cor da situação, no mapa com satélite e na linha do tempo de cada um. Segure o dedo para as ações rápidas.",
  },
  {
    icone: "calendar",
    cores: ["#FFB36B", "#D9693C"],
    titulo: "Agenda com os companheiros",
    texto: "Planeje saídas, veja quando os outros pioneiros vão sair e assine o calendário no celular para ter tudo junto.",
  },
  {
    icone: "medal",
    cores: ["#FFE7A0", "#C88A10"],
    titulo: "Progresso e emblemas",
    texto: "O status de cada mês, emblemas que comemoram a constância e a quilometragem das viagens. Compartilhe as conquistas.",
  },
];

function Ilustracao({ icone, cores }: { icone: Icone; cores: readonly [string, string] }) {
  const parado = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (parado) return;
    t.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [t, parado]);
  const flutua = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * t.value }, { rotate: `${(t.value - 0.5) * 6}deg` }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.18 + t.value * 0.14, transform: [{ scale: 1 + t.value * 0.08 }] }));
  return (
    <View style={styles.ilustracao}>
      <Animated.View style={[styles.halo, { backgroundColor: cores[0] }, halo]} />
      <Animated.View style={flutua}>
        <LinearGradient colors={cores} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.circulo}>
          <Ionicons name={icone} size={64} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

/** O tour das novidades: aparece na primeira entrada e fica no menu do avatar. */
export default function NovidadesMinisterio() {
  const { colors, styles: s } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const rolagem = useRef<ScrollView>(null);
  const [pagina, setPagina] = useState(0);
  const ultima = pagina === PAGINAS.length - 1;

  const fechar = () => {
    AsyncStorage.setItem(KEY_TOUR_MINISTERIO, "1").catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace("/ministerio");
  };
  const avancar = () => {
    if (ultima) return fechar();
    rolagem.current?.scrollTo({ x: (pagina + 1) * width, animated: true });
    // O Android não avisa o fim da rolagem feita por código.
    setPagina(pagina + 1);
  };

  return (
    <View style={[s.tela, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={s.topo}>
        <Text style={s.marca}>Novidades</Text>
        {!ultima ? (
          <Pressable onPress={fechar} hitSlop={10} accessibilityRole="button">
            <Text style={s.pular}>Pular</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        ref={rolagem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPagina(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={s.flex}
      >
        {PAGINAS.map((p, i) => (
          <View key={p.titulo} style={[s.pagina, { width }]}>
            <Ilustracao icone={p.icone} cores={p.cores} />
            {i === pagina ? (
              <Animated.View entering={FadeInDown.duration(420)} style={s.textos}>
                <Text style={s.titulo}>{p.titulo}</Text>
                <Text style={s.texto}>{p.texto}</Text>
              </Animated.View>
            ) : (
              <View style={s.textos}>
                <Text style={s.titulo}>{p.titulo}</Text>
                <Text style={s.texto}>{p.texto}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      <View style={s.pontos}>
        {PAGINAS.map((p, i) => (
          <View key={p.titulo} style={[s.ponto, i === pagina && { width: 22, backgroundColor: colors.primary }]} />
        ))}
      </View>
      <View style={s.rodape}>
        <Button label={ultima ? "Começar" : "Próximo"} icon={ultima ? "checkmark" : "arrow-forward"} onPress={avancar} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ilustracao: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 200, height: 200, borderRadius: 100 },
  circulo: { width: 132, height: 132, borderRadius: 44, alignItems: "center", justifyContent: "center" },
});

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1 },
    flex: { flex: 1 },
    topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, height: 40 },
    marca: { fontSize: 15, fontWeight: "900", color: colors.primary, textTransform: "uppercase", letterSpacing: 1.5 },
    pular: { fontSize: 15, fontWeight: "800", color: colors.textSecondary },
    pagina: { alignItems: "center", justifyContent: "center", gap: 28, paddingHorizontal: 32 },
    textos: { alignItems: "center", gap: 10 },
    titulo: { fontSize: 27, fontWeight: "900", color: colors.text, textAlign: "center", letterSpacing: -0.6 },
    texto: { fontSize: 16, color: colors.textSecondary, textAlign: "center", lineHeight: 23 },
    pontos: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 18 },
    ponto: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.border },
    rodape: { paddingHorizontal: 20 },
  });
