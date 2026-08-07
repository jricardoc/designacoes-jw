import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

export function Loading({ label = "Carregando..." }: { label?: string }) {
  const { colors, styles } = useTema(criarEstilos);
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 32,
    },
    text: { color: colors.textSecondary, fontSize: 15 },
  });
