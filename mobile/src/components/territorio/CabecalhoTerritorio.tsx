import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MarcaTerritorio, TrocarAmbienteSheet } from "@/components/layout/Ambientes";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * O topo das abas do Território: a marca, que troca de ambiente (é por ela que se volta ao
 * Servir Mais). Em cima do mapa vira uma pílula, para não sumir no desenho das ruas.
 */
export function CabecalhoTerritorio({ sobreOMapa }: { sobreOMapa?: boolean }) {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const [trocar, setTrocar] = useState(false);

  return (
    <View style={[styles.cabecalho, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
      <Pressable
        onPress={() => setTrocar(true)}
        style={({ pressed }) => [styles.marca, sobreOMapa && styles.pilula, pressed && styles.pressionado]}
        accessibilityRole="button"
        accessibilityLabel="Território. Trocar de ambiente"
      >
        <MarcaTerritorio tamanho={28} />
        <Text style={styles.marcaNome}>Território</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>
      <TrocarAmbienteSheet visible={trocar} onClose={() => setTrocar(false)} atual="territorio" />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    cabecalho: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 6 },
    marca: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, paddingRight: 6 },
    pilula: { paddingLeft: 6, paddingRight: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow.card },
    pressionado: { opacity: 0.7 },
    marcaNome: { fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  });
