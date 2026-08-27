import { type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { motion, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { useAlturaTeclado } from "./useAlturaTeclado";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CURVA = Easing.bezier(...motion.curvaSuave);

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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* O recuo do teclado vai na RAIZ: ela ocupa a tela toda e alinha a folha embaixo,
          então empurrá-la para cima levanta a folha inteira. Como a altura máxima da folha é
          uma porcentagem da caixa de conteúdo da raiz, ela encolhe junto — o que sobra da
          tela com o teclado aberto continua sendo respeitado. */}
      <View style={[styles.root, { paddingBottom: alturaTeclado }]}>
        <AnimatedPressable
          entering={FadeIn.duration(motion.fundo)}
          exiting={FadeOut.duration(motion.saida)}
          style={styles.backdrop}
          onPress={onClose}
        />
        <Animated.View
          entering={SlideInDown.duration(motion.entrada).easing(CURVA)}
          style={[
            styles.sheet,
            {
              // Com o teclado aberto, a área segura de baixo fica ESCONDIDA atrás dele:
              // somá-la ali abriria um vão morto entre a folha e o teclado.
              paddingBottom: (alturaTeclado > 0 ? 0 : insets.bottom) + 18,
              maxHeight: `${Math.round(maxHeightPct * 100)}%`,
              paddingHorizontal: flush ? 0 : 22,
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          {scroll ? (
            // `flexShrink: 1` é o que faz a rolagem existir: o padrão do Yoga é 0, e sem ele
            // o ScrollView insiste na altura do conteúdo e estoura o teto da folha em vez de
            // rolar. `keyboardShouldPersistTaps` evita que o primeiro toque no botão de
            // salvar seja gasto só fechando o teclado.
            <ScrollView
              style={styles.rolagem}
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
      // Rede de seguranca do recuo do teclado: se o teto de altura ainda nao couber no que
      // sobrou da tela, a folha encolhe em vez de subir para fora dela por cima.
      flexShrink: 1,
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
    rolagem: { flexShrink: 1 },
    rolagemConteudo: { paddingBottom: 4 },
    handleWrap: { alignItems: "center", paddingVertical: 4, paddingBottom: 12 },
    handle: { width: 42, height: 5, borderRadius: 999, backgroundColor: colors.handle },
  });
