import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Fragment, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { qk } from "@/api/queryKeys";
import {
  useAtualizarDesignacao,
  useAtualizarStatusQuadro,
  useExcluirDia,
  useExcluirQuadro,
  useQuadro,
} from "@/api/hooks/useQuadros";
import { useIrmaos } from "@/api/hooks/useIrmaos";
import { useMarcarCumprimentoDesignacao } from "@/api/hooks/useCumprimento";
import type { Designacao, Quadro } from "@/api/types";
import {
  Badge,
  Button,
  ConfirmDialog,
  GradientHeader,
  Loading,
  SelectSheet,
  useConfirm,
  useToast,
  type SelectOption,
} from "@/components/ui";
import { MarcadorCumprimento } from "@/components/cumprimento/MarcadorCumprimento";
import { DiaShareCard } from "@/components/quadros/DiaShareCard";
import { HistoricoList } from "@/components/quadros/HistoricoList";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { MESES, MESES_CURTO, radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import {
  agruparPorData,
  getIrmaosParaFuncao,
  isDesignacaoSeguida,
  isDesignadoNoMesmoDia,
  isIndisponivel,
  type GrupoDia,
} from "@/utils/designacaoRules";
import { dataDoQuadro } from "@/utils/date";
import { useHoje } from "@/utils/useHoje";
import { ordenarFuncoes } from "@/utils/funcoes";
import { exportarImagem } from "@/utils/exportImagem";
import { exportarPdf } from "@/utils/exportPdf";
import { gerarHtmlQuadro } from "@/utils/pdfHtml";

interface EditingCell {
  data: string;
  funcao: string;
  campo: "irmao1" | "irmao2";
}

export default function QuadroScreen() {
  const { colors, styles, statusConfig } = useTema(criarEstilos);
  // Quem não é admin só lê: sem publicar/arquivar/excluir e sem editar célula.
  // O backend nega essas escritas de qualquer forma; aqui é para a tela não
  // oferecer o que vai dar "Acesso negado".
  const { usuario } = useAuth();
  const podeEditar = podeGerenciar(usuario, "designacoes");
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data: quadro, isLoading, refetch, isRefetching } = useQuadro(id);
  const { data: irmaos = [] } = useIrmaos();

  const atualizar = useAtualizarDesignacao(id);
  const status = useAtualizarStatusQuadro(id);
  const excluir = useExcluirQuadro();
  const excluirDia = useExcluirDia(id);
  const marcarCumprimento = useMarcarCumprimentoDesignacao();

  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [pendingSeguida, setPendingSeguida] = useState<
    (EditingCell & { valor: string }) | null
  >(null);
  const [showHistorico, setShowHistorico] = useState(false);
  // Mesmo padrão do Histórico: a lista de estatísticas é longa e nem sempre interessa.
  const [showStats, setShowStats] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Dia sendo compartilhado: montar o cartao e o que dispara a captura (ver o onLayout abaixo).
  const [diaShare, setDiaShare] = useState<GrupoDia | null>(null);
  const shotRef = useRef<View>(null);
  const capturando = useRef(false);

  const grupos = useMemo<GrupoDia[]>(
    () => (quadro ? agruparPorData(quadro.designacoes, quadro.mes) : []),
    [quadro],
  );

  const stats = useMemo(() => {
    const c: Record<string, number> = {};
    quadro?.designacoes.forEach((d) => {
      if (d.irmao1) c[d.irmao1] = (c[d.irmao1] ?? 0) + 1;
      if (d.irmao2) c[d.irmao2] = (c[d.irmao2] ?? 0) + 1;
    });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [quadro]);

  // Os dias que ainda vêm abrem a lista (o próximo primeiro); os que já
  // passaram descem para uma seção própria no fim — consultar o que vem é o
  // caso comum de abrir o quadro. Só a ORDEM de exibição muda: `grupos`
  // continua cronológico para o PDF e as regras de designação.
  const hoje = useHoje();
  const { proximos, anteriores } = useMemo(() => {
    const proximos: GrupoDia[] = [];
    const anteriores: GrupoDia[] = [];
    for (const g of grupos) {
      const d = quadro ? dataDoQuadro(g.data, quadro.mes, quadro.ano) : null;
      // Data ilegível não classifica: fica visível no topo, com os próximos.
      if (d && d.getTime() < hoje) anteriores.push(g);
      else proximos.push(g);
    }
    return { proximos, anteriores };
  }, [grupos, quadro, hoje]);

  if (isLoading || !quadro) {
    return <Loading label="Carregando quadro..." />;
  }

  const sc = statusConfig[quadro.status] ?? statusConfig.rascunho;
  const mesCurto = MESES_CURTO[quadro.mes] ?? "";

  const applyChange = async (cell: EditingCell, valor: string) => {
    // Optimistic cache update
    qc.setQueryData<Quadro>(qk.quadro(id), (old) =>
      old
        ? {
            ...old,
            designacoes: old.designacoes.map((d) =>
              d.data === cell.data && d.funcao === cell.funcao
                ? {
                    ...d,
                    [cell.campo]: valor,
                    // Espelha o backend: trocar o irmão zera a avaliação (V/X)
                    // da célula — ela era da escalação anterior.
                    ...(valor !== d[cell.campo]
                      ? { [cell.campo === "irmao1" ? "cumpriu1" : "cumpriu2"]: null }
                      : null),
                  }
                : d,
            ),
          }
        : old,
    );
    try {
      await atualizar.mutateAsync({
        data: cell.data,
        funcao: cell.funcao,
        campo: cell.campo,
        valor,
      });
      toast.show("Designação atualizada!");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao salvar", "error");
      refetch();
    }
  };

  const handleSelect = (valor: string) => {
    if (!editing) return;
    const cell = editing;
    if (valor && isDesignacaoSeguida(grupos, valor, cell.data)) {
      setPendingSeguida({ ...cell, valor });
      return;
    }
    applyChange(cell, valor);
  };

  /** O toque no V/X — otimista como a edição de célula, pelo mesmo motivo. */
  const avaliar = async (
    designacao: Designacao,
    campo: "irmao1" | "irmao2",
    cumpriu: boolean | null,
  ) => {
    const coluna = campo === "irmao1" ? "cumpriu1" : "cumpriu2";
    // Um refetch em voo (revalidação por staleTime, pull-to-refresh) leria o
    // banco de antes do toque e sobrescreveria o otimista — cancela primeiro.
    await qc.cancelQueries({ queryKey: qk.quadro(id) });
    qc.setQueryData<Quadro>(qk.quadro(id), (old) =>
      old
        ? {
            ...old,
            designacoes: old.designacoes.map((d) =>
              d.id === designacao.id ? { ...d, [coluna]: cumpriu } : d,
            ),
          }
        : old,
    );
    try {
      const salva = await marcarCumprimento.mutateAsync({
        designacaoId: designacao.id,
        campo,
        cumpriu,
      });
      // Regrava o que o servidor confirmou: se algum refetch passou no meio do
      // caminho, é isto que devolve a célula ao estado verdadeiro.
      qc.setQueryData<Quadro>(qk.quadro(id), (old) =>
        old
          ? {
              ...old,
              designacoes: old.designacoes.map((d) =>
                d.id === salva.id ? { ...d, ...salva } : d,
              ),
            }
          : old,
      );
      // A avaliação entra no histórico do quadro.
      qc.invalidateQueries({ queryKey: qk.historico(id) });
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Erro ao salvar avaliação",
        "error",
      );
      refetch();
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const html = gerarHtmlQuadro(quadro, grupos);
      const nomeMes = (MESES[quadro.mes] ?? "mes").toLowerCase();
      await exportarPdf(html, `quadro-designacoes-${nomeMes}-${quadro.ano}.pdf`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao gerar PDF", "error");
    } finally {
      setDownloading(false);
    }
  };

  /**
   * Chamado pelo onLayout do cartao escondido: so ali existe a garantia de que ele ja tem
   * tamanho. Capturar antes disso devolve uma imagem em branco.
   */
  const capturarDia = async () => {
    if (!diaShare || capturando.current) return;
    capturando.current = true;
    try {
      // Mais um quadro de render: o layout ja saiu, falta o texto terminar de pintar.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const nomeMes = (MESES[quadro.mes] ?? "mes").toLowerCase();
      const dia = diaShare.data.split("/")[0];
      await exportarImagem(shotRef, `designacoes-${dia}-${nomeMes}-${quadro.ano}.png`);
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Erro ao gerar imagem",
        "error",
      );
    } finally {
      setDiaShare(null);
      capturando.current = false;
    }
  };

  const buildOptions = (cell: EditingCell): SelectOption[] => {
    const elegiveis = getIrmaosParaFuncao(irmaos, cell.funcao);
    return elegiveis.map((irmao) => {
      const indis = isIndisponivel(irmaos, irmao.nome, cell.data);
      const seguida = isDesignacaoSeguida(grupos, irmao.nome, cell.data);
      const mesmoDia = isDesignadoNoMesmoDia(
        grupos,
        irmao.nome,
        cell.data,
        cell.funcao,
        cell.campo,
      );
      let color: string | undefined;
      let badge: string | undefined;
      if (mesmoDia) {
        color = colors.primaryDark;
        badge = "Já hoje";
      } else if (indis) {
        color = colors.redDark;
        badge = "Indisponível";
      } else if (seguida) {
        color = colors.warningStrong;
        badge = "Seguida";
      }
      return {
        value: irmao.nome,
        label: irmao.nome,
        color,
        badge,
        disabled: mesmoDia,
      };
    });
  };

  const cellState = (nome: string, data: string, funcao: string, campo: "irmao1" | "irmao2") => {
    if (!nome) return undefined;
    if (isDesignadoNoMesmoDia(grupos, nome, data, funcao, campo))
      return { color: colors.primaryDark, bg: colors.infoBg };
    if (isIndisponivel(irmaos, nome, data))
      return { color: colors.redDark, strike: true };
    if (isDesignacaoSeguida(grupos, nome, data))
      return { color: colors.warningStrong, bg: colors.warningBg };
    return undefined;
  };

  return (
    <View style={styles.flex}>
      <GradientHeader
        title={`${MESES_CURTO[quadro.mes]} ${quadro.ano}`}
        description={`${quadro.designacoes.length} designações`}
        icon="document-text"
        showBack
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Status + ações */}
        <View style={styles.actionsCard}>
          <Badge label={sc.label} color={sc.color} bg={sc.bg} />
          <View style={styles.actionsRow}>
            {!podeEditar ? null : quadro.status === "rascunho" ? (
              <Button
                label="Publicar"
                icon="checkmark"
                variant="success"
                loading={status.isPending}
                onPress={async () => {
                  try {
                    await status.mutateAsync("publicado");
                    toast.show("Quadro publicado!");
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
                    toast.show("Quadro arquivado!");
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
                  toast.show("Publique o quadro para baixar o PDF", "info");
                  return;
                }
                handleDownloadPDF();
              }}
            />
            {podeEditar ? (
            <Button
              label="Excluir"
              icon="trash"
              variant="danger"
              onPress={() =>
                confirm.confirm({
                  title: "Excluir Quadro",
                  message: `Deseja excluir o quadro de ${MESES_CURTO[quadro.mes]} ${quadro.ano}? Esta ação não pode ser desfeita.`,
                  type: "danger",
                  confirmText: "Sim, excluir",
                  onConfirm: async () => {
                    try {
                      await excluir.mutateAsync(id);
                      toast.show("Quadro excluído!");
                      confirm.close();
                      router.back();
                    } catch {
                      toast.show("Erro ao excluir", "error");
                    }
                  },
                })
              }
            />
            ) : null}
          </View>
        </View>

        {/* Dias: os próximos primeiro (o próximo abre a lista); os que já
            passaram descem para a seção "Reuniões anteriores" no fim. */}
        {proximos.length > 0 ? (
          <View style={styles.proximoBadge}>
            <Ionicons name="star" size={12} color={colors.textOnPrimary} />
            <Text style={styles.proximoBadgeTexto}>Próxima reunião</Text>
          </View>
        ) : null}
        {[...proximos, ...anteriores].map((grupo, idx) => (
          <Fragment key={grupo.data}>
            {idx === proximos.length && anteriores.length > 0 ? (
              <Text style={styles.anterioresTitulo}>Reuniões anteriores</Text>
            ) : null}
          <View style={styles.diaCard}>
            <View style={styles.diaHeader}>
              <View style={styles.diaDate}>
                <Text style={styles.diaNumero}>{grupo.data.split("/")[0]}</Text>
                <Text style={styles.diaMes}>{mesCurto}</Text>
              </View>
              <View style={styles.diaBadge}>
                <Text style={styles.diaBadgeText}>{grupo.dia}</Text>
              </View>
              <Pressable
                hitSlop={8}
                style={styles.shareDia}
                disabled={!!diaShare}
                onPress={() => setDiaShare(grupo)}
              >
                {diaShare?.data === grupo.data ? (
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                ) : (
                  <Ionicons
                    name="share-social-outline"
                    size={16}
                    color={colors.primaryDark}
                  />
                )}
              </Pressable>
              {podeEditar ? (
              <Pressable
                hitSlop={8}
                style={styles.deleteDia}
                onPress={() =>
                  confirm.confirm({
                    title: "Excluir dia",
                    message: `Excluir todas as designações de ${grupo.data}? Informe o motivo:`,
                    type: "danger",
                    withInput: true,
                    inputPlaceholder: "Ex: Reunião cancelada",
                    confirmText: "Excluir",
                    onConfirm: async (motivo) => {
                      try {
                        await excluirDia.mutateAsync({ data: grupo.data, motivo });
                        toast.show("Dia excluído!");
                        confirm.close();
                      } catch {
                        toast.show("Erro ao excluir dia", "error");
                      }
                    },
                  })
                }
              >
                <Ionicons name="trash-outline" size={16} color={colors.redDark} />
              </Pressable>
              ) : null}
            </View>

            {ordenarFuncoes(grupo.funcoes).map((f) => (
              <View key={f.funcao} style={styles.funcaoRow}>
                <Text style={styles.funcaoLabel}>{f.funcao}</Text>
                <View style={styles.cellsRow}>
                  {(["irmao1", "irmao2"] as const).map((campo) => {
                    const nome = f[campo];
                    const st = cellState(nome, grupo.data, f.funcao, campo);
                    const cumpriu =
                      (campo === "irmao1" ? f.cumpriu1 : f.cumpriu2) ?? null;
                    return (
                      <Pressable
                        key={campo}
                        style={[
                          styles.cell,
                          st?.bg ? { backgroundColor: st.bg } : null,
                        ]}
                        disabled={!podeEditar}
                        onPress={() =>
                          setEditing({ data: grupo.data, funcao: f.funcao, campo })
                        }
                      >
                        <View style={styles.cellInner}>
                          <Text
                            style={[
                              styles.cellText,
                              st?.color ? { color: st.color } : null,
                              st?.strike ? styles.strike : null,
                              !nome && styles.cellEmpty,
                            ]}
                            numberOfLines={1}
                          >
                            {nome || "—"}
                          </Text>
                          {/* Só quem cuida de designações vê o cumprimento — para os
                              demais o backend nem manda o campo. */}
                          {nome && podeEditar ? (
                            <MarcadorCumprimento
                              valor={cumpriu}
                              onChange={(v) => avaliar(f, campo, v)}
                            />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
          </Fragment>
        ))}

        {/* Estatísticas */}
        <Pressable
          style={styles.accordionHeader}
          onPress={() => setShowStats((s) => !s)}
        >
          <Text style={styles.panelTitle}>📊 Estatísticas do Mês</Text>
          <Ionicons
            name={showStats ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>
        {showStats ? (
          <View style={styles.panel}>
            {stats.length === 0 ? (
              <Text style={styles.panelEmpty}>Nenhuma designação definida</Text>
            ) : (
              stats.map(([nome, count], i) => (
                <View key={nome} style={styles.statRow}>
                  <Text style={styles.statNome}>{nome}</Text>
                  <View
                    style={[
                      styles.statBadge,
                      i === 0 && { backgroundColor: colors.green },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statBadgeText,
                        // surface, não textOnPrimary: no escuro colors.green
                        // clareia e o texto precisa escurecer junto.
                        i === 0 && { color: colors.surface },
                      ]}
                    >
                      {count}x
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {/* Histórico */}
        <Pressable
          style={styles.accordionHeader}
          onPress={() => setShowHistorico((s) => !s)}
        >
          <Text style={styles.panelTitle}>🕓 Histórico de Alterações</Text>
          <Ionicons
            name={showHistorico ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>
        {showHistorico ? <HistoricoList quadroId={id} /> : null}
      </ScrollView>

      {/* Fora da tela de proposito: precisa estar montado e com layout para o view-shot
          capturar, mas nao pode aparecer para o usuario. */}
      {diaShare ? (
        <View style={styles.shotHost} pointerEvents="none" onLayout={capturarDia}>
          <DiaShareCard ref={shotRef} quadro={quadro} grupo={diaShare} />
        </View>
      ) : null}

      <SelectSheet
        visible={!!editing}
        title={editing ? `${editing.funcao} • ${editing.data}` : ""}
        options={editing ? buildOptions(editing) : []}
        selected={
          editing
            ? grupos
                .find((g) => g.data === editing.data)
                ?.funcoes.find((f) => f.funcao === editing.funcao)?.[editing.campo]
            : undefined
        }
        onSelect={handleSelect}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        config={
          pendingSeguida
            ? {
                title: "Designação Seguida",
                message: `${pendingSeguida.valor} já está em uma designação próxima a esta data. Deseja continuar mesmo assim?`,
                type: "warning",
                confirmText: "Continuar",
                onConfirm: () => {
                  const p = pendingSeguida;
                  setPendingSeguida(null);
                  applyChange(p, p.valor);
                },
              }
            : confirm.config
        }
        onClose={() => {
          if (pendingSeguida) setPendingSeguida(null);
          else confirm.close();
        }}
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    gap: 12,
  },
  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  diaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
  },
  proximoBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
    marginBottom: -4,
  },
  proximoBadgeTexto: {
    color: colors.textOnPrimary,
    fontSize: 11.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  anterioresTitulo: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 10,
  },
  diaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  diaDate: { alignItems: "center", minWidth: 44 },
  diaNumero: { fontSize: 28, fontWeight: "600", color: colors.terracotta },
  diaMes: { fontSize: 10, fontWeight: "700", color: colors.mesEtiqueta, letterSpacing: 1 },
  diaBadge: {
    flex: 1,
    backgroundColor: colors.infoBg,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  diaBadgeText: { color: colors.primaryDark, fontWeight: "700" },
  shareDia: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.infoBg,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteDia: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  // Longe da area visivel, sem opacity 0: view invisivel por opacidade sai em branco no
  // print de alguns Android.
  shotHost: { position: "absolute", left: -10000, top: 0 },
  funcaoRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 6,
  },
  funcaoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  cellsRow: { flexDirection: "row", gap: 8 },
  cell: {
    flex: 1,
    backgroundColor: colors.slotBg,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.slotBorder,
  },
  cellInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  cellText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  cellEmpty: { color: colors.textMuted, fontWeight: "400" },
  strike: { textDecorationLine: "line-through" },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
  },
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
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
  },
});
