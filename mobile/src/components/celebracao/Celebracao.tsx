import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { radius, shadow, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * A comemoração de tarefa cumprida: um recado curto e confete caindo.
 *
 * Existe porque a lista de tarefas só sabe cobrar. Toda a interação dela é prazo, atraso e
 * vermelho; o único momento bom — o de ter feito — passava com um toast de três palavras. Isto
 * dá a esse instante o peso que ele tem.
 *
 * O confete é feito à mão, com Reanimated, em vez de uma biblioteca: as que existem animam
 * pelo `Animated` do React Native e trariam um segundo runtime de animação para o app inteiro,
 * além de uma dependência a mais para manter — e a peça é meia dúzia de interpolações.
 */

/** Quanto tempo a comemoração fica na tela antes de sair sozinha. */
const DURACAO_NA_TELA = 2800;

/** Quantos papéis caem. Acima disso não se percebe mais, e cada um é uma view animada. */
const QUANTIDADE = 44;

const ENTRADA = 180;
const SAIDA = 260;

interface Papel {
  id: number;
  cor: string;
  /** Onde ele começa, em fração da largura (0–1). */
  x: number;
  largura: number;
  altura: number;
  atraso: number;
  duracao: number;
  /** Quanto ele vagueia para os lados no caminho. */
  deriva: number;
  /** Quantos graus ele gira na queda. */
  giro: number;
  /** Papel comprido cai girando; quadradinho cai rodopiando. */
  redondo: boolean;
}

/** Sorteio estável: cada papel é sorteado UMA vez, na montagem. */
function sortearPapeis(cores: string[]): Papel[] {
  const aleatorio = (min: number, max: number) => min + Math.random() * (max - min);

  return Array.from({ length: QUANTIDADE }, (_, id) => ({
    id,
    cor: cores[id % cores.length],
    // Nunca 0 nem 1: em `left: 100%` o papel nasce fora da tela pela direita, e a deriva
    // pode não trazê-lo de volta a tempo.
    x: aleatorio(0.02, 0.94),
    largura: aleatorio(6, 12),
    altura: aleatorio(9, 16),
    // O escalonamento é o que faz parecer chuva em vez de cortina: sem ele os 44 papéis
    // atravessam a tela na mesma linha.
    //
    // O teto de atraso + duração é o tempo que a comemoração fica na tela: o último papel
    // pousa junto com o fim dela. Passar disso corta a queda no meio, que é pior do que
    // confete de menos.
    atraso: aleatorio(0, 700),
    duracao: aleatorio(1400, 2100),
    deriva: aleatorio(-70, 70),
    giro: aleatorio(-540, 540),
    redondo: Math.random() < 0.25,
  }));
}

function Confete({ papel, altura }: { papel: Papel; altura: number }) {
  const progresso = useSharedValue(0);

  useEffect(() => {
    progresso.value = withDelay(
      papel.atraso,
      // Aceleração leve: papel caindo ganha velocidade, e o tempo linear denuncia na hora
      // que aquilo é uma animação e não uma queda.
      withTiming(1, { duration: papel.duracao, easing: Easing.in(Easing.quad) }),
    );
  }, [papel, progresso]);

  const estilo = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progresso.value, [0, 1], [-40, altura + 60]) },
      // Vai e volta: o balanço do papel no ar.
      { translateX: interpolate(progresso.value, [0, 0.5, 1], [0, papel.deriva, 0]) },
      { rotate: `${progresso.value * papel.giro}deg` },
    ],
    opacity: interpolate(progresso.value, [0, 0.08, 0.8, 1], [0, 1, 1, 0]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          // `top: 0` é obrigatório, não enfeite. Sem uma âncora vertical, um filho absoluto
          // herda a posição ESTÁTICA que o flex lhe daria — e a raiz é `justifyContent:
          // "center"`, então os papéis nasciam no meio da tela e só caíam dali para baixo.
          top: 0,
          left: `${papel.x * 100}%`,
          width: papel.largura,
          height: papel.redondo ? papel.largura : papel.altura,
          borderRadius: papel.redondo ? papel.largura / 2 : 2,
          backgroundColor: papel.cor,
        },
        estilo,
      ]}
    />
  );
}

interface Props {
  visivel: boolean;
  onFim: () => void;
  /** Uma linha extra sobre o que foi cumprido. Opcional. */
  detalhe?: string | null;
}

export function Celebracao({ visivel, onFim, detalhe }: Props) {
  const { colors, styles } = useTema(criarEstilos);
  const { height: alturaDaTela } = useWindowDimensions();
  const semMovimento = useReducedMotion();

  /**
   * As cores saem do TEMA, e não de uma lista fixa de hexes.
   *
   * É o que faz o confete continuar legível no modo daltônico — a mesma razão pela qual as
   * categorias da tela de início pararam de usar cor fixa.
   */
  const cores = useMemo(
    () => [colors.primary, colors.amber, colors.teal, colors.terracotta, colors.brown, colors.greenDark],
    [colors],
  );

  /**
   * Continua montado depois de `visivel` virar falso, até a saída terminar.
   *
   * `Modal visible={visivel}` desmontava o conteúdo no mesmo quadro, e por isso não havia
   * saída nenhuma: a comemoração apagava de um quadro para o outro. Mesmo arranjo que o menu
   * lateral já usa — quem manda no desmonte é o fim da animação, não a prop.
   */
  const [montado, setMontado] = useState(visivel);

  /** 0 = fora da tela, 1 = presente. Governa entrada E saída, do fundo ao confete. */
  const presenca = useSharedValue(0);
  const escala = useSharedValue(0.86);

  // Sorteados uma vez por abertura. Depende de `montado`, e não de `visivel`: preso a
  // `visivel` o confete desapareceria de uma vez no instante do fechamento, bem no meio da
  // saída que ele deveria acompanhar.
  const papeis = useMemo(() => (montado ? sortearPapeis(cores) : []), [montado, cores]);

  useEffect(() => {
    if (visivel) setMontado(true);
  }, [visivel]);

  useEffect(() => {
    if (!montado) return;

    if (visivel) {
      presenca.value = withTiming(1, { duration: ENTRADA });
      // O reset da escala é AQUI, na abertura, e não no fechamento: zerá-la ao sair faria o
      // cartão dar um salto para menor no primeiro quadro da saída, antes de qualquer fade.
      escala.value = 0.86;
      escala.value = withSpring(1, { mass: 0.5, damping: 11, stiffness: 190 });
      const relogio = setTimeout(onFim, DURACAO_NA_TELA);
      return () => clearTimeout(relogio);
    }

    // Na saída a escala fica onde está: quem encolhe o cartão é a interpolação de
    // `presenca` (1 -> 0.92), junto com o fade.
    presenca.value = withTiming(0, { duration: SAIDA }, (fim) => {
      if (fim) runOnJS(setMontado)(false);
    });
    return undefined;
  }, [visivel, montado, presenca, escala, onFim]);

  /** Fundo e confete somem juntos — é o que faz a cena sair inteira, e não em pedaços. */
  const estiloDaCena = useAnimatedStyle(() => ({ opacity: presenca.value }));

  const estiloDoCartao = useAnimatedStyle(() => ({
    opacity: presenca.value,
    transform: [
      {
        // Encolhe um tico ao sair, como quem recolhe o cartão. Sem isso o fade sozinho
        // parece a tela travando.
        scale: (semMovimento ? 1 : escala.value) * interpolate(presenca.value, [0, 1], [0.92, 1]),
      },
    ],
  }));

  return (
    <Modal visible={montado} transparent animationType="none" statusBarTranslucent onRequestClose={onFim}>
      {/* Um toque em qualquer lugar encerra: quem já leu não precisa esperar os 2,8s. */}
      <Pressable style={styles.raiz} onPress={onFim} accessibilityRole="button" accessibilityLabel="Fechar">
        <Animated.View style={[styles.fundo, estiloDaCena]} />

        {/* Sem movimento (preferência do sistema), o confete não cai: a comemoração vira só
            o recado. Papel voando é exatamente o tipo de coisa que essa preferência pede
            para não acontecer. */}
        {semMovimento ? null : (
          // O invólucro existe para o confete sair JUNTO com o resto: são 44 views soltas, e
          // sem um pai comum não haveria como apagá-las de uma vez.
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, estiloDaCena]}>
            {papeis.map((papel) => (
              <Confete key={papel.id} papel={papel} altura={alturaDaTela} />
            ))}
          </Animated.View>
        )}

        <Animated.View
          style={[styles.cartao, estiloDoCartao]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <View style={[styles.selo, { backgroundColor: colors.successBg }]}>
            <Ionicons name="checkmark-done" size={30} color={colors.greenDark} />
          </View>

          <Text style={styles.titulo}>Parabéns!</Text>
          <Text style={styles.recado}>Que Jeová te abençoe!</Text>

          {detalhe ? (
            <Text style={styles.detalhe} numberOfLines={2}>
              {detalhe}
            </Text>
          ) : null}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    raiz: { flex: 1, alignItems: "center", justifyContent: "center" },
    fundo: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.backdrop },
    cartao: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
      marginHorizontal: spacing.xl,
      ...shadow.card,
    },
    selo: {
      width: 58,
      height: 58,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    titulo: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.4,
    },
    recado: {
      fontSize: 16.5,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: "center",
    },
    detalhe: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: spacing.md,
      textAlign: "center",
      lineHeight: 18,
    },
  });
