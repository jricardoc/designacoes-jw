import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  useAtualizarSaida,
  useCriarSaida,
  useExcluirSaida,
} from "@/api/hooks/useDirigentes";
import type { SaidaCampo } from "@/api/types";
import { ConfirmDialog, Sheet, useConfirm, useToast } from "@/components/ui";
import { colors } from "@/theme";

const DIAS: { key: string; label: string }[] = [
  { key: "domingo", label: "Dom" },
  { key: "segunda", label: "Seg" },
  { key: "terca", label: "Ter" },
  { key: "quarta", label: "Qua" },
  { key: "quinta", label: "Qui" },
  { key: "sexta", label: "Sex" },
  { key: "sabado", label: "Sáb" },
];

function splitLocal(local: string) {
  const parts = (local || "").split(" - ");
  return { ponto: parts[0] || "", host: parts.slice(1).join(" - ") };
}

interface Props {
  visible: boolean;
  saida: SaidaCampo | null;
  onClose: () => void;
}

export function SaidaCampoModal({ visible, saida, onClose }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const criar = useCriarSaida();
  const atualizar = useAtualizarSaida();
  const excluir = useExcluirSaida();

  const [diaSemana, setDiaSemana] = useState("sabado");
  const [horario, setHorario] = useState("08:45");
  const [ponto, setPonto] = useState("");
  const [host, setHost] = useState("");

  useEffect(() => {
    if (!visible) return;
    const { ponto: p, host: h } = splitLocal(saida?.local ?? "");
    setDiaSemana(saida?.diaSemana ?? "sabado");
    setHorario(saida?.horario ?? "08:45");
    setPonto(p);
    setHost(h);
  }, [visible, saida]);

  const editando = !!saida;
  const salvando = criar.isPending || atualizar.isPending;

  const salvar = async () => {
    if (!ponto.trim()) {
      toast.show("Informe o ponto de saída", "error");
      return;
    }
    const local = host.trim() ? `${ponto.trim()} - ${host.trim()}` : ponto.trim();
    const payload = { diaSemana, horario: horario.trim() || "08:45", local, turno: saida?.turno ?? 1 };
    try {
      if (editando && saida) {
        await atualizar.mutateAsync({ id: saida.id, ...payload });
        toast.show("Saída atualizada");
      } else {
        await criar.mutateAsync(payload);
        toast.show("Saída adicionada");
      }
      onClose();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao salvar", "error");
    }
  };

  const remover = () => {
    if (!saida) return;
    confirm.confirm({
      title: "Excluir saída",
      message: "Remover esta saída de campo?",
      type: "danger",
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await excluir.mutateAsync(saida.id);
          toast.show("Saída removida");
        } catch {
          toast.show("Erro ao excluir", "error");
        }
        confirm.close();
        onClose();
      },
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{editando ? "Editar Saída" : "Nova Saída de Campo"}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={18} color="#7A7060" />
        </Pressable>
      </View>

      <Text style={styles.label}>Dia</Text>
      <View style={styles.diasRow}>
        {DIAS.map((d) => {
          const active = d.key === diaSemana;
          return (
            <Pressable
              key={d.key}
              onPress={() => setDiaSemana(d.key)}
              style={[styles.diaChip, active && styles.diaChipActive]}
            >
              <Text style={[styles.diaChipText, active && styles.diaChipTextActive]}>{d.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <View style={{ width: 118 }}>
          <Text style={styles.label}>Horário</Text>
          <TextInput
            value={horario}
            onChangeText={setHorario}
            placeholder="08:45"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { textAlign: "center" }]}
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>Ponto de saída</Text>
          <TextInput
            value={ponto}
            onChangeText={setPonto}
            placeholder="Ex.: KM 17"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>Local</Text>
      <TextInput
        value={host}
        onChangeText={setHost}
        placeholder="Ex.: Casa do irmão Edilson"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <View style={styles.footer}>
        {editando ? (
          <Pressable onPress={remover} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.red} />
          </Pressable>
        ) : null}
        <Pressable onPress={salvar} disabled={salvando} style={styles.saveBtn}>
          <Text style={styles.saveText}>{salvando ? "Salvando..." : "Salvar"}</Text>
        </Pressable>
      </View>

      <ConfirmDialog config={confirm.config} onClose={confirm.close} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  title: { fontSize: 23, fontWeight: "600", color: colors.text },
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
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  diasRow: { flexDirection: "row", gap: 6, marginTop: 9 },
  diaChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  diaChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  diaChipText: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
  diaChipTextActive: { color: colors.textOnPrimary },
  row: { flexDirection: "row", gap: 11, marginTop: 18 },
  input: {
    marginTop: 9,
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 15,
    color: colors.text,
  },
  footer: { flexDirection: "row", gap: 11, marginTop: 24 },
  deleteBtn: {
    width: 52,
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E7C9BC",
    backgroundColor: "#F8EDE8",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: "600" },
  flex: { flex: 1 },
});
