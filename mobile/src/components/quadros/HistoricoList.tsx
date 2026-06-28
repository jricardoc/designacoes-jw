import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useHistoricoQuadro } from "@/api/hooks/useMisc";
import { colors, radius } from "@/theme";
import { formatDateTimeBR } from "@/utils/date";

const ACAO_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  criou: "add-circle",
  editou: "create",
  publicou: "checkmark-circle",
  arquivou: "archive",
  excluiu_dia: "trash",
};

export function HistoricoList({ quadroId }: { quadroId: string }) {
  const { data, isLoading } = useHistoricoQuadro(quadroId);

  if (isLoading) {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.box}>
        <Text style={styles.empty}>Nenhuma alteração registrada.</Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      {data.map((h) => (
        <View key={h.id} style={styles.row}>
          <Ionicons
            name={ACAO_ICON[h.acao] ?? "ellipse"}
            size={18}
            color={colors.primary}
            style={{ marginTop: 2 }}
          />
          <View style={styles.flex}>
            <Text style={styles.desc}>{h.descricao}</Text>
            <Text style={styles.meta}>
              {h.usuario?.nome ?? "—"} • {formatDateTimeBR(h.createdAt)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
  },
  flex: { flex: 1 },
  row: { flexDirection: "row", gap: 10 },
  desc: { color: colors.text, fontSize: 14, lineHeight: 19 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textSecondary, textAlign: "center" },
});
