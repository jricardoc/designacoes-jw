import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, GradientHeader } from "@/components/ui";
import { colors, radius } from "@/theme";

const AGENDAMENTOS = [
  {
    id: 1,
    diaSemana: "Sábado, 07 de Março",
    turnos: [
      {
        id: 101,
        local: "Estação Mussurunga",
        horario: "08h às 10h",
        responsavel: "João Silva",
        companheiros: ["Pedro Alves", "Marcos Paulo"],
        status: "Confirmado",
      },
      {
        id: 102,
        local: "Ponto de Ônibus Central",
        horario: "10h às 12h",
        responsavel: "Maria Costa",
        companheiros: ["Ana Souza"],
        status: "Lembrete Enviado",
      },
    ],
  },
  {
    id: 2,
    diaSemana: "Domingo, 08 de Março",
    turnos: [
      {
        id: 103,
        local: "Praça de Itapuã",
        horario: "08h às 10h",
        responsavel: "Ricardo Mendes",
        companheiros: ["Felipe", "Lucas"],
        status: "Confirmado",
      },
    ],
  },
];

const KPIS = [
  { label: "Hoje", value: "02", icon: "calendar" as const, color: colors.primary },
  { label: "Esta Semana", value: "14", icon: "checkmark-circle" as const, color: colors.green },
  { label: "Locais Ativos", value: "03", icon: "location" as const, color: colors.purple },
];

export default function CarrinhoScreen() {
  return (
    <View style={styles.flex}>
      <GradientHeader
        title="Carrinho"
        description="Agendamentos do carrinho de publicações"
        icon="book"
        colorsGradient={[colors.green, colors.greenDark]}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.kpiRow}>
          {KPIS.map((k) => (
            <Card key={k.label} style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: k.color + "1a" }]}>
                <Ionicons name={k.icon} size={20} color={k.color} />
              </View>
              <Text style={styles.kpiValue}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </Card>
          ))}
        </View>

        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={colors.primaryDark} />
          <Text style={styles.infoText}>
            Esta tela exibe dados de exemplo. A integração de agendamentos via
            WhatsApp será finalizada em breve.
          </Text>
        </View>

        {AGENDAMENTOS.map((dia) => (
          <View key={dia.id} style={styles.diaGroup}>
            <Text style={styles.diaTitulo}>
              <Ionicons name="calendar" size={16} color={colors.green} /> {dia.diaSemana}
            </Text>
            {dia.turnos.map((t) => (
              <Card key={t.id} style={{ gap: 8 }}>
                <View style={styles.turnoHeader}>
                  <Text style={styles.turnoLocal}>
                    <Ionicons name="location" size={14} color={colors.textSecondary} /> {t.local}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor:
                          t.status === "Confirmado" ? colors.successBg : colors.warningBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: t.status === "Confirmado" ? colors.greenDark : "#92400e" },
                      ]}
                    >
                      {t.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.horario}>
                  <Ionicons name="time" size={14} color={colors.textSecondary} /> {t.horario}
                </Text>
                <View style={styles.participante}>
                  <Text style={styles.pBadge}>Dirigente</Text>
                  <Text style={styles.pNome}>{t.responsavel}</Text>
                </View>
                {t.companheiros.length > 0 ? (
                  <View style={styles.participante}>
                    <Text style={styles.pBadge}>Companheiros</Text>
                    <Text style={styles.pNome}>{t.companheiros.join(", ")}</Text>
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
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
  infoBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.infoBg,
    borderRadius: radius.md,
    padding: 14,
  },
  infoText: { flex: 1, fontSize: 13, color: colors.primaryDark, lineHeight: 18 },
  diaGroup: { gap: 10 },
  diaTitulo: { fontSize: 16, fontWeight: "800", color: colors.text },
  turnoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  turnoLocal: { fontSize: 14, fontWeight: "700", color: colors.text, flex: 1 },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  horario: { fontSize: 13, color: colors.textSecondary },
  participante: { flexDirection: "row", alignItems: "center", gap: 8 },
  pBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    width: 92,
  },
  pNome: { fontSize: 13, color: colors.text, flex: 1, fontWeight: "500" },
});
