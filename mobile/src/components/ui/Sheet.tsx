import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { motion, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

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
}

/**
 * Bottom sheet do design "terroso": backdrop com fade, folha deslizando de baixo,
 * cantos arredondados no topo e a alça (handle). Reaproveitada por todos os modais.
 */
export function Sheet({ visible, onClose, children, maxHeightPct = 0.9, flush }: SheetProps) {
  const { styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
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
              paddingBottom: insets.bottom + 18,
              maxHeight: `${Math.round(maxHeightPct * 100)}%`,
              paddingHorizontal: flush ? 0 : 22,
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          {children}
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
    handleWrap: { alignItems: "center", paddingVertical: 4, paddingBottom: 12 },
    handle: { width: 42, height: 5, borderRadius: 999, backgroundColor: colors.handle },
  });
