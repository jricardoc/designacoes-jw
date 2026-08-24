import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * O atalho para a tela de análise de cumprimento, mostrado nas abas de
 * Designações e Dirigentes. Some para quem não gerencia nenhuma das duas
 * áreas — a tela (e o endpoint) são restritos a quem cuida das escalas.
 */
export function AtalhoCumprimento() {
  const { colors, styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  const podeVer =
    podeGerenciar(usuario, "designacoes") || podeGerenciar(usuario, "dirigentes");
  if (!podeVer) return null;

  return (
    <Pressable style={styles.card} onPress={() => router.push("/cumprimento")}>
      <View style={styles.icone}>
        <Ionicons name="checkmark-done-outline" size={20} color={colors.primaryDark} />
      </View>
      <View style={styles.textos}>
        <Text style={styles.titulo}>Análise de cumprimento</Text>
        <Text style={styles.descricao}>
          Quem cumpriu ou faltou às participações
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
    },
    icone: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.infoBg,
      alignItems: "center",
      justifyContent: "center",
    },
    textos: { flex: 1, gap: 2 },
    titulo: { fontSize: 15.5, fontWeight: "700", color: colors.text },
    descricao: { fontSize: 13, color: colors.textSecondary },
  });
