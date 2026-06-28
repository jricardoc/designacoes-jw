import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useEstatisticas } from "@/api/hooks/useMisc";
import { Card } from "@/components/ui";
import { colors, radius } from "@/theme";

export function DashboardGlobal() {
  const { data, isLoading } = useEstatisticas();

  if (isLoading || !data) return null;

  const kpis = [
    { label: "Quadros", value: data.totalQuadros, icon: "documents" as const, color: colors.primary },
    { label: "Irmãos Ativos", value: data.totalIrmaosAtivos, icon: "people" as const, color: colors.green },
    {
      label: "Designações",
      value: data.totalDesignacoesAtribuidas,
      icon: "checkmark-done" as const,
      color: colors.purple,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>📊 Visão Geral</Text>

      <View style={styles.kpiRow}>
        {kpis.map((k) => (
          <Card key={k.label} style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: k.color + "1a" }]}>
              <Ionicons name={k.icon} size={20} color={k.color} />
            </View>
            <Text style={styles.kpiValue}>{k.value}</Text>
            <Text style={styles.kpiLabel}>{k.label}</Text>
          </Card>
        ))}
      </View>

      {data.top5Geral.length > 0 ? (
        <Card style={{ marginTop: 12 }}>
          <Text style={styles.cardTitle}>🏆 Mais escalados</Text>
          {data.top5Geral.map((item, i) => (
            <View key={item.nome} style={styles.rankRow}>
              <Text style={styles.rankPos}>{i + 1}º</Text>
              <Text style={styles.rankNome}>{item.nome}</Text>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>{item.qtd}x</Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
  },
  kpiRow: { flexDirection: "row", gap: 10 },
  kpiCard: { flex: 1, alignItems: "center", paddingVertical: 16 },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  kpiLabel: { fontSize: 11, color: colors.textSecondary, textAlign: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 10 },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rankPos: { fontWeight: "800", color: colors.primary, width: 28 },
  rankNome: { flex: 1, color: colors.text, fontWeight: "500" },
  rankBadge: {
    backgroundColor: colors.infoBg,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  rankBadgeText: { color: colors.primaryDark, fontWeight: "700", fontSize: 12 },
});
