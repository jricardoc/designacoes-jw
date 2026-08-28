import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCumprimento } from "@/api/hooks/useCumprimento";
import type { OrigemCumprimento, RegistroCumprimento } from "@/api/types";
import { Button, EmptyState, GradientHeader, Loading } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/** "dd/MM/yyyy" → Date (registro ilegível vai para o fim). */
function dataDe(r: RegistroCumprimento): Date {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(r.data);
  if (!m) return new Date(0);
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

interface LinhaIrmao {
  nome: string;
  total: number;
  cumpridas: number;
  faltas: number;
  registros: RegistroCumprimento[];
}

/** Quantas avaliações aparecem no detalhe expandido antes do "+N". */
const DETALHE_MAX = 15;

type Periodo = "3m" | "tudo";
type FiltroOrigem = "todas" | OrigemCumprimento;

/**
 * Análise do cumprimento das participações: agrega o V/X marcado nas telas de
 * Designações e Dirigentes por irmão — quem tem faltas sobe para o topo, que é
 * exatamente o que quem cuida das escalas precisa ver primeiro.
 *
 * Restringida a quem gerencia designações ou dirigentes (o backend também
 * exige o escopo em GET /cumprimento).
 */
export default function CumprimentoScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
  const veDesignacoes = podeGerenciar(usuario, "designacoes");
  const veDirigentes = podeGerenciar(usuario, "dirigentes");
  const podeVer = veDesignacoes || veDirigentes;
  // Só quem cuida das DUAS áreas escolhe entre elas — para os demais o backend manda uma só,
  // e um filtro "Dirigentes" que devolve lista vazia parece dado faltando, não permissão.
  const escolheOrigem = veDesignacoes && veDirigentes;
  const { data, isLoading, isError, refetch, isRefetching } =
    useCumprimento(podeVer);

  const [periodo, setPeriodo] = useState<Periodo>("3m");
  const [origem, setOrigem] = useState<FiltroOrigem>("todas");
  const [expandido, setExpandido] = useState<string | null>(null);

  const registros = useMemo(() => {
    const todos = data?.registros ?? [];
    // Dia clampado: num dia 31, "3 meses atrás" pode não existir e o Date
    // transbordaria para o mês seguinte (31/fev → 03/mar), comendo registros
    // da borda do filtro. Se o dia estourou, volta ao último dia do mês alvo.
    const hoje = new Date();
    const corte = new Date(hoje.getFullYear(), hoje.getMonth() - 3, hoje.getDate());
    if (corte.getDate() !== hoje.getDate()) corte.setDate(0);
    corte.setHours(0, 0, 0, 0);
    return todos.filter((r) => {
      if (origem !== "todas" && r.origem !== origem) return false;
      if (periodo === "3m" && dataDe(r).getTime() < corte.getTime()) return false;
      return true;
    });
  }, [data, periodo, origem]);

  const linhas = useMemo<LinhaIrmao[]>(() => {
    const map = new Map<string, LinhaIrmao>();
    for (const r of registros) {
      const linha =
        map.get(r.nome) ??
        { nome: r.nome, total: 0, cumpridas: 0, faltas: 0, registros: [] };
      linha.total += 1;
      if (r.cumpriu) linha.cumpridas += 1;
      else linha.faltas += 1;
      linha.registros.push(r);
      map.set(r.nome, linha);
    }
    // Faltas primeiro: é quem esta tela existe para mostrar.
    return [...map.values()].sort(
      (a, b) =>
        b.faltas - a.faltas || b.total - a.total || a.nome.localeCompare(b.nome),
    );
  }, [registros]);

  const cumpridas = registros.filter((r) => r.cumpriu).length;
  const taxa =
    registros.length > 0 ? Math.round((cumpridas / registros.length) * 100) : 0;
  const comFaltas = linhas.filter((l) => l.faltas > 0).length;

  const chip = (ativo: boolean, rotulo: string, onPress: () => void) => (
    <Pressable
      key={rotulo}
      style={[styles.chip, ativo && styles.chipAtivo]}
      onPress={onPress}
    >
      <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
        {rotulo}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.flex}>
      <GradientHeader
        title="Cumprimento"
        description="Quem está cumprindo as participações"
        icon="checkmark-done"
        showBack
      />

      {!podeVer ? (
        <EmptyState
          icon="lock-closed-outline"
          title="Acesso restrito"
          message="A análise de cumprimento é para quem gerencia designações ou dirigentes."
        />
      ) : isLoading ? (
        <Loading label="Carregando avaliações..." />
      ) : isError ? (
        // Sem isto, falha de rede/permissão viraria "Nenhuma avaliação ainda" —
        // uma conclusão de negócio errada apresentada como dado.
        <EmptyState
          icon="cloud-offline"
          title="Não foi possível carregar as avaliações"
          message="Verifique a conexão e tente novamente."
        >
          <Button label="Tentar de novo" onPress={() => refetch()} />
        </EmptyState>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        >
          <View style={styles.filtros}>
            <View style={styles.chipsRow}>
              {chip(periodo === "3m", "Últimos 3 meses", () => setPeriodo("3m"))}
              {chip(periodo === "tudo", "Tudo", () => setPeriodo("tudo"))}
            </View>
            {escolheOrigem ? (
              <View style={styles.chipsRow}>
                {chip(origem === "todas", "Todas", () => setOrigem("todas"))}
                {chip(origem === "designacoes", "Designações", () =>
                  setOrigem("designacoes"),
                )}
                {chip(origem === "dirigentes", "Dirigentes", () =>
                  setOrigem("dirigentes"),
                )}
              </View>
            ) : null}
          </View>

          {registros.length === 0 ? (
            <EmptyState
              icon="checkmark-done-outline"
              title="Nenhuma avaliação ainda"
              message="Use o ✓ e o ✗ ao lado dos nomes nos quadros de designações e nas escalas de dirigentes — os resultados aparecem aqui."
            />
          ) : (
            <>
              <View style={styles.resumo}>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValor}>{registros.length}</Text>
                  <Text style={styles.resumoLegenda}>avaliadas</Text>
                </View>
                <View style={styles.resumoDivisor} />
                <View style={styles.resumoItem}>
                  <Text style={[styles.resumoValor, { color: colors.green }]}>
                    {taxa}%
                  </Text>
                  <Text style={styles.resumoLegenda}>cumprimento</Text>
                </View>
                <View style={styles.resumoDivisor} />
                <View style={styles.resumoItem}>
                  <Text
                    style={[
                      styles.resumoValor,
                      comFaltas > 0 && { color: colors.red },
                    ]}
                  >
                    {comFaltas}
                  </Text>
                  <Text style={styles.resumoLegenda}>
                    {comFaltas === 1 ? "irmão com falta" : "irmãos com faltas"}
                  </Text>
                </View>
              </View>

              <View style={styles.lista}>
                {linhas.map((linha) => {
                  const pct = Math.round((linha.cumpridas / linha.total) * 100);
                  const aberto = expandido === linha.nome;
                  const detalhe = aberto
                    ? linha.registros.slice(0, DETALHE_MAX)
                    : [];
                  return (
                    <View key={linha.nome} style={styles.irmaoCard}>
                      <Pressable
                        style={styles.irmaoHeader}
                        onPress={() =>
                          setExpandido(aberto ? null : linha.nome)
                        }
                      >
                        <View style={styles.irmaoTextos}>
                          <Text style={styles.irmaoNome} numberOfLines={1}>
                            {linha.nome}
                          </Text>
                          <Text style={styles.irmaoSub}>
                            {linha.cumpridas} de {linha.total} cumprida
                            {linha.total === 1 ? "" : "s"}
                            {linha.faltas > 0
                              ? ` · ${linha.faltas} falta${linha.faltas === 1 ? "" : "s"}`
                              : ""}
                          </Text>
                          <View style={styles.barraTrilho}>
                            <View
                              style={[
                                styles.barraCheia,
                                {
                                  width: `${pct}%`,
                                  backgroundColor:
                                    linha.faltas > 0 ? colors.amber : colors.green,
                                },
                              ]}
                            />
                          </View>
                        </View>
                        <View style={styles.irmaoDireita}>
                          <Text
                            style={[
                              styles.irmaoPct,
                              { color: linha.faltas > 0 ? colors.amber : colors.green },
                            ]}
                          >
                            {pct}%
                          </Text>
                          <Ionicons
                            name={aberto ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={colors.textMuted}
                          />
                        </View>
                      </Pressable>

                      {aberto ? (
                        <View style={styles.detalhe}>
                          {detalhe.map((r, i) => (
                            <View
                              // Posicional: a lista é um recorte ordenado e imutável.
                              key={i}
                              style={styles.detalheRow}
                            >
                              <Ionicons
                                name={r.cumpriu ? "checkmark-circle" : "close-circle"}
                                size={16}
                                color={r.cumpriu ? colors.green : colors.red}
                              />
                              <View style={styles.detalheTextos}>
                                <Text style={styles.detalheRotulo} numberOfLines={1}>
                                  {r.rotulo}
                                </Text>
                                <Text style={styles.detalheData}>
                                  {r.data.slice(0, 5)} ·{" "}
                                  {r.origem === "designacoes"
                                    ? "Designações"
                                    : "Dirigentes"}
                                </Text>
                              </View>
                            </View>
                          ))}
                          {linha.registros.length > DETALHE_MAX ? (
                            <Text style={styles.detalheMais}>
                              +{linha.registros.length - DETALHE_MAX} avaliações
                              mais antigas
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 40, gap: 14 },
    filtros: { gap: 8 },
    chipsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    chip: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTexto: { fontSize: 12.5, fontWeight: "700", color: colors.textSecondary },
    chipTextoAtivo: { color: colors.textOnPrimary },
    resumo: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingVertical: 14,
      paddingHorizontal: 8,
    },
    resumoItem: { flex: 1, alignItems: "center", gap: 2 },
    resumoDivisor: { width: 1, height: 30, backgroundColor: colors.border },
    resumoValor: { fontSize: 22, fontWeight: "800", color: colors.text },
    resumoLegenda: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: "center",
    },
    lista: { gap: 10 },
    irmaoCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    irmaoHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    irmaoTextos: { flex: 1, gap: 3 },
    irmaoNome: { fontSize: 15, fontWeight: "700", color: colors.text },
    irmaoSub: { fontSize: 12, color: colors.textSecondary },
    barraTrilho: {
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
      marginTop: 3,
    },
    barraCheia: { height: "100%", borderRadius: radius.pill },
    irmaoDireita: { alignItems: "flex-end", gap: 4 },
    irmaoPct: { fontSize: 16, fontWeight: "800" },
    detalhe: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 2,
    },
    detalheRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 5,
    },
    detalheTextos: { flex: 1 },
    detalheRotulo: { fontSize: 13, fontWeight: "600", color: colors.text },
    detalheData: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
    detalheMais: {
      fontSize: 12,
      color: colors.textMuted,
      paddingVertical: 6,
      textAlign: "center",
    },
  });
