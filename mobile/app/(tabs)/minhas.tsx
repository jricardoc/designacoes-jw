import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMinhasDesignacoes } from "@/api/hooks/useMinhasDesignacoes";
import type { Compromisso, TipoCompromisso } from "@/api/types";
import { GradientHeader, Loading } from "@/components/ui";
import { PrivilegioBadge } from "@/components/PrivilegioBadge";
import { colors, radius } from "@/theme";

const TIPOS: Record<TipoCompromisso, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  designacao: { label: "Quadro de designações", icon: "document-text", color: "#6E7B57", bg: "#E9EFDC" },
  dirigente: { label: "Saída de campo", icon: "compass", color: "#9A5A38", bg: "#F1E1D2" },
  reuniao: { label: "Reunião", icon: "people", color: "#2F6F7E", bg: "#E4EFF2" },
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function rotuloDoMes(dataISO: string | null): string {
  if (!dataISO) return "Sem data definida";
  const [ano, mes] = dataISO.split("-").map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

export default function MinhasScreen() {
  const [escopo, setEscopo] = useState<"proximas" | "todas">("proximas");
  const { data, isLoading, refetch, isRefetching } = useMinhasDesignacoes(escopo);

  const grupos = useMemo(() => {
    const out: { mes: string; itens: Compromisso[] }[] = [];
    for (const c of data?.compromissos ?? []) {
      const chave = rotuloDoMes(c.dataISO);
      if (!out.length || out[out.length - 1].mes !== chave) out.push({ mes: chave, itens: [] });
      out[out.length - 1].itens.push(c);
    }
    return out;
  }, [data]);

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Minhas Designações"
        description={data?.irmao ? data.irmao.nome : "Seus compromissos"}
        icon="calendar"
      />

      {isLoading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {!data?.vinculado ? (
            <View style={styles.aviso}>
              <Ionicons name="link-outline" size={34} color="#C6BAA0" />
              <Text style={styles.avisoTitulo}>Conta ainda não vinculada</Text>
              <Text style={styles.avisoTexto}>{data?.mensagem}</Text>
            </View>
          ) : (
            <>
              <View style={styles.filtros}>
                {(["proximas", "todas"] as const).map((op) => {
                  const ativo = escopo === op;
                  return (
                    <Pressable
                      key={op}
                      onPress={() => setEscopo(op)}
                      style={[styles.filtro, ativo && styles.filtroAtivo]}
                    >
                      <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}>
                        {op === "proximas" ? "Próximas" : "Todas"}
                      </Text>
                    </Pressable>
                  );
                })}
                {data.irmao?.privilegio ? (
                  <View style={{ marginLeft: "auto" }}>
                    <PrivilegioBadge privilegio={data.irmao.privilegio} size="sm" abreviado />
                  </View>
                ) : null}
              </View>

              {grupos.length === 0 ? (
                <View style={styles.aviso}>
                  <Ionicons name="calendar-outline" size={34} color="#C6BAA0" />
                  <Text style={styles.avisoTitulo}>
                    {escopo === "proximas" ? "Nenhum compromisso à frente" : "Nenhuma designação"}
                  </Text>
                  <Text style={styles.avisoTexto}>
                    {escopo === "proximas"
                      ? 'Você não tem designações a partir de hoje. Toque em "Todas" para ver o histórico.'
                      : "Seu nome ainda não aparece em nenhum quadro, escala ou programação."}
                  </Text>
                </View>
              ) : (
                grupos.map((grupo, gi) => (
                  <View key={grupo.mes} style={{ marginBottom: 18 }}>
                    <Text style={styles.mesLabel}>{grupo.mes}</Text>
                    {grupo.itens.map((c, i) => {
                      const tipo = TIPOS[c.tipo] ?? TIPOS.designacao;
                      const rascunho = c.origem?.status === "rascunho";
                      return (
                        <Animated.View
                          key={c.id}
                          entering={FadeInDown.delay(Math.min((gi * 4 + i) * 25, 300)).duration(240)}
                          style={styles.card}
                        >
                          <View style={styles.dataBox}>
                            <Text style={styles.dataDia}>{c.data ? c.data.split("/")[0] : "—"}</Text>
                            <Text style={styles.dataSemana}>{(c.diaSemana || "").slice(0, 3)}</Text>
                          </View>

                          <View style={[styles.iconeBox, { backgroundColor: tipo.bg }]}>
                            <Ionicons name={tipo.icon} size={15} color={tipo.color} />
                          </View>

                          <View style={styles.flex}>
                            <View style={styles.tituloLinha}>
                              <Text style={styles.titulo} numberOfLines={2}>{c.titulo}</Text>
                              {c.papel ? (
                                <View style={[styles.tag, { backgroundColor: tipo.bg }]}>
                                  <Text style={[styles.tagTexto, { color: tipo.color }]}>{c.papel}</Text>
                                </View>
                              ) : null}
                              {rascunho ? (
                                <View style={[styles.tag, { backgroundColor: "#F1E1D2" }]}>
                                  <Text style={[styles.tagTexto, { color: "#9A5A38" }]}>Rascunho</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.detalhe} numberOfLines={2}>
                              {[tipo.label, c.detalhe, c.local, c.horario].filter(Boolean).join(" · ")}
                            </Text>
                            {c.dataAproximada ? (
                              <Text style={styles.aproximada}>
                                Data aproximada — confira na programação
                              </Text>
                            ) : null}
                          </View>
                        </Animated.View>
                      );
                    })}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 32 },
  flex: { flex: 1, minWidth: 0 },

  filtros: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  filtro: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  filtroAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  filtroTexto: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  filtroTextoAtivo: { color: colors.textOnPrimary },

  mesLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 8,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#EFE7D8",
    padding: 12,
    marginBottom: 8,
  },
  dataBox: {
    width: 42,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#ECE3D3",
    paddingRight: 10,
  },
  dataDia: { fontSize: 17, fontWeight: "700", color: colors.text },
  dataSemana: { fontSize: 9.5, color: colors.textMuted, textTransform: "uppercase" },
  iconeBox: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },

  tituloLinha: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  titulo: { fontSize: 14.5, fontWeight: "600", color: colors.text, flexShrink: 1 },
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  tagTexto: { fontSize: 10, fontWeight: "700" },
  detalhe: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  aproximada: { fontSize: 11, color: "#9A5A38", marginTop: 3 },

  aviso: { alignItems: "center", paddingVertical: 46, paddingHorizontal: 24, gap: 8 },
  avisoTitulo: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: 4 },
  avisoTexto: { fontSize: 13.5, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
