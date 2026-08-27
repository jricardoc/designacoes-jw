import { type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { motion, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { useAlturaTeclado } from "./useAlturaTeclado";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CURVA = Easing.bezier(...motion.curvaSuave);

// Altura fixa do cabeçalho da folha, descontada do teto da rolagem: o `paddingTop` da folha
// (10) mais a alça (4 de folga em cima + 5 dela + 12 embaixo).
const ALTURA_DO_CABECALHO = 10 + 21;

/**
 * A entrada da folha: sobe de baixo da tela até o lugar dela.
 *
 * É `FadeInDown` com o ponto de partida trocado, e NÃO `SlideInDown`, apesar de o nome do
 * segundo descrever melhor o que se vê. O motivo é onde cada um mexe:
 *
 *   SlideInDown anima o `originY` ABSOLUTO da folha até o `targetOriginY` medido no instante
 *   em que a animação começa. Numa folha que carrega o conteúdo depois de abrir — as áreas de
 *   acesso, a lista de irmãos para vincular, os convites de compartilhamento — a folha nasce
 *   baixinha (só o spinner), a animação trava naquele Y, e quando o conteúdo chega ela cresce
 *   para cima a partir de um Y que já não vale mais: fica alta e ancorada lá embaixo, com o
 *   fim dela para fora da tela. Era o bug das "áreas de acesso", que abria mostrando só o
 *   cabeçalho e a primeira opção.
 *
 *   FadeInDown anima um `transform: translateY`, que não disputa com o layout. O layout
 *   posiciona a folha embaixo, seja qual for a altura dela, e o transform só a desloca durante
 *   a animação, terminando em 0. Se a altura mudar no meio do caminho, o layout se acerta
 *   sozinho.
 *
 * A opacidade inicial vai em 1 de propósito: sem isso a folha piscaria junto com a subida, o
 * que o SlideInDown não fazia.
 */
const entradaDaFolha = (deslocamento: number) =>
  FadeInDown.duration(motion.entrada)
    .easing(CURVA)
    .withInitialValues({ opacity: 1, transform: [{ translateY: deslocamento }] });

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Fração da altura máxima da folha (0–1). Padrão 0.9. */
  maxHeightPct?: number;
  /** Remove o padding horizontal interno (para folhas com lista que rola até a borda). */
  flush?: boolean;
  /**
   * Envolve o conteúdo num ScrollView. Ligue quando a folha puder ficar mais alta que a
   * tela — lista de tamanho variável, formulário com vários campos, ou qualquer coisa que
   * o teclado empurre para cima. Sem isso o excedente é CORTADO, sem barra de rolagem e sem
   * jeito de chegar no botão de salvar.
   *
   * Deixe desligado nas folhas que já trazem o próprio ScrollView ou FlatList: dois
   * roláveis aninhados brigam pelo gesto.
   */
  scroll?: boolean;
}

/**
 * Bottom sheet do design "terroso": backdrop com fade, folha deslizando de baixo,
 * cantos arredondados no topo e a alça (handle). Reaproveitada por todos os modais.
 */
export function Sheet({
  visible,
  onClose,
  children,
  maxHeightPct = 0.9,
  flush,
  scroll,
}: SheetProps) {
  const { styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const alturaTeclado = useAlturaTeclado();
  const { height: alturaDaJanela } = useWindowDimensions();

  const recuoInferior = (alturaTeclado > 0 ? 0 : insets.bottom) + 18;

  // Os tetos de altura saem em PIXEL, não em porcentagem.
  //
  // Um ScrollView sem altura limitada, dentro de um pai de altura automática, não sabe que
  // tamanho ter: ele não cresce até o teto do pai nem mede o próprio conteúdo — colapsa. Foi
  // o que aconteceu quando a rolagem entrou apoiada só em `flexShrink`, e é por isso que
  // todas as folhas que já rolavam neste app (VincularIrmaoSheet, DirigentePickerSheet,
  // TurnoSheet...) calculam o teto delas a partir das dimensões da janela.
  const tetoDaFolha = alturaDaJanela * maxHeightPct - alturaTeclado;
  const tetoDaRolagem = Math.max(120, tetoDaFolha - ALTURA_DO_CABECALHO - recuoInferior);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* O recuo do teclado vai na RAIZ: ela ocupa a tela toda e alinha a folha embaixo,
          então empurrá-la para cima levanta a folha inteira. O teto de altura da folha já
          desconta o teclado à parte (ver tetoDaFolha). */}
      <View style={[styles.root, { paddingBottom: alturaTeclado }]}>
        <AnimatedPressable
          entering={FadeIn.duration(motion.fundo)}
          exiting={FadeOut.duration(motion.saida)}
          style={styles.backdrop}
          onPress={onClose}
        />
        <Animated.View
          entering={entradaDaFolha(alturaDaJanela)}
          style={[
            styles.sheet,
            {
              // Com o teclado aberto, a área segura de baixo fica ESCONDIDA atrás dele:
              // somá-la ali abriria um vão morto entre a folha e o teclado.
              paddingBottom: recuoInferior,
              maxHeight: tetoDaFolha,
              paddingHorizontal: flush ? 0 : 22,
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          {scroll ? (
            // `keyboardShouldPersistTaps` evita que o primeiro toque no botão de salvar seja
            // gasto só fechando o teclado.
            <ScrollView
              style={{ maxHeight: tetoDaRolagem }}
              contentContainerStyle={styles.rolagemConteudo}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -18 },
      shadowOpacity: 0.2,
      shadowRadius: 44,
      elevation: 24,
    },
    rolagemConteudo: { paddingBottom: 4 },
    handleWrap: { alignItems: "center", paddingVertical: 4, paddingBottom: 12 },
    handle: { width: 42, height: 5, borderRadius: 999, backgroundColor: colors.handle },
  });
