import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApagarSaida, useHistoricoTerritorio, useRetirarMarcacao, useTerritorio } from "@/api/hooks/useTerritorios";
import type { HistoricoTerritorio, SaidaTerritorio } from "@/api/types";
import { EmptyState, GradientHeader, Loading, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { CASA_TRABALHADA, MARCACOES } from "@/territorios/constantes";

type Evento =
  | { tipo: "saida"; dia: string; quando: string; saida: SaidaTerritorio }
  | { tipo: "marcacao"; dia: string; quando: string; marcacao: HistoricoTerritorio["marcacoes"][number] };

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function tituloDoDia(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const data = new Date(a, m - 1, d);
  return `${DIAS[data.getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
}

/** Tudo que aconteceu no território, dia a dia: saídas e pontos marcados, inclusive retirados. */
export default function HistoricoTerritorioScreen() {
  const { numero } = useLocalSearchParams<{ numero: string }>();
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { usuario } = useAuth();
  const { data: t } = useTerritorio(numero);
  const { data, isLoading, refetch, isRefetching } = useHistoricoTerritorio(numero);
  const apagar = useApagarSaida();
  const retirar = useRetirarMarcacao();

  const dias = useMemo(() => {
    if (!data) return [];
    const eventos: Evento[] = [
      ...data.saidas.map((s) => ({ tipo: "saida" as const, dia: s.dia, quando: s.createdAt, saida: s })),
      ...data.marcacoes.map((m) => ({
        tipo: "marcacao" as const,
        dia: m.marcadaEm.slice(0, 10),
        quando: m.marcadaEm,
        marcacao: m,
      })),
    ].sort((a, b) => b.dia.localeCompare(a.dia) || b.quando.localeCompare(a.quando));
    const porDia = new Map<string, Evento[]>();
    for (const e of eventos) porDia.set(e.dia, [...(porDia.get(e.dia) ?? []), e]);
    return [...porDia];
  }, [data]);

  if (isLoading) return <Loading label="Carregando histórico..." />;

  const podeApagar = (s: SaidaTerritorio) => !!t?.permissoes.gerenciar || s.autor?.id === usuario?.id;
  const podeRetirar = (autorId?: number) => !!t?.permissoes.gerenciar || (!!autorId && autorId === usuario?.id);

  return (
    <View style={styles.flex}>
      <GradientHeader title="Histórico" description={t ? `Território ${t.numero} · ${t.nome}` : undefined} showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {dias.length === 0 ? (
          <EmptyState icon="time-outline" title="Nada registrado ainda" message="As saídas e os pontos marcados aparecem aqui." />
        ) : null}
        {dias.map(([dia, eventos]) => (
          <View key={dia} style={styles.dia}>
            <Text style={styles.diaTitulo}>{tituloDoDia(dia)}</Text>
            {eventos.map((e) =>
              e.tipo === "saida" ? (
                <View key={`s-${e.saida.id}`} style={styles.item}>
                  <Ionicons
                    name={e.saida.concluiu ? "checkmark-circle" : "flag"}
                    size={22}
                    color={e.saida.concluiu ? colors.greenDark : MARCACOES.parada.cor(colors)}
                  />
                  <View style={styles.itemTextos}>
                    <Text style={styles.itemTitulo}>
                      {e.saida.concluiu ? "Território concluído" : `Pararam em: ${e.saida.ondeParou ?? "ponto no mapa"}`}
                    </Text>
                    {e.saida.quadra ? <Text style={styles.itemSub}>{e.saida.quadra.nome}</Text> : null}
                    {e.saida.casaTrabalhada ? (
                      <Text style={styles.itemSub}>Casa trabalhada: {CASA_TRABALHADA[e.saida.casaTrabalhada].rotulo}</Text>
                    ) : null}
                    {e.saida.proximoInicio ? <Text style={styles.itemSub}>Próxima: {e.saida.proximoInicio}</Text> : null}
                    {e.saida.pendente ? <Text style={styles.itemSub}>Pendente: {e.saida.pendente}</Text> : null}
                    <Text style={styles.itemAutor}>{e.saida.autor?.nome ?? "—"}</Text>
                    {e.saida.status !== "ativa" ? (
                      <Text style={styles.status}>
                        {e.saida.status === "conflito" ? "Aguardando revisão" : "Descartado na revisão"}
                      </Text>
                    ) : null}
                  </View>
                  {podeApagar(e.saida) ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        Alert.alert("Apagar este registro?", "Use quando foi registrado por engano.", [
                          { text: "Cancelar", style: "cancel" },
                          {
                            text: "Apagar",
                            style: "destructive",
                            onPress: () =>
                              apagar.mutate(e.saida.id, {
                                onSuccess: () => toast.show("Registro apagado"),
                                onError: (err) => toast.show(err.message, "error"),
                              }),
                          },
                        ])
                      }
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <View key={`m-${e.marcacao.id}`} style={[styles.item, !e.marcacao.ativo && styles.retirado]}>
                  <View style={[styles.bolinha, { backgroundColor: MARCACOES[e.marcacao.tipo].cor(colors) }]}>
                    <Text style={styles.bolinhaLetra}>{MARCACOES[e.marcacao.tipo].letra}</Text>
                  </View>
                  <View style={styles.itemTextos}>
                    <Text style={styles.itemTitulo}>{MARCACOES[e.marcacao.tipo].rotulo}</Text>
                    {e.marcacao.texto ? <Text style={styles.itemSub}>{e.marcacao.texto}</Text> : null}
                    <Text style={styles.itemAutor}>
                      {e.marcacao.autor?.nome ?? "—"} ·{" "}
                      {new Date(e.marcacao.marcadaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {e.marcacao.ativo ? "" : " · retirado"}
                    </Text>
                  </View>
                  {e.marcacao.ativo && podeRetirar(e.marcacao.autor?.id) ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        Alert.alert("Remover esta marcação?", "Ela sai do mapa para todos.", [
                          { text: "Cancelar", style: "cancel" },
                          {
                            text: "Remover",
                            style: "destructive",
                            onPress: () =>
                              retirar.mutate(e.marcacao.id, {
                                onSuccess: () => toast.show("Marcação removida"),
                                onError: (err) => toast.show(err.message, "error"),
                              }),
                          },
                        ])
                      }
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              ),
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 18 },
    dia: { gap: 8 },
    diaTitulo: { fontSize: 13, fontWeight: "800", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
    item: {
      flexDirection: "row",
      gap: 12,
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    retirado: { opacity: 0.55 },
    itemTextos: { flex: 1, gap: 2 },
    itemTitulo: { fontSize: 15, fontWeight: "700", color: colors.text },
    itemSub: { fontSize: 13.5, color: colors.textSecondary },
    itemAutor: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
    status: { fontSize: 12.5, fontWeight: "800", color: colors.amber },
    bolinha: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    bolinhaLetra: { color: "#fff", fontWeight: "900", fontSize: 12 },
  });
