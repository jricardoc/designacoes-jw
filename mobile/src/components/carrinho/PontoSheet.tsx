import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import {
  useAtualizarPonto,
  useCriarPonto,
  useExcluirPonto,
} from "@/api/hooks/useCarrinho";
import type { CarrinhoPonto } from "@/api/types";
import { ConfirmDialog, Sheet, useConfirm, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/** Cores das planilhas de origem, mais algumas para pontos novos. */
const CORES = [
  "#D9822B",
  "#8064A2",
  "#C0504D",
  "#77933C",
  "#2F6F7E",
  "#9A5A38",
  "#5E6B48",
  "#B06A43",
];

interface Props {
  visible: boolean;
  ponto: CarrinhoPonto | null;
  onClose: () => void;
}

export function PontoSheet({ visible, ponto, onClose }: Props) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const confirm = useConfirm();
  const { usuario } = useAuth();
  const criar = useCriarPonto();
  const atualizar = useAtualizarPonto();
  const excluir = useExcluirPonto();

  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setNome(ponto?.nome ?? "");
    setCor(ponto?.cor || CORES[0]);
    setAtivo(ponto?.ativo ?? true);
  }, [visible, ponto]);

  const editando = !!ponto;
  const salvando = criar.isPending || atualizar.isPending;

  const salvar = async () => {
    if (!nome.trim()) {
      toast.show("Informe o nome do ponto", "error");
      return;
    }
    try {
      if (editando && ponto) {
        await atualizar.mutateAsync({ id: ponto.id, nome: nome.trim(), cor, ativo });
        toast.show("Ponto atualizado");
      } else {
        await criar.mutateAsync({ nome: nome.trim(), cor });
        toast.show("Ponto criado");
      }
      onClose();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao salvar", "error");
    }
  };

  const remover = () => {
    if (!ponto) return;
    confirm.confirm({
      title: "Excluir ponto",
      message: `Excluir o ponto "${ponto.nome}"? Os turnos dele somem junto. As pessoas continuam cadastradas.`,
      type: "danger",
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await excluir.mutateAsync(ponto.id);
          toast.show("Ponto excluído");
        } catch (err) {
          toast.show(err instanceof Error ? err.message : "Erro ao excluir", "error");
        }
        confirm.close();
        onClose();
      },
    });
  };

  // O DELETE do ponto é restrito a admin no servidor; sem isso o botão só entregaria 403.
  const podeExcluir = editando && podeGerenciar(usuario, "carrinho");

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{editando ? "Editar ponto" : "Novo ponto"}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={18} color="#7A7060" />
        </Pressable>
      </View>

      <Text style={styles.label}>Nome do ponto</Text>
      <TextInput
        value={nome}
        onChangeText={setNome}
        placeholder="Ex.: Mussurunga - Miguel"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <Text style={[styles.label, { marginTop: 18 }]}>Cor</Text>
      <View style={styles.coresRow}>
        {CORES.map((c) => {
          const active = c === cor;
          return (
            <Pressable
              key={c}
              onPress={() => setCor(c)}
              style={[styles.corWrap, active && styles.corWrapActive]}
              accessibilityLabel={`Cor ${c}`}
            >
              <View style={[styles.corBolha, { backgroundColor: c }]}>
                {active ? (
                  <Ionicons name="checkmark" size={18} color={colors.textOnPrimary} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {editando ? (
        <View style={styles.ativoRow}>
          <View style={styles.flex}>
            <Text style={styles.ativoTitle}>Ativo</Text>
            <Text style={styles.ativoDesc}>
              Pontos inativos saem da agenda de lembretes
            </Text>
          </View>
          <Switch
            value={ativo}
            onValueChange={setAtivo}
            trackColor={{ true: colors.oliveSoft, false: "#D8CDBA" }}
            thumbColor="#fff"
          />
        </View>
      ) : null}

      <View style={styles.footer}>
        {podeExcluir ? (
          <Pressable onPress={remover} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.red} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={salvar}
          disabled={salvando}
          style={[styles.saveBtn, salvando && styles.saveBtnDisabled]}
        >
          <Text style={styles.saveText}>{salvando ? "Salvando..." : "Salvar"}</Text>
        </Pressable>
      </View>

      <ConfirmDialog config={confirm.config} onClose={confirm.close} />
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
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
    input: {
      marginTop: 9,
      height: 48,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      paddingHorizontal: 15,
      fontSize: 15,
      color: colors.text,
    },
    coresRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 11 },
    corWrap: {
      width: 46,
      height: 46,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    corWrapActive: { borderColor: colors.text },
    corBolha: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    ativoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.md,
      padding: 15,
      marginTop: 20,
    },
    ativoTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
    ativoDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    footer: { flexDirection: "row", gap: 11, marginTop: 24 },
    deleteBtn: {
      width: 52,
      height: 52,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: `${colors.red}44`,
      backgroundColor: colors.dangerBg,
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
    saveBtnDisabled: { opacity: 0.5 },
    saveText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: "600" },
    flex: { flex: 1 },
  });
