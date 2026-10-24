import { Ionicons } from "@expo/vector-icons";
import { router, usePathname, useSegments, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  BackHandler,
  Keyboard,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
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
import { cantoDoVeu, faixasDoVeu, mudou, raioDo, recorte, topoDoCartao, type Retangulo } from "./geometria";
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

/** O canto de referência: os quatro cantos do recorte são este desenho, só que em escala. */
const R0 = 40;

function Desenho({ tour, passo }: { tour: TourAtivo; passo: Passo }) {
  const parado = useReducedMotion();
  const tela = useWindowDimensions();
  const raiz = useRef<View>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [furo, setFuro] = useState<Retangulo | null>(null);
  const [pronto, setPronto] = useState(false);
  const [procurando, setProcurando] = useState(false);
  const furoAtual = useRef<Retangulo | null>(null);

  // Procura o alvo a cada quadro até achar (o recorte começa a andar uns 2 quadros depois do
  // toque) e depois só acompanha, mais devagar: ele pode mudar de lugar (a barra encolhe ao rolar,
  // a lista carrega). Só vale a posição que se repete, porque no meio de uma animação ela muda.
  // O estado só muda quando algo muda de verdade: nada de render a cada medida.
  useEffect(() => {
    let vivo = true;
    let saiu = false;
    let decidido = false;
    let mostrou = false;
    let girando = false;
    let anterior: Retangulo | null = null;
    let quadro: number | undefined;
    let relogio: ReturnType<typeof setInterval> | undefined;
    const inicio = Date.now();
    const mudarFuro = (r: Retangulo | null) => {
      if (!mudou(furoAtual.current, r)) return;
      furoAtual.current = r;
      setFuro(r);
    };
    const mostrar = () => {
      if (girando) setProcurando((girando = false));
      if (!mostrou) setPronto((mostrou = true));
    };
    setPronto(false);
    setProcurando(false);
    if (!passo.alvo) {
      mudarFuro(null);
      mostrar();
      return;
    }
    const alvo = passo.alvo;
    const semAlvo = () => {
      anterior = null;
      const passou = Date.now() - inicio;
      // O recorte do passo anterior não fica parado no lugar errado enquanto este procura.
      if (decidido || passou > 300) mudarFuro(null);
      if (decidido) return;
      if (passou > 600 && !girando) setProcurando((girando = true));
      if (passou < espera(passo)) return;
      if (passo.opcional) {
        saiu = true;
        pularPasso();
        return;
      }
      decidido = true;
      mostrar();
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
          mudarFuro(corte);
          mostrar();
        });
      });
    };
    const acompanhar = () => {
      if (!vivo || saiu) return;
      medir();
      if (decidido) relogio = setInterval(medir, 150);
      else quadro = requestAnimationFrame(acompanhar);
    };
    acompanhar();
    return () => {
      vivo = false;
      if (quadro !== undefined) cancelAnimationFrame(quadro);
      if (relogio) clearInterval(relogio);
    };
  }, [passo, tour.i]);

  // O recorte: posição, tamanho e raio, animados. Sem alvo, ele se fecha no próprio centro e o véu
  // fica inteiro; o próximo alvo abre a partir dali. Começa fechado, no meio da tela.
  const fx = useSharedValue(tela.width / 2);
  const fy = useSharedValue(tela.height / 2);
  const fw = useSharedValue(0);
  const fh = useSharedValue(0);
  const fr = useSharedValue(0);
  const surgir = useSharedValue(0);
  useEffect(() => {
    surgir.value = withTiming(1, { duration: parado ? 0 : 250 });
  }, [surgir, parado]);
  useEffect(() => {
    const destino = furo ?? { x: fx.value + fw.value / 2, y: fy.value + fh.value / 2, w: 0, h: 0 };
    const ir = (sv: typeof fx, v: number) => {
      sv.value = parado ? v : withTiming(v, { duration: LEVE, easing: EASE });
    };
    ir(fx, destino.x);
    ir(fy, destino.y);
    ir(fw, destino.w);
    ir(fh, destino.h);
    ir(fr, furo ? raioDo(furo, passo.forma) : 0);
  }, [furo, passo.forma, parado, fx, fy, fw, fh, fr]);

  // O véu são quatro faixas do tamanho da tela em volta do recorte, e os quatro cantos dele: tudo
  // só desliza e muda de escala, que é o que o celular anima sem esforço. Nada maior que a tela e
  // nada que precise ser redesenhado a cada quadro. As posições caem em pixel inteiro, para as
  // faixas não deixarem fresta entre si.
  // Com folga: no Android de ponta a ponta a altura da janela pode não contar a barra de navegação.
  const W = Math.max(tela.width, area.w) + 200;
  const H = Math.max(tela.height, area.h) + 200;
  const pr = PixelRatio.get();
  // Cada estilo lê `fx.value`, `fy.value`... direto, e não por uma função auxiliar: o Reanimated só
  // refaz o estilo quando muda um valor que ele acha no próprio estilo (não procura dentro de outras
  // funções). Por uma auxiliar, as faixas ficavam paradas no alvo do passo anterior.
  const estiloCima = useAnimatedStyle(() => {
    const { cima } = faixasDoVeu({ x: fx.value, y: fy.value, w: fw.value, h: fh.value }, W, H, pr);
    return { opacity: surgir.value, transform: [{ translateY: cima.translateY }] };
  });
  const estiloBaixo = useAnimatedStyle(() => {
    const { baixo } = faixasDoVeu({ x: fx.value, y: fy.value, w: fw.value, h: fh.value }, W, H, pr);
    return { opacity: surgir.value, transform: [{ translateY: baixo.translateY }] };
  });
  const estiloEsquerda = useAnimatedStyle(() => {
    const { esquerda: e } = faixasDoVeu({ x: fx.value, y: fy.value, w: fw.value, h: fh.value }, W, H, pr);
    return { opacity: surgir.value, transform: [{ translateX: e.translateX }, { translateY: e.translateY }, { scaleY: e.scaleY }] };
  });
  const estiloDireita = useAnimatedStyle(() => {
    const { direita: d } = faixasDoVeu({ x: fx.value, y: fy.value, w: fw.value, h: fh.value }, W, H, pr);
    return { opacity: surgir.value, transform: [{ translateX: d.translateX }, { translateY: d.translateY }, { scaleY: d.scaleY }] };
  });
  const cantoSE = useAnimatedStyle(() => {
    const c = cantoDoVeu({ x: fx.value, y: fy.value, w: fw.value, h: fh.value }, fr.value, false, false, pr, R0);
    return { opacity: surgir.value, transform: [{ translateX: c.translateX }, { translateY: c.translateY }, { scale: c.scale }] };
  });
  const cantoSD = useAnimatedStyle(() => {
    const c = cantoDoVeu({ x: fx.value, y: fy.value, w: fw.value, h: fh.value }, fr.value, true, false, pr, R0);
    return { opacity: surgir.value, transform: [{ translateX: c.translateX }, { translateY: c.translateY }, { scale: c.scale }] };
  });
  const cantoIE = useAnimatedStyle(() => {
    const c = cantoDoVeu({ x: fx.value, y: fy.value, w: fw.value, h: fh.value }, fr.value, false, true, pr, R0);
    return { opacity: surgir.value, transform: [{ translateX: c.translateX }, { translateY: c.translateY }, { scale: c.scale }] };
  });
  const cantoID = useAnimatedStyle(() => {
    const c = cantoDoVeu({ x: fx.value, y: fy.value, w: fw.value, h: fh.value }, fr.value, true, true, pr, R0);
    return { opacity: surgir.value, transform: [{ translateX: c.translateX }, { translateY: c.translateY }, { scale: c.scale }] };
  });
  // O anel em volta do recorte é pequeno: ele pode acompanhar pelo tamanho. Some quando o recorte fecha.
  const estiloAnel = useAnimatedStyle(() => ({
    left: fx.value - 2,
    top: fy.value - 2,
    width: fw.value + 4,
    height: fh.value + 4,
    borderRadius: fr.value + 2,
    opacity: surgir.value * Math.min(1, Math.min(fw.value, fh.value) / 24),
  }));
  const faixa = { width: W, height: H };
  /**
   * Um canto do recorte: o véu fora de um quarto de círculo, desenhado como a borda grossa de um
   * círculo cortada por um quadrado de lado R0. Fica pequeno (nunca do tamanho da tela) e vai ao
   * raio de cada alvo por escala.
   */
  const canto = (estilo: typeof cantoSE, direita: boolean, baixo: boolean) => (
    <Animated.View pointerEvents="none" style={[styles.canto, estilo]}>
      <View style={[styles.circulo, { left: (direita ? 0 : R0) - 2 * R0, top: (baixo ? 0 : R0) - 2 * R0 }]} />
    </Animated.View>
  );

  return (
    <Animated.View style={styles.raiz} exiting={parado ? undefined : FadeOut.duration(200)} pointerEvents="box-none">
      <View
        ref={raiz}
        collapsable={false}
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        // Segura todo toque: o app por baixo não responde enquanto o tutorial está na tela.
        onStartShouldSetResponder={() => true}
        accessibilityViewIsModal
      >
        <Animated.View pointerEvents="none" style={[styles.faixa, faixa, estiloCima]} />
        <Animated.View pointerEvents="none" style={[styles.faixa, faixa, estiloBaixo]} />
        <Animated.View pointerEvents="none" style={[styles.faixa, faixa, estiloEsquerda]} />
        <Animated.View pointerEvents="none" style={[styles.faixa, faixa, estiloDireita]} />
        {canto(cantoSE, false, false)}
        {canto(cantoSD, true, false)}
        {canto(cantoIE, false, true)}
        {canto(cantoID, true, true)}
        <Animated.View pointerEvents="none" style={[styles.anel, estiloAnel]} />
        {procurando && !pronto ? <ActivityIndicator style={styles.procurando} color="#FFFFFF" /> : null}
        <Cartao key={`${tour.ambiente}-${tour.i}`} tour={tour} passo={passo} furo={furo} area={area} pronto={pronto} />
      </View>
    </Animated.View>
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
  const mostrar = pronto && altura > 0 && area.h > 0;
  const primeiro = tour.i === 0;
  const ultimo = tour.i === tour.passos.length - 1;
  const top = topoDoCartao(furo, { ...area, topo: insets.top, base: insets.bottom }, altura);

  // Entra subindo um pouco e aparecendo enquanto o recorte chega; depois, se o alvo mudar de lugar,
  // vai junto deslizando. Posição por transform, para não recalcular layout a cada quadro.
  const y = useSharedValue(top);
  const entrou = useSharedValue(0);
  const visto = useRef(false);
  useEffect(() => {
    if (!mostrar) return;
    if (!visto.current || parado) y.value = top;
    else y.value = withTiming(top, { duration: LEVE, easing: EASE });
    if (!visto.current) {
      visto.current = true;
      entrou.value = parado ? 1 : withDelay(90, withTiming(1, { duration: 260, easing: EASE }));
      AccessibilityInfo.announceForAccessibility(`${passo.titulo}. ${passo.texto}`);
    }
  }, [mostrar, top, parado, passo, y, entrou]);

  const estilo = useAnimatedStyle(() => ({
    opacity: entrou.value,
    transform: [{ translateY: y.value + (1 - entrou.value) * 14 }],
  }));

  return (
    <Animated.View
      style={[s.cartao, estilo]}
      exiting={parado ? undefined : FadeOut.duration(120)}
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
  faixa: { position: "absolute", left: 0, top: 0, backgroundColor: VEU },
  canto: { position: "absolute", left: 0, top: 0, width: R0, height: R0, overflow: "hidden" },
  circulo: { position: "absolute", width: 4 * R0, height: 4 * R0, borderRadius: 2 * R0, borderWidth: R0, borderColor: VEU },
  anel: { position: "absolute", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.75)" },
  procurando: { position: "absolute", alignSelf: "center", top: "48%" },
});

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1 },
    cartao: {
      position: "absolute",
      left: 16,
      right: 16,
      top: 0,
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
