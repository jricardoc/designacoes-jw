import { Ionicons } from "@expo/vector-icons";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIrmaosDisponiveis, useVincularIrmao } from "@/api/hooks/useMinhasDesignacoes";
import type { Usuario } from "@/api/types";
import { Sheet, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

const BODY_MAX = Math.round(Dimensions.get("window").height * 0.55);

interface Props {
  user: Usuario | null;
  onClose: () => void;
  onVinculado?: () => void;
}

/**
 * Escolhe qual irmão do cadastro corresponde a esta conta.
 * É o vínculo que faz as designações do irmão aparecerem em "Minhas Designações".
 */
export function VincularIrmaoSheet({ user, onClose, onVinculado }: Props) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const { data: irmaos, isLoading } = useIrmaosDisponiveis(user?.id, !!user);
  const vincular = useVincularIrmao();

  const aplicar = async (irmaoId: number | null) => {
    if (!user) return;
    try {
      await vincular.mutateAsync({ usuarioId: user.id, irmaoId });
      toast.show(irmaoId ? "Vínculo atualizado!" : "Vínculo removido");
      onVinculado?.();
      onClose();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao vincular", "error");
    }
  };

  return (
    <Sheet visible={!!user} onClose={onClose} maxHeightPct={0.85}>
      <View style={styles.header}>
        <Text style={styles.title}>Vincular a um irmão</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={18} color="#7A7060" />
        </Pressable>
      </View>

      <Text style={styles.hint}>
        {user?.nome} passará a ver as designações do irmão escolhido.
      </Text>

      {isLoading ? (
        <Text style={styles.hint}>Carregando irmãos...</Text>
      ) : (
        <ScrollView style={{ maxHeight: BODY_MAX }} contentContainerStyle={{ paddingBottom: 8 }}>
          {user?.irmaoId ? (
            <Pressable onPress={() => aplicar(null)} style={[styles.linha, styles.linhaRemover]}>
              <Ionicons name="unlink-outline" size={18} color={colors.red} />
              <Text style={[styles.nome, { color: colors.red }]}>Remover vínculo</Text>
            </Pressable>
          ) : null}

          {(irmaos ?? []).map((i) => {
            const selecionado = i.id === user?.irmaoId;
            return (
              <Pressable
                key={i.id}
                disabled={!i.disponivel}
                onPress={() => aplicar(i.id)}
                style={[
                  styles.linha,
                  selecionado && styles.linhaSelecionada,
                  !i.disponivel && styles.linhaBloqueada,
                ]}
              >
                <Ionicons
                  name={selecionado ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={selecionado ? colors.primary : "#C6BAA0"}
                />
                <View style={styles.flex}>
                  <Text style={styles.nome} numberOfLines={1}>{i.nome}</Text>
                  {!i.disponivel && i.vinculadoA ? (
                    <Text style={styles.ocupado}>já é @{i.vinculadoA.nickname}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    title: { fontSize: 20, fontWeight: "600", color: colors.text },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 19 },
    linha: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      marginBottom: 6,
      backgroundColor: colors.surfaceMuted,
    },
    linhaSelecionada: { backgroundColor: colors.successBg },
    linhaBloqueada: { opacity: 0.45 },
    linhaRemover: { backgroundColor: colors.dangerBg },
    nome: { fontSize: 15, fontWeight: "500", color: colors.text },
    ocupado: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
    flex: { flex: 1, minWidth: 0 },
  });
