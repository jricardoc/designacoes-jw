import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.backdrop}
          onPress={onClose}
        />
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(180)}
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

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28,27,20,0.5)",
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
  handle: { width: 42, height: 5, borderRadius: 999, backgroundColor: "#E2D9C7" },
});
