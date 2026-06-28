import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme";

interface GradientHeaderProps {
  title: string;
  description?: string;
  /** Mantido por compatibilidade; ignorado no tema terroso (header é plano). */
  icon?: keyof typeof Ionicons.glyphMap;
  colorsGradient?: readonly [string, string, ...string[]];
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}

/**
 * Cabeçalho plano (tema terroso): título grande escuro sobre o fundo creme,
 * subtítulo suave, botão voltar opcional e um slot à direita.
 */
export function GradientHeader({
  title,
  description,
  showBack,
  onBack,
  right,
}: GradientHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      {showBack ? (
        <Pressable
          style={styles.back}
          hitSlop={10}
          onPress={() => (onBack ? onBack() : router.back())}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
      ) : null}

      <View style={styles.row}>
        <View style={styles.titleText}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {description ? (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  backText: { color: colors.textSecondary, fontSize: 15, fontWeight: "500" },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  titleText: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: 31,
    fontWeight: "600",
    letterSpacing: -0.6,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 6,
  },
  right: { paddingBottom: 4 },
});
