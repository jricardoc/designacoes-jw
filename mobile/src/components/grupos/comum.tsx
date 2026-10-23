import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RelatorioCampo } from "@/api/types";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { nomeMes, somarMeses } from "@/utils/assistenciaMensal";

/** O mês do relatório que se pede agora: o que acabou de passar. */
export function mesDeReferencia() {
  const d = new Date();
  return somarMeses(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, -1);
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Outubro de 2026" com as setas. Não passa do mês de referência: o mês atual ainda não fechou. */
export function SeletorMes({ mes, onMudar }: { mes: string; onMudar: (mes: string) => void }) {
  const { colors, styles } = useTema(criarEstilos);
  const noFim = mes >= mesDeReferencia();
  return (
    <View style={styles.meses}>
      <Pressable style={styles.seta} onPress={() => onMudar(somarMeses(mes, -1))} hitSlop={8} accessibilityLabel="Mês anterior">
        <Ionicons name="chevron-back" size={20} color={colors.primaryDark} />
      </Pressable>
      <View style={styles.mesTextos}>
        <Text style={styles.mesRotulo}>Relatório de</Text>
        <Text style={styles.mesNome}>{maiuscula(nomeMes(mes))}</Text>
      </View>
      <Pressable
        style={[styles.seta, noFim && { opacity: 0.3 }]}
        onPress={() => onMudar(somarMeses(mes, 1))}
        disabled={noFim}
        hitSlop={8}
        accessibilityLabel="Próximo mês"
      >
        <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

/** Quantos já entregaram, em barra. */
export function BarraProgresso({ feitos, total }: { feitos: number; total: number }) {
  const { colors, styles } = useTema(criarEstilos);
  const fracao = total > 0 ? feitos / total : 0;
  return (
    <View style={styles.trilho}>
      <View
        style={[
          styles.preenchido,
          { width: `${Math.round(fracao * 100)}%`, backgroundColor: fracao >= 1 ? colors.greenDark : colors.oliveSoft },
        ]}
      />
    </View>
  );
}

/** "52 h · 3 estudos", "Participou · 1 estudo", "Não participou". */
export function resumoDoRelatorio(r: RelatorioCampo) {
  const estudos = r.estudos ? ` · ${r.estudos} ${r.estudos === 1 ? "estudo" : "estudos"}` : "";
  if (r.pioneiroRegular || r.pioneiroAuxiliar) {
    return `${r.horas ?? 0} h${estudos}${r.pioneiroAuxiliar ? " · auxiliar" : ""}`;
  }
  return r.participou ? `Participou${estudos}` : "Não participou";
}

/** "2026-11-04T..." -> "04/11" */
export function diaMes(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    meses: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    seta: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mesTextos: { alignItems: "center" },
    mesRotulo: { fontSize: 12, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
    mesNome: { fontSize: 20, fontWeight: "800", color: colors.text },
    trilho: { height: 8, borderRadius: radius.pill, backgroundColor: colors.border, overflow: "hidden" },
    preenchido: { height: 8, borderRadius: radius.pill },
  });
