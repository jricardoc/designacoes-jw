import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAplicarIndisponibilidades } from "@/api/hooks/useReunioes";
import type { IndisponibilidadePreview } from "@/api/types";
import { Button, useToast } from "@/components/ui";
import { colors, radius } from "@/theme";

interface Props {
  visible: boolean;
  preview: IndisponibilidadePreview | null;
  onClose: () => void;
}

const chave = (irmaoId: number, data: string) => `${irmaoId}__${data}`;

/**
 * Revisão das indisponibilidades detectadas após importar a programação.
 * O usuário confirma quem deve ficar indisponível e aplica em massa.
 */
export function ImportIndisponibilidadeSheet({ visible, preview, onClose }: Props) {
  const toast = useToast();
  const aplicar = useAplicarIndisponibilidades();
  const confirmados = useMemo(() => preview?.confirmados ?? [], [preview]);
  const ambiguos = useMemo(() => preview?.ambiguos ?? [], [preview]);

  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [ambEscolha, setAmbEscolha] = useState<Record<string, number>>({});

  // Pré-seleciona todos os confirmados sempre que um novo preview abre.
  const seedKey = useMemo(
    () => confirmados.map((c) => c.irmaoId).join(","),
    [confirmados],
  );
  const [seeded, setSeeded] = useState("");
  if (visible && seedKey !== seeded) {
    // Só os de alta confiança vêm marcados; sugestões (média) ficam para conferir.
    const init: Record<string, boolean> = {};
    confirmados.forEach((c) =>
      c.datas.forEach((d) => {
        init[chave(c.irmaoId, d.data)] = d.confianca === "alta";
      }),
    );
    setMarcados(init);
    setAmbEscolha({});
    setSeeded(seedKey);
  }

  const total = useMemo(
    () => Object.values(marcados).filter(Boolean).length,
    [marcados],
  );

  const toggle = (irmaoId: number, data: string) =>
    setMarcados((p) => ({ ...p, [chave(irmaoId, data)]: !p[chave(irmaoId, data)] }));

  const setTodos = (valor: boolean) => {
    const next: Record<string, boolean> = {};
    confirmados.forEach((c) =>
      c.datas.forEach((d) => {
        next[chave(c.irmaoId, d.data)] = valor;
      }),
    );
    setMarcados(next);
  };

  const handleAplicar = async () => {
    const registros: { irmaoId: number; data: string }[] = [];
    confirmados.forEach((c) =>
      c.datas.forEach((d) => {
        if (marcados[chave(c.irmaoId, d.data)]) {
          registros.push({ irmaoId: c.irmaoId, data: d.data });
        }
      }),
    );
    ambiguos.forEach((a) => {
      const escolhido = ambEscolha[`${a.nomeOriginal}__${a.data}`];
      if (escolhido) registros.push({ irmaoId: escolhido, data: a.data });
    });

    if (registros.length === 0) {
      onClose();
      return;
    }

    try {
      const res = await aplicar.mutateAsync(registros);
      toast.show(`${res.criados ?? registros.length} indisponibilidade(s) salva(s)!`);
      onClose();
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Erro ao aplicar indisponibilidades",
        "error",
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.title}>Atualizar indisponibilidades</Text>
              <Text style={styles.subtitle}>
                Irmãos com partes na programação importada
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {confirmados.length === 0 && ambiguos.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyText}>
                  Nenhum irmão cadastrado foi encontrado na programação.
                </Text>
              </View>
            ) : null}

            {confirmados.length > 0 ? (
              <>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionTitle}>
                    Encontrados ({confirmados.length})
                  </Text>
                  <View style={styles.toolBtns}>
                    <Pressable onPress={() => setTodos(true)} style={styles.miniBtn}>
                      <Text style={styles.miniBtnText}>Todos</Text>
                    </Pressable>
                    <Pressable onPress={() => setTodos(false)} style={styles.miniBtn}>
                      <Text style={styles.miniBtnText}>Nenhum</Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.hint}>
                  Marcados = nome exato. Tracejados (sugestão) bateram por parte do
                  nome — confira antes de aplicar.
                </Text>

                {confirmados.map((c) => (
                  <View key={c.irmaoId} style={styles.irmaoCard}>
                    <Text style={styles.irmaoNome}>{c.nome}</Text>
                    <View style={styles.chips}>
                      {c.datas.map((d) => {
                        const ativo = !!marcados[chave(c.irmaoId, d.data)];
                        const sugestao = d.confianca !== "alta";
                        return (
                          <Pressable
                            key={d.data}
                            onPress={() => toggle(c.irmaoId, d.data)}
                            style={[
                              styles.chip,
                              sugestao && !ativo && styles.chipSugestao,
                              ativo && styles.chipActive,
                            ]}
                          >
                            <Ionicons
                              name={ativo ? "checkmark-circle" : "ellipse-outline"}
                              size={15}
                              color={
                                ativo
                                  ? colors.primary
                                  : sugestao
                                    ? colors.amber
                                    : colors.textMuted
                              }
                            />
                            <Text
                              style={[
                                styles.chipText,
                                ativo && styles.chipTextActive,
                                sugestao && !ativo && styles.chipTextSugestao,
                              ]}
                            >
                              {d.data}
                              {sugestao
                                ? ` · sugestão${d.origem?.length ? ` (${d.origem[0]})` : ""}`
                                : ` · ${d.count} parte${d.count > 1 ? "s" : ""}`}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            {ambiguos.length > 0 ? (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.sectionTitle, { color: colors.amber }]}>
                  Precisa de atenção ({ambiguos.length})
                </Text>
                <Text style={styles.ambHint}>
                  Nomes que combinam com mais de um irmão. Toque no correto (ou deixe
                  sem seleção para ignorar).
                </Text>
                {ambiguos.map((a) => {
                  const k = `${a.nomeOriginal}__${a.data}`;
                  return (
                    <View key={k} style={styles.ambCard}>
                      <Text style={styles.ambNome}>
                        {a.nomeOriginal} · {a.data}
                      </Text>
                      <View style={styles.chips}>
                        {a.candidatos.map((cand) => {
                          const ativo = ambEscolha[k] === cand.id;
                          return (
                            <Pressable
                              key={cand.id}
                              onPress={() =>
                                setAmbEscolha((p) => ({
                                  ...p,
                                  [k]: ativo ? 0 : cand.id,
                                }))
                              }
                              style={[styles.chip, ativo && styles.chipActive]}
                            >
                              <Text style={[styles.chipText, ativo && styles.chipTextActive]}>
                                {cand.nome}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerCount}>{total} data(s)</Text>
            <View style={styles.footerBtns}>
              <Button label="Agora não" variant="secondary" onPress={onClose} />
              <Button
                label="Aplicar"
                icon="checkmark"
                onPress={handleAplicar}
                loading={aplicar.isPending}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  flex: { flex: 1 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  body: { padding: 16, gap: 8 },
  empty: { alignItems: "center", paddingVertical: 24, gap: 10 },
  emptyText: { color: colors.textSecondary, textAlign: "center", fontSize: 14 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  toolBtns: { flexDirection: "row", gap: 8 },
  miniBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  miniBtnText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  irmaoCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
  },
  irmaoNome: { fontWeight: "700", color: colors.text, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.successBg },
  chipSugestao: { borderColor: colors.amber, borderStyle: "dashed" },
  chipText: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
  chipTextActive: { color: colors.primaryDark },
  chipTextSugestao: { color: colors.amber },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  ambHint: { fontSize: 12.5, color: colors.amber, marginTop: 4, marginBottom: 8 },
  ambCard: {
    borderWidth: 1,
    borderColor: colors.warningBg,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  ambNome: { fontWeight: "700", color: "#78350f", marginBottom: 8 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  footerCount: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  footerBtns: { flexDirection: "row", gap: 10 },
});
