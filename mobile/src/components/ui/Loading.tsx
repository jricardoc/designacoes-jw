import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

export function Loading({ label = "Carregando..." }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  text: { color: colors.textSecondary, fontSize: 15 },
});
