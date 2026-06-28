import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useCriarQuadro } from "@/api/hooks/useQuadros";
import type { QuadroResumo, RegrasAutoPreenchimento } from "@/api/types";
import { Sheet, useToast } from "@/components/ui";
import { colors, MESES, radius } from "@/theme";

const BODY_MAX = Math.round(Dimensions.get("window").height * 0.56);

const REGRAS_INFO: { key: keyof RegrasAutoPreenchimento; label: string; desc: string }[] = [
  { key: "respeitarIndisponibilidades", label: "Respeitar Indisponibilidades", desc: "Não designar irmãos em dias ocupados" },
  { key: "evitarRepeticoes", label: "Evitar Repetições", desc: "Não colocar o mesmo irmão em dias seguidos" },
  { key: "distribuicaoIgualitaria", label: "Distribuição Igualitária", desc: "Balancear a quantidade de designações" },
  { key: "designarTodos", label: "Designar Todos", desc: "Garantir que todos tenham ao menos 1 designação" },
  { key: "regraAudioVideo", label: "Regra Áudio e Vídeo", desc: "1 experiente + 1 treinando" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (q: QuadroResumo) => void;
  existentes: { mes: number; ano: number }[];
}

export function NovoQuadroModal({ visible, onClose, onCreated, existentes }: Props) {
  const toast = useToast();
  const criar = useCriarQuadro();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [auto, setAuto] = useState(true);
  const [regras, setRegras] = useState<RegrasAutoPreenchimento>({
    respeitarIndisponibilidades: true,
    evitarRepeticoes: true,
    distribuicaoIgualitaria: true,
    designarTodos: true,
    regraAudioVideo: true,
  });

  const jaExiste = existentes.some((q) => q.mes === mes && q.ano === ano);

  const handleSubmit = async () => {
    if (jaExiste) return;
    try {
      const novo = await criar.mutateAsync({
        mes,
        ano,
        autoPreenchimento: auto,
        regras: auto ? regras : null,
      });
      toast.show("Quadro criado com sucesso!");
      onCreated(novo);
      onClose();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao criar quadro", "error");
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} maxHeightPct={0.94}>
      <View style={styles.header}>
        <Text style={styles.title}>Novo Quadro</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={18} color="#7A7060" />
        </Pressable>
      </View>

      <ScrollView style={{ maxHeight: BODY_MAX }} contentContainerStyle={styles.body}>
        <Text style={styles.label}>Mês</Text>
        <View style={styles.mesGrid}>
          {MESES.slice(1).map((m, i) => {
            const value = i + 1;
            const active = value === mes;
            return (
              <Pressable
                key={m}
                onPress={() => setMes(value)}
                style={[styles.mesChip, active && styles.mesChipActive]}
              >
                <Text style={[styles.mesChipText, active && styles.mesChipTextActive]}>
                  {m.slice(0, 3)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { marginTop: 20 }]}>Ano</Text>
        <View style={styles.anoRow}>
          <Pressable style={styles.stepBtn} onPress={() => setAno((a) => a - 1)}>
            <Ionicons name="remove" size={20} color={colors.primary} />
          </Pressable>
          <Text style={styles.anoValue}>{ano}</Text>
          <Pressable style={styles.stepBtn} onPress={() => setAno((a) => a + 1)}>
            <Ionicons name="add" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {jaExiste ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>⚠️ Já existe um quadro para esse mês/ano</Text>
          </View>
        ) : null}

        <View style={styles.autoRow}>
          <View style={styles.flex}>
            <Text style={styles.autoTitle}>Preenchimento Automático</Text>
            <Text style={styles.autoDesc}>Designar irmãos usando regras inteligentes</Text>
          </View>
          <Switch
            value={auto}
            onValueChange={setAuto}
            trackColor={{ true: colors.oliveSoft, false: "#D8CDBA" }}
            thumbColor="#fff"
          />
        </View>

        {auto ? (
          <View style={styles.regras}>
            {REGRAS_INFO.map((r) => {
              const on = regras[r.key];
              return (
                <Pressable
                  key={r.key}
                  style={styles.regraRow}
                  onPress={() => setRegras((prev) => ({ ...prev, [r.key]: !prev[r.key] }))}
                >
                  <View style={[styles.checkBox, on && styles.checkBoxOn]}>
                    {on ? <Ionicons name="checkmark" size={13} color="#FBF7EF" /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.regraLabel}>{r.label}</Text>
                    <Text style={styles.regraDesc}>{r.desc}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={onClose} style={styles.btnGhost}>
          <Text style={styles.btnGhostText}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={jaExiste || criar.isPending}
          style={[styles.btnPrimary, (jaExiste || criar.isPending) && { opacity: 0.5 }]}
        >
          <Text style={styles.btnPrimaryText}>
            {criar.isPending ? "Criando..." : "Criar Quadro"}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: { fontSize: 25, fontWeight: "600", color: colors.text },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingBottom: 8 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  mesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 11 },
  mesChip: {
    width: "15.1%",
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  mesChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  mesChipText: { color: colors.textSecondary, fontWeight: "600", fontSize: 12 },
  mesChipTextActive: { color: colors.textOnPrimary },
  anoRow: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 11 },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  anoValue: { fontSize: 32, fontWeight: "600", color: colors.text, minWidth: 90, textAlign: "center" },
  warnBox: { backgroundColor: colors.warningBg, borderRadius: radius.md, padding: 12, marginTop: 16 },
  warnText: { color: "#92400e", fontSize: 14 },
  autoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F3ECDD",
    borderWidth: 1,
    borderColor: "#EAE0CC",
    borderRadius: 16,
    padding: 15,
    marginTop: 22,
  },
  autoTitle: { fontWeight: "600", color: colors.text, fontSize: 15 },
  autoDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  regras: { marginTop: 18, gap: 15 },
  regraRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  regraLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
  regraDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  footer: { flexDirection: "row", gap: 11, marginTop: 18 },
  btnGhost: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E2D9C7",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: { color: "#5C5446", fontSize: 15, fontWeight: "600" },
  btnPrimary: {
    flex: 1.3,
    height: 52,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: "600" },
  flex: { flex: 1 },
});
