import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  useCriarIndisponibilidade,
  useExcluirIndisponibilidade,
  useIndisponibilidadesIrmao,
} from "@/api/hooks/useIndisponibilidades";
import { colors, MESES } from "@/theme";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export function CalendarioIndisponibilidade({ irmaoId }: { irmaoId: number }) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const { data: indisp = [] } = useIndisponibilidadesIrmao(irmaoId);
  const criar = useCriarIndisponibilidade(irmaoId);
  const excluir = useExcluirIndisponibilidade(irmaoId);

  const dias: (number | null)[] = (() => {
    const primeiro = new Date(ano, mes, 1).getDay();
    const total = new Date(ano, mes + 1, 0).getDate();
    const arr: (number | null)[] = Array(primeiro).fill(null);
    for (let i = 1; i <= total; i++) arr.push(i);
    return arr;
  })();

  const dataStr = (dia: number) =>
    `${String(dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}`;
  const existente = (dia: number) => indisp.find((i) => i.data === dataStr(dia));

  const toggle = (dia: number) => {
    const found = existente(dia);
    if (found) excluir.mutate(found.id);
    else criar.mutate({ data: dataStr(dia), motivo: "Compromisso pessoal" });
  };

  const prev = () => {
    if (mes === 0) {
      setMes(11);
      setAno((a) => a - 1);
    } else setMes((m) => m - 1);
  };
  const next = () => {
    if (mes === 11) {
      setMes(0);
      setAno((a) => a + 1);
    } else setMes((m) => m + 1);
  };

  const limpar = () => indisp.forEach((i) => excluir.mutate(i.id));

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Ionicons name="calendar-outline" size={17} color={colors.oliveSoft} />
          <Text style={styles.title}>Indisponibilidades</Text>
        </View>
        <View style={styles.nav}>
          <Pressable onPress={prev} style={styles.navBtn} hitSlop={6}>
            <Ionicons name="chevron-back" size={15} color="#7A7060" />
          </Pressable>
          <Text style={styles.navLabel}>
            {MESES[mes + 1]} {ano}
          </Text>
          <Pressable onPress={next} style={styles.navBtn} hitSlop={6}>
            <Ionicons name="chevron-forward" size={15} color="#7A7060" />
          </Pressable>
        </View>
      </View>

      <View style={styles.grid}>
        {SEMANA.map((d, i) => (
          <Text key={i} style={styles.weekday}>
            {d}
          </Text>
        ))}
        {dias.map((dia, idx) => {
          if (dia === null) return <View key={idx} style={styles.cell} />;
          const indisponivel = !!existente(dia);
          return (
            <View key={idx} style={styles.cell}>
              <Pressable
                onPress={() => toggle(dia)}
                style={[styles.dayCell, indisponivel && styles.dayCellOn]}
              >
                <Text style={[styles.dayText, indisponivel && styles.dayTextOn]}>{dia}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendFree]} />
            <Text style={styles.legendText}>Disponível</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#A8503B" }]} />
            <Text style={styles.legendText}>Indisponível</Text>
          </View>
        </View>
        {indisp.length > 0 ? (
          <Pressable onPress={limpar} hitSlop={6}>
            <Text style={styles.clearText}>Limpar ({indisp.length})</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 9 },
  title: { fontWeight: "600", color: colors.text, fontSize: 16.5 },
  nav: { flexDirection: "row", alignItems: "center", gap: 6 },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: { fontWeight: "600", fontSize: 13.5, color: "#3A352D", minWidth: 96, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: {
    width: "14.2857%",
    textAlign: "center",
    color: "#B7AC97",
    fontWeight: "700",
    fontSize: 11,
    paddingBottom: 4,
  },
  cell: { width: "14.2857%", aspectRatio: 1, padding: 2 },
  dayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayCellOn: { backgroundColor: "#A8503B" },
  dayText: { color: "#3A352D", fontWeight: "600", fontSize: 13 },
  dayTextOn: { color: "#fff" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  legend: { flexDirection: "row", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 13, height: 13, borderRadius: 4 },
  legendFree: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "#DCD0B9" },
  legendText: { fontSize: 12, color: "#9A8F7D" },
  clearText: { color: "#9A4632", fontSize: 12.5, fontWeight: "600" },
});
