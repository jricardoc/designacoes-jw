import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Badge, Card } from "@/components/ui";
import { colors, MESES, statusConfig } from "@/theme";
import { formatDateBR } from "@/utils/date";

interface MonthCardProps {
  mes: number;
  ano: number;
  status: string;
  createdAt: string;
  icon: keyof typeof Ionicons.glyphMap;
  metrics: { icon: keyof typeof Ionicons.glyphMap; label: string }[];
  gradient?: readonly [string, string];
  onPress: () => void;
  index?: number;
}

export function MonthCard({
  mes,
  ano,
  status,
  createdAt,
  icon,
  metrics,
  onPress,
  index = 0,
}: MonthCardProps) {
  const sc = statusConfig[status] ?? statusConfig.rascunho;

  return (
    <Animated.View entering={FadeInDown.delay(index * 55).duration(300)}>
    <Card onPress={onPress}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.iconBox}>
            <Ionicons name={icon} size={20} color={colors.brown} />
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.title}>
              {MESES[mes]} {ano}
            </Text>
            <View style={styles.metrics}>
              {metrics.map((m, i) => (
                <Text key={m.label} style={styles.metricText}>
                  {i > 0 ? "·  " : ""}
                  {m.label}
                </Text>
              ))}
            </View>
          </View>
        </View>
        <Badge label={sc.label} color={sc.color} bg={sc.bg} />
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Criado em {formatDateBR(createdAt)}</Text>
        <Ionicons name="chevron-forward" size={16} color="#C6BAA0" />
      </View>
    </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    flex: 1,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  titleCol: { flex: 1 },
  title: { fontSize: 20, fontWeight: "600", color: colors.text },
  metrics: { flexDirection: "row", flexWrap: "wrap", marginTop: 5 },
  metricText: { fontSize: 12.5, color: "#9A8F7D" },
  divider: {
    height: 1,
    backgroundColor: "#EFE7D7",
    marginVertical: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 12, color: "#AEA28C" },
});
