import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAssistencias } from "@/api/hooks/useReunioes";
import type { AssistenciaReuniao, TipoAssistencia } from "@/api/types";
import { EmptyState, GradientHeader, Loading } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { DIAS_CURTOS, radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import {
  chaveMes,
  mesesAte,
  nomeMes,
  resumoDoMes,
  reunioesDoMes,
  somarMeses,
  variacao,
  type ResumoMes,
} from "@/utils/assistenciaMensal";
import { podeGerenciar } from "@/utils/permissoes";
import { usePuxar } from "@/utils/usePuxar";

type Filtro = "todas" | TipoAssistencia;

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "meio", rotulo: "Meio de semana" },
  { id: "fds", rotulo: "Fim de semana" },
];

const ROTULO: Record<TipoAssistencia, string> = { meio: "Meio de semana", fds: "Fim de semana" };

const hojeMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "16/10/2026" -> "Qui, 16/10" */
function diaDaReuniao(data: string) {
  const [d, m, a] = data.split("/").map(Number);
  return `${DIAS_CURTOS[new Date(a, m - 1, d).getDay()]}, ${data.slice(0, 5)}`;
}

/**
 * A assistência por mês: médias de cada reunião, comparação com o mês anterior, os últimos
 * 12 meses num gráfico e as reuniões do mês. Quem cuida das reuniões abre, em cada reunião,
 * quem assistiu pelo Zoom.
 *
 * As contas são do app (utils/assistenciaMensal), em cima de GET /reunioes/assistencias:
 * duas linhas por semana não pedem endpoint de agregação.
 */
export default function AssistenciaMensalScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const { usuario } = useAuth();
  const podeRegistrar = podeGerenciar(usuario, "reunioes");
  const { data: assistencias, isLoading, refetch } = useAssistencias();
  const puxar = usePuxar(refetch);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const registros = useMemo(() => assistencias ?? [], [assistencias]);
  // Abre no mês mais recente com registro: no começo do mês, o atual ainda está vazio.
  const ultimoComDados = useMemo(
    () => registros.map((r) => chaveMes(r.data)).filter((m): m is string => !!m).sort().pop(),
    [registros],
  );
  const atual = hojeMes();
  const mes = escolhido ?? ultimoComDados ?? atual;
  const tipo = filtro === "todas" ? undefined : filtro;
  const tipos: TipoAssistencia[] = tipo ? [tipo] : ["meio", "fds"];
  const corDe = (t: TipoAssistencia) => (t === "meio" ? colors.purple : colors.amber);

  const meses = useMemo(() => mesesAte(mes, 12), [mes]);
  const grafico = useMemo(
    () => meses.map((m) => ({ mes: m, valores: tipos.map((t) => resumoDoMes(registros, m, t)?.media ?? 0) })),
    // `tipos` sai de `filtro`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meses, registros, filtro],
  );
  const maior = Math.max(1, ...grafico.flatMap((g) => g.valores));
  const doMes = reunioesDoMes(registros, mes, tipo);

  if (isLoading) return <Loading label="Carregando a assistência..." />;

  const cartao = (t: TipoAssistencia) => {
    const r: ResumoMes | null = resumoDoMes(registros, mes, t);
    const antes = resumoDoMes(registros, somarMeses(mes, -1), t);
    const v = r ? variacao(r.media, antes?.media) : null;
    return (
      <View key={t} style={styles.cartao}>
        <View style={styles.cartaoTopo}>
          <View style={[styles.ponto, { backgroundColor: corDe(t) }]} />
          <Text style={styles.cartaoRotulo}>{ROTULO[t]}</Text>
        </View>
        {r ? (
          <>
            <Text style={styles.media}>{r.media}</Text>
            <Text style={styles.mediaLegenda}>média por reunião</Text>
            <View style={styles.quebra}>
              <View style={styles.quebraItem}>
                <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.quebraTexto}>{r.mediaPresencial}</Text>
              </View>
              <View style={styles.quebraItem}>
                <Ionicons name="videocam-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.quebraTexto}>{r.mediaZoom}</Text>
              </View>
            </View>
            <Text style={styles.detalhe}>
              {r.reunioes} {r.reunioes === 1 ? "reunião" : "reuniões"} · total {r.total}
            </Text>
            {v !== null ? (
              <View style={styles.variacao}>
                <Ionicons
                  name={v >= 0 ? "arrow-up" : "arrow-down"}
                  size={13}
                  color={v >= 0 ? colors.greenDark : colors.red}
                />
                <Text style={[styles.variacaoTexto, { color: v >= 0 ? colors.greenDark : colors.red }]}>
                  {Math.abs(v)}% vs {nomeMes(somarMeses(mes, -1), true)}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.vazio}>Sem reuniões registradas</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.tela}>
      <GradientHeader title="Assistência" description="Por mês, presencial e pelo Zoom" showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl {...puxar} />}
      >
        {podeRegistrar ? (
          <Pressable style={styles.zoom} onPress={() => router.push("/reuniao/zoom-relatorios")} accessibilityRole="button">
            <Ionicons name="videocam-outline" size={18} color={colors.primaryDark} />
            <View style={styles.zoomTextos}>
              <Text style={styles.zoomTitulo}>Relatórios do Zoom</Text>
              <Text style={styles.zoomDetalhe}>Resumo, participantes e transcrição de cada reunião</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}

        <View style={styles.meses}>
          <Pressable style={styles.seta} onPress={() => setEscolhido(somarMeses(mes, -1))} hitSlop={8} accessibilityLabel="Mês anterior">
            <Ionicons name="chevron-back" size={20} color={colors.primaryDark} />
          </Pressable>
          <Text style={styles.mesNome}>{maiuscula(nomeMes(mes))}</Text>
          <Pressable
            style={[styles.seta, mes >= atual && { opacity: 0.3 }]}
            onPress={() => setEscolhido(somarMeses(mes, 1))}
            disabled={mes >= atual}
            hitSlop={8}
            accessibilityLabel="Próximo mês"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
          </Pressable>
        </View>

        <View style={styles.filtros}>
          {FILTROS.map((f) => {
            const ativo = filtro === f.id;
            return (
              <Pressable
                key={f.id}
                style={[styles.filtro, ativo && styles.filtroAtivo]}
                onPress={() => setFiltro(f.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
              >
                <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}>{f.rotulo}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.cartoes}>{tipos.map(cartao)}</View>

        <View style={styles.bloco}>
          <Text style={styles.blocoTitulo}>Média dos últimos 12 meses</Text>
          <View style={styles.grafico}>
            {grafico.map((g) => {
              const selecionado = g.mes === mes;
              return (
                <Pressable
                  key={g.mes}
                  style={[styles.coluna, !selecionado && { opacity: 0.5 }]}
                  onPress={() => setEscolhido(g.mes)}
                  accessibilityLabel={`${nomeMes(g.mes)}: ${g.valores.join(" e ")}`}
                >
                  <View style={styles.barras}>
                    {g.valores.map((v, i) => (
                      <View
                        // Posicional: a i-ésima barra é sempre o i-ésimo tipo do filtro.
                        key={i}
                        style={[
                          styles.barra,
                          { height: v ? 4 + Math.round((v / maior) * 96) : 2, backgroundColor: v ? corDe(tipos[i]) : colors.border },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.colunaRotulo, selecionado && styles.colunaRotuloAtivo]}>{nomeMes(g.mes, true)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.bloco}>
          <Text style={styles.blocoTitulo}>Reuniões de {nomeMes(mes).split(" de ")[0]}</Text>
          {doMes.length === 0 ? (
            <EmptyState icon="calendar-outline" title="Nenhuma reunião registrada neste mês" />
          ) : (
            doMes.map((r: AssistenciaReuniao) => (
              <Pressable
                key={r.id}
                style={({ pressed }) => [styles.reuniao, pressed && podeRegistrar && { opacity: 0.8 }]}
                disabled={!podeRegistrar}
                onPress={() =>
                  router.push({ pathname: "/reuniao/zoom", params: { [r.tipo]: r.data.replace(/\//g, "-"), tipo: r.tipo } })
                }
                accessibilityRole={podeRegistrar ? "button" : undefined}
              >
                <View style={[styles.reuniaoFaixa, { backgroundColor: corDe(r.tipo) }]} />
                <View style={styles.reuniaoTextos}>
                  <Text style={styles.reuniaoDia}>
                    {diaDaReuniao(r.data)} · {ROTULO[r.tipo]}
                  </Text>
                  <Text style={styles.reuniaoNumeros}>
                    {r.presencial} presencial · {r.zoom} pelo Zoom
                  </Text>
                  {podeRegistrar ? (
                    <Text style={styles.reuniaoZoom}>
                      {r.zoomConexoes
                        ? `Zoom: ${r.zoomConexoes} ${r.zoomConexoes === 1 ? "conexão" : "conexões"} · ${r.zoomPessoas} pessoas${r.maos ? ` · ${r.maos} ${r.maos === 1 ? "mão levantada" : "mãos levantadas"}` : ""}`
                        : "Quem assistiu pelo Zoom: ainda sem lista"}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.reuniaoTotal}>{r.presencial + r.zoom}</Text>
                {podeRegistrar ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 16 },
    meses: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    zoom: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    zoomTextos: { flex: 1 },
    zoomTitulo: { fontSize: 15, fontWeight: "800", color: colors.text },
    zoomDetalhe: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
    seta: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mesNome: { fontSize: 20, fontWeight: "800", color: colors.text },
    filtros: { flexDirection: "row", gap: 8 },
    filtro: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
    },
    filtroAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    filtroTexto: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    filtroTextoAtivo: { color: colors.textOnPrimary },
    cartoes: { flexDirection: "row", gap: 12 },
    cartao: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      gap: 2,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    cartaoTopo: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    ponto: { width: 9, height: 9, borderRadius: 5 },
    cartaoRotulo: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    media: { fontSize: 38, fontWeight: "900", color: colors.text, lineHeight: 44 },
    mediaLegenda: { fontSize: 12, color: colors.textMuted },
    quebra: { flexDirection: "row", gap: 14, marginTop: 6 },
    quebraItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    quebraTexto: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
    detalhe: { fontSize: 12.5, color: colors.textSecondary, marginTop: 6 },
    variacao: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
    variacaoTexto: { fontSize: 12.5, fontWeight: "700" },
    vazio: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
    bloco: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    blocoTitulo: { fontSize: 15, fontWeight: "800", color: colors.text },
    grafico: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 124 },
    coluna: { flex: 1, alignItems: "center", gap: 6 },
    barras: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 100 },
    barra: { width: 7, borderRadius: 4 },
    colunaRotulo: { fontSize: 10.5, color: colors.textMuted },
    colunaRotuloAtivo: { color: colors.text, fontWeight: "800" },
    reuniao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    reuniaoFaixa: { width: 4, alignSelf: "stretch", borderRadius: 2 },
    reuniaoTextos: { flex: 1, gap: 2 },
    reuniaoDia: { fontSize: 14.5, fontWeight: "700", color: colors.text },
    reuniaoNumeros: { fontSize: 13, color: colors.textSecondary },
    reuniaoZoom: { fontSize: 12.5, color: colors.primaryDark, fontWeight: "600" },
    reuniaoTotal: { fontSize: 22, fontWeight: "900", color: colors.text },
  });
