import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { qk } from "@/api/queryKeys";
import {
  useAtualizarEscala,
  useAtualizarStatusDirigente,
  useDirigentesQuadro,
  useExcluirDiaEscala,
  useExcluirDirigenteQuadro,
} from "@/api/hooks/useDirigentes";
import { useIrmaos } from "@/api/hooks/useIrmaos";
import type { EscalaDirigente, QuadroDirigente } from "@/api/types";
import {
  Badge,
  Button,
  ConfirmDialog,
  GradientHeader,
  Loading,
  useConfirm,
  useToast,
} from "@/components/ui";
import {
  DirigentePickerSheet,
  type PickerPerson,
} from "@/components/dirigentes/DirigentePickerSheet";
import { colors, MESES, MESES_CURTO, radius, statusConfig } from "@/theme";
import { compareDataBR } from "@/utils/date";
import { exportarPdf } from "@/utils/exportPdf";
import { gerarHtmlDirigentes, type GrupoEscalaPdf } from "@/utils/pdfHtml";

interface GrupoEscala {
  data: string;
  dia: string;
  escalas: EscalaDirigente[];
}

export default function EscalaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data: quadro, isLoading, refetch, isRefetching } = useDirigentesQuadro(id);
  const { data: irmaos = [] } = useIrmaos();

  const atualizar = useAtualizarEscala(id);
  const status = useAtualizarStatusDirigente(id);
  const excluir = useExcluirDirigenteQuadro();
  const excluirDia = useExcluirDiaEscala(id);

  const [editing, setEditing] = useState<{
    escalaId: number;
    campo: "principal" | "substituto";
    saidaCampoId: number;
    data: string;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const dirigentes = useMemo(
    () => irmaos.filter((i) => i.ativo && i.funcoes.includes("dirigente")),
    [irmaos],
  );

  const grupos = useMemo<GrupoEscala[]>(() => {
    if (!quadro) return [];
    const map: Record<string, GrupoEscala> = {};
    for (const e of quadro.escalas) {
      if (!map[e.data]) map[e.data] = { data: e.data, dia: e.dia, escalas: [] };
      map[e.data].escalas.push(e);
    }
    return Object.values(map).sort((a, b) => compareDataBR(a.data, b.data));
  }, [quadro]);

  const stats = useMemo(() => {
    const c: Record<string, number> = {};
    quadro?.escalas.forEach((e) => {
      if (e.principal) c[e.principal] = (c[e.principal] ?? 0) + 1;
      if (e.substituto) c[e.substituto] = (c[e.substituto] ?? 0) + 1;
    });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [quadro]);

  if (isLoading || !quadro) {
    return <Loading label="Carregando escala..." />;
  }

  const sc = statusConfig[quadro.status] ?? statusConfig.rascunho;

  const candidatos = (saidaCampoId: number, data: string): string[] =>
    dirigentes
      .filter((irmao) => {
        const indis = irmao.indisponibilidades?.some((i) => i.data === data);
        if (indis) return false;
        return irmao.dirigenteSaidas?.some((ds) => ds.saidaCampoId === saidaCampoId);
      })
      .map((i) => i.nome)
      .sort((a, b) => a.localeCompare(b));

  const applyChange = async (
    escalaId: number,
    campo: "principal" | "substituto",
    valor: string,
  ) => {
    qc.setQueryData<QuadroDirigente>(qk.dirigentesQuadro(id), (old) =>
      old
        ? {
            ...old,
            escalas: old.escalas.map((e) =>
              e.id === escalaId ? { ...e, [campo]: valor } : e,
            ),
          }
        : old,
    );
    try {
      await atualizar.mutateAsync({ escalaId, campo, valor });
      toast.show("Escala atualizada!");
    } catch {
      toast.show("Erro ao salvar", "error");
      refetch();
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const html = gerarHtmlDirigentes(quadro, grupos as unknown as GrupoEscalaPdf[]);
      const nomeMes = (MESES[quadro.mes] ?? "mes").toLowerCase();
      await exportarPdf(html, `escala-dirigentes-${nomeMes}-${quadro.ano}.pdf`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao gerar PDF", "error");
    } finally {
      setDownloading(false);
    }
  };

  const loadMap: Record<string, number> = {};
  quadro.escalas.forEach((e) => {
    if (e.principal) loadMap[e.principal] = (loadMap[e.principal] ?? 0) + 1;
    if (e.substituto) loadMap[e.substituto] = (loadMap[e.substituto] ?? 0) + 1;
  });

  const escalaEditando = editing
    ? quadro.escalas.find((e) => e.id === editing.escalaId)
    : undefined;

  const pickerPeople: PickerPerson[] = editing
    ? candidatos(editing.saidaCampoId, editing.data)
        .map((nome) => ({ nome, load: loadMap[nome] ?? 0 }))
        .sort((a, b) => a.load - b.load || a.nome.localeCompare(b.nome))
    : [];

  const selectedValue = editing ? escalaEditando?.[editing.campo] : undefined;

  return (
    <View style={styles.flex}>
      <GradientHeader
        title={`${MESES_CURTO[quadro.mes]} ${quadro.ano}`}
        description={`${quadro.escalas.length} saídas programadas`}
        icon="compass"
        showBack
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={styles.actionsCard}>
          <Badge label={sc.label} color={sc.color} bg={sc.bg} />
          <View style={styles.actionsRow}>
            {quadro.status === "rascunho" ? (
              <Button
                label="Publicar"
                icon="checkmark"
                variant="success"
                loading={status.isPending}
                onPress={async () => {
                  try {
                    await status.mutateAsync("publicado");
                    toast.show("Escala publicada!");
                  } catch {
                    toast.show("Erro ao publicar", "error");
                  }
                }}
              />
            ) : (
              <Button
                label="Arquivar"
                icon="archive"
                variant="secondary"
                onPress={async () => {
                  try {
                    await status.mutateAsync("arquivado");
                    toast.show("Escala arquivada!");
                  } catch {
                    toast.show("Erro ao arquivar", "error");
                  }
                }}
              />
            )}
            <Button
              label={downloading ? "PDF..." : "PDF"}
              icon="download"
              variant="secondary"
              loading={downloading}
              onPress={() => {
                if (quadro.status === "rascunho") {
                  toast.show("Publique a escala para baixar o PDF", "info");
                  return;
                }
                handleDownloadPDF();
              }}
            />
            <Button
              label="Excluir"
              icon="trash"
              variant="danger"
              onPress={() =>
                confirm.confirm({
                  title: "Excluir Escala",
                  message: `Excluir a escala de ${MESES_CURTO[quadro.mes]} ${quadro.ano}?`,
                  type: "danger",
                  confirmText: "Sim, excluir",
                  onConfirm: async () => {
                    try {
                      await excluir.mutateAsync(id);
                      toast.show("Escala excluída!");
                      confirm.close();
                      router.back();
                    } catch {
                      toast.show("Erro ao excluir", "error");
                    }
                  },
                })
              }
            />
          </View>
        </View>

        {grupos.map((grupo) => (
          <View key={grupo.data} style={styles.diaCard}>
            <View style={styles.diaHeader}>
              <View style={styles.diaDate}>
                <Text style={styles.diaNumero}>{grupo.data}</Text>
              </View>
              <View style={styles.diaBadge}>
                <Text style={styles.diaBadgeText}>{grupo.dia}</Text>
              </View>
              <Pressable
                hitSlop={8}
                style={styles.deleteDia}
                onPress={() =>
                  confirm.confirm({
                    title: "Remover dia",
                    message: `Remover todas as saídas de ${grupo.data}?`,
                    type: "danger",
                    confirmText: "Remover",
                    onConfirm: async () => {
                      try {
                        await excluirDia.mutateAsync(grupo.data);
                        toast.show("Dia removido!");
                        confirm.close();
                      } catch {
                        toast.show("Erro ao remover dia", "error");
                      }
                    },
                  })
                }
              >
                <Ionicons name="trash-outline" size={16} color={colors.redDark} />
              </Pressable>
            </View>

            {grupo.escalas.map((e) => (
              <View key={e.id} style={styles.saidaRow}>
                <Text style={styles.saidaLocal} numberOfLines={2}>
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} />{" "}
                  {e.saidaCampo?.horario} · {e.saidaCampo?.local}
                </Text>
                <View style={styles.cellsRow}>
                  {(["principal", "substituto"] as const).map((campo) => (
                    <Pressable
                      key={campo}
                      style={styles.cell}
                      onPress={() =>
                        setEditing({
                          escalaId: e.id,
                          campo,
                          saidaCampoId: e.saidaCampoId,
                          data: e.data,
                        })
                      }
                    >
                      <Text style={styles.cellTag}>
                        {campo === "principal" ? "Dirigente" : "Substituto"}
                      </Text>
                      <Text
                        style={[styles.cellText, !e[campo] && styles.cellEmpty]}
                        numberOfLines={1}
                      >
                        {e[campo] || "—"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>📊 Escalas do Mês</Text>
          {stats.length === 0 ? (
            <Text style={styles.panelEmpty}>Nenhuma designação definida</Text>
          ) : (
            stats.map(([nome, count]) => (
              <View key={nome} style={styles.statRow}>
                <Text style={styles.statNome}>{nome}</Text>
                <View style={styles.statBadge}>
                  <Text style={styles.statBadgeText}>{count}x</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <DirigentePickerSheet
        visible={!!editing}
        title={editing ? (editing.campo === "principal" ? "Dirigente" : "Substituto") : ""}
        sub={
          escalaEditando
            ? `${escalaEditando.saidaCampo?.horario ?? ""} · ${escalaEditando.saidaCampo?.local ?? ""}`
            : undefined
        }
        people={pickerPeople}
        current={selectedValue}
        onSelect={(valor) => {
          if (editing) applyChange(editing.escalaId, editing.campo, valor);
        }}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog config={confirm.config} onClose={confirm.close} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    gap: 12,
  },
  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  diaCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14 },
  diaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  diaDate: { minWidth: 52 },
  diaNumero: { fontSize: 20, fontWeight: "600", color: colors.terracotta },
  diaBadge: {
    flex: 1,
    backgroundColor: colors.infoBg,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  diaBadgeText: { color: colors.primaryDark, fontWeight: "700" },
  deleteDia: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  saidaRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 6,
    gap: 8,
  },
  saidaLocal: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  cellsRow: { flexDirection: "row", gap: 8 },
  cell: {
    flex: 1,
    backgroundColor: colors.slotBg,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.slotBorder,
  },
  cellTag: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  cellText: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 2 },
  cellEmpty: { color: colors.textMuted, fontWeight: "400" },
  panel: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16 },
  panelTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  panelEmpty: { color: colors.textSecondary, marginTop: 8 },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  statNome: { color: colors.text, fontWeight: "500", flex: 1 },
  statBadge: {
    backgroundColor: colors.infoBg,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statBadgeText: { color: colors.primaryDark, fontWeight: "700", fontSize: 12 },
});
