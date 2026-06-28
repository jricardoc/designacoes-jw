import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/theme";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon, title, message, children }: EmptyStateProps) {
  return (
    <View style={[styles.box, shadow.card]}>
      <Ionicons name={icon} size={48} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
});
