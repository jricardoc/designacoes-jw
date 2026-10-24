import { Ionicons } from "@expo/vector-icons";
import { router, usePathname, useSegments, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { paletaEstudo } from "@/components/estudo/tema";
import { EASE, LEVE } from "@/components/ministerio/kit";
import { paletaMinisterio } from "@/components/ministerio/tema";
import { paletaTerritorio } from "@/components/territorio/tema";
import { radius, type Cores } from "@/theme";
import { PaletaPropria, useTema } from "@/theme/TemaContext";
import {
  alvoDoTour,
  ambienteDaRota,
  encerrarTour,
  executarAcaoTour,
  passoAnterior,
  proximoPasso,
  pularPasso,
  useTour,
  type TourAtivo,
} from "./estado";
import { mudou, raioDo, recorte, topoDoCartao, type Retangulo } from "./geometria";
import type { Passo } from "./passos";

const PALETAS = { ministerio: paletaMinisterio, territorio: paletaTerritorio, estudo: paletaEstudo } as const;
const VEU = "rgba(0,0,0,0.62)";
/** Onde ficam as abas de cada ambiente: a rota e o grupo que `useSegments` devolve. */
const BASE = { servir: "/(tabs)", ministerio: "/ministerio", territorio: "/territorio", estudo: "/estudo" } as const;
const GRUPO = { servir: "(tabs)", ministerio: "ministerio", territorio: "territorio", estudo: "estudo" } as const;

/** Quanto esperar o alvo: mais quando o passo troca de aba ou mexe no menu; pouco no opcional, que pode não existir. */
const espera = (p: Passo) => (p.opcional ? 1000 : p.aba || p.camada || p.acao ? 2600 : 1500);

/**
 * O que o passo pede antes de aparecer (o menu aberto ou fechado, os ambientes à vista, a aba
 * certa) e o que encerra o tutorial no meio. Montado uma vez, na raiz da área logada.
 */
export function ControleTour() {
  const tour = useTour();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const passo = tour?.passos[tour.i];
  const chave = tour ? `${tour.ambiente}:${tour.i}` : null;

  useEffect(() => {
    if (!tour || !passo) return;
    executarAcaoTour(passo.camada === "menu" ? "abrirMenu" : "fecharMenu");
    if (passo.acao === "mostrarAmbientes") executarAcaoTour("mostrarAmbientes");
    if (passo.aba && !(segments[0] === GRUPO[tour.ambiente] && (segments[1] ?? "index") === passo.aba)) {
      // `replace`, como as barras: as abas são irmãs.
      router.replace(`${BASE[tour.ambiente]}${passo.aba === "index" ? "" : `/${passo.aba}`}` as Href);
    }
    // Só na troca de passo: a navegação muda `segments`, e isso não pode navegar de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  // Saiu do ambiente do tutorial (um aviso tocado, por exemplo): ele termina.
  useEffect(() => {
    if (tour && ambienteDaRota(pathname) !== tour.ambiente) encerrarTour();
  }, [pathname, tour]);

  const ativo = !!tour;
  useEffect(() => {
    if (!ativo) return;
    Keyboard.dismiss();
    // O voltar do Android volta um passo; no primeiro, fecha. Com o menu aberto, quem recebe é o Modal dele.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      passoAnterior();
      return true;
    });
    return () => sub.remove();
  }, [ativo]);

  return null;
}

/**
 * O tutorial na tela: o véu, o recorte em volta do alvo e o cartão. Há uma camada na raiz e outra
 * dentro do menu lateral (um Modal fica por cima de tudo); cada uma desenha os passos dela.
 */
export function CamadaTour({ camada = "app" }: { camada?: "app" | "menu" }) {
  const tour = useTour();
  const passo = tour?.passos[tour.i];
  if (!tour || !passo || (passo.camada ?? "app") !== camada) return null;
  const desenho = <Desenho tour={tour} passo={passo} />;
  // O cartão nas cores do ambiente (a camada da raiz fica fora das paletas de cada um).
  return tour.ambiente === "servir" ? desenho : <PaletaPropria paleta={PALETAS[tour.ambiente]}>{desenho}</PaletaPropria>;
}

function Desenho({ tour, passo }: { tour: TourAtivo; passo: Passo }) {
  const parado = useReducedMotion();
  const tela = useWindowDimensions();
  const raiz = useRef<View>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [furo, setFuro] = useState<Retangulo | null>(null);
  const [pronto, setPronto] = useState(false);
  const [procurando, setProcurando] = useState(false);

  // Procura o alvo e acompanha: ele pode demorar (a aba trocando, o menu abrindo) e mudar de lugar
  // depois (a barra encolhe ao rolar, a lista carrega). Só vale a posição que se repete: no meio de
  // uma animação a medida muda a cada vez.
  useEffect(() => {
    let vivo = true;
    let saiu = false;
    let decidido = false;
    let anterior: Retangulo | null = null;
    const inicio = Date.now();
    setPronto(false);
    setProcurando(false);
    if (!passo.alvo) {
      setFuro(null);
      setPronto(true);
      return;
    }
    const alvo = passo.alvo;
    const semAlvo = () => {
      anterior = null;
      const passou = Date.now() - inicio;
      // O recorte do passo anterior não fica à toa enquanto este procura.
      if (decidido || passou > 350) setFuro(null);
      if (decidido) return;
      if (passou > 400) setProcurando(true);
      if (passou < espera(passo)) return;
      if (passo.opcional) {
        saiu = true;
        pularPasso();
        return;
      }
      decidido = true;
      setProcurando(false);
      setPronto(true);
    };
    const medir = () => {
      if (!vivo || saiu) return;
      const no = alvoDoTour(alvo);
      const camada = raiz.current;
      if (!no || !camada) return semAlvo();
      camada.measureInWindow((cx, cy, cw, ch) => {
        no.measureInWindow((x, y, w, h) => {
          if (!vivo || saiu) return;
          const corte = recorte({ x: x - cx, y: y - cy, w, h }, { w: cw, h: ch });
          if (!corte) return semAlvo();
          const estavel = anterior !== null && !mudou(anterior, corte);
          anterior = corte;
          if (!estavel) return;
          decidido = true;
          setFuro((f) => (mudou(f, corte) ? corte : f));
          setProcurando(false);
          setPronto(true);
        });
      });
    };
    medir();
    const relogio = setInterval(medir, 120);
    return () => {
      vivo = false;
      clearInterval(relogio);
    };
  }, [passo, tour.i]);

  // O recorte anda até o alvo novo; o véu inteiro e o recortado trocam em fade.
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  const fw = useSharedValue(0);
  const fh = useSharedValue(0);
  const fr = useSharedValue(0);
  const comFuro = useSharedValue(0);
  const tinhaFuro = useRef(false);
  useEffect(() => {
    if (furo) {
      const animar = tinhaFuro.current && !parado;
      const ir = (sv: typeof fx, v: number) => {
        sv.value = animar ? withTiming(v, { duration: LEVE, easing: EASE }) : v;
      };
      ir(fx, furo.x);
      ir(fy, furo.y);
      ir(fw, furo.w);
      ir(fh, furo.h);
      ir(fr, raioDo(furo, passo.forma));
    }
    comFuro.value = withTiming(furo ? 1 : 0, { duration: parado ? 0 : 200 });
    tinhaFuro.current = !!furo;
  }, [furo, passo.forma, parado, fx, fy, fw, fh, fr, comFuro]);

  // O véu recortado é uma borda enorme em volta de um miolo vazio: o miolo é o recorte, com cantos
  // redondos, sem SVG. A borda precisa passar das bordas da tela de qualquer lado.
  const B = Math.max(tela.width, tela.height);
  const estiloFuro = useAnimatedStyle(() => ({
    left: fx.value - B,
    top: fy.value - B,
    width: fw.value + 2 * B,
    height: fh.value + 2 * B,
    borderRadius: fr.value + B,
    opacity: comFuro.value,
  }));
  const estiloAnel = useAnimatedStyle(() => ({
    left: fx.value - 2,
    top: fy.value - 2,
    width: fw.value + 4,
    height: fh.value + 4,
    borderRadius: fr.value + 2,
    opacity: comFuro.value,
  }));
  const estiloVeu = useAnimatedStyle(() => ({ opacity: 1 - comFuro.value }));

  return (
    <View
      ref={raiz}
      collapsable={false}
      style={styles.raiz}
      onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      // Segura todo toque: o app por baixo não responde enquanto o tutorial está na tela.
      onStartShouldSetResponder={() => true}
      accessibilityViewIsModal
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: VEU }, estiloVeu]} />
      <Animated.View pointerEvents="none" style={[styles.absoluto, { borderWidth: B, borderColor: VEU }, estiloFuro]} />
      <Animated.View pointerEvents="none" style={[styles.absoluto, styles.anel, estiloAnel]} />
      {procurando && !pronto ? <ActivityIndicator style={styles.procurando} color="#FFFFFF" /> : null}
      <Cartao key={`${tour.ambiente}-${tour.i}`} tour={tour} passo={passo} furo={furo} area={area} pronto={pronto} />
    </View>
  );
}

function Cartao({
  tour,
  passo,
  furo,
  area,
  pronto,
}: {
  tour: TourAtivo;
  passo: Passo;
  furo: Retangulo | null;
  area: { w: number; h: number };
  pronto: boolean;
}) {
  const { colors, styles: s } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const parado = useReducedMotion();
  const [altura, setAltura] = useState(0);
  const opacidade = useSharedValue(0);
  const mostrar = pronto && altura > 0 && area.h > 0;
  const primeiro = tour.i === 0;
  const ultimo = tour.i === tour.passos.length - 1;

  useEffect(() => {
    opacidade.value = withTiming(mostrar ? 1 : 0, { duration: parado ? 0 : 220 });
  }, [mostrar, parado, opacidade]);
  useEffect(() => {
    if (mostrar) AccessibilityInfo.announceForAccessibility(`${passo.titulo}. ${passo.texto}`);
  }, [mostrar, passo]);

  const estilo = useAnimatedStyle(() => ({ opacity: opacidade.value }));
  const top = topoDoCartao(furo, { ...area, topo: insets.top, base: insets.bottom }, altura);

  return (
    <Animated.View
      style={[s.cartao, { top }, estilo]}
      onLayout={(e) => setAltura(e.nativeEvent.layout.height)}
      pointerEvents={mostrar ? "auto" : "none"}
    >
      {!furo && passo.icone ? (
        <View style={s.icone}>
          <Ionicons name={passo.icone} size={30} color={colors.primary} />
        </View>
      ) : null}
      <Text style={s.contagem}>
        {tour.i + 1} de {tour.passos.length}
      </Text>
      <Text style={s.titulo} accessibilityRole="header">
        {passo.titulo}
      </Text>
      <ScrollView style={{ maxHeight: Math.max(120, area.h * 0.34) }} bounces={false} showsVerticalScrollIndicator={false}>
        <Text style={s.texto}>{passo.texto}</Text>
      </ScrollView>
      <View style={s.botoes}>
        {!ultimo ? (
          <Pressable onPress={encerrarTour} hitSlop={10} accessibilityRole="button" style={s.pular}>
            <Text style={s.pularTexto}>{primeiro ? "Agora não" : "Pular"}</Text>
          </Pressable>
        ) : null}
        <View style={s.flex} />
        {!primeiro && !ultimo ? (
          <Pressable
            onPress={passoAnterior}
            style={({ pressed }) => [s.voltar, pressed && s.pressionado]}
            accessibilityRole="button"
            accessibilityLabel="Voltar um passo"
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>
        ) : null}
        <Pressable onPress={proximoPasso} style={({ pressed }) => [s.seguir, pressed && s.pressionado]} accessibilityRole="button">
          <Text style={s.seguirTexto}>{primeiro ? "Começar" : ultimo ? "Concluir" : "Próximo"}</Text>
          <Ionicons name={ultimo ? "checkmark" : "arrow-forward"} size={17} color={colors.textOnPrimary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Acima de tudo da área logada; no Android a elevação também ordena.
  raiz: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000 },
  absoluto: { position: "absolute" },
  anel: { borderWidth: 2, borderColor: "rgba(255,255,255,0.9)" },
  procurando: { position: "absolute", alignSelf: "center", top: "48%" },
});

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1 },
    cartao: {
      position: "absolute",
      left: 16,
      right: 16,
      padding: 18,
      gap: 6,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 12,
    },
    icone: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.primary}1F`,
      marginBottom: 6,
    },
    contagem: { fontSize: 12, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.4 },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
    texto: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
    botoes: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
    pular: { paddingVertical: 8 },
    pularTexto: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
    voltar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    seguir: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 18,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
    },
    seguirTexto: { fontSize: 15.5, fontWeight: "800", color: colors.textOnPrimary },
    pressionado: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  });
