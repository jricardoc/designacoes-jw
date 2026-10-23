import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEstadoZoom, useImportarRelatorioZoom, useReunioesZoom, useSincronizarPeriodoZoom } from "@/api/hooks/useZoom";
import type { ResultadoImportacaoZoom, ReuniaoZoomResumo } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { Button, EmptyState, GradientHeader, Loading, SelectSheet, TextField, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { podeGerenciar } from "@/utils/permissoes";
import { usePuxar } from "@/utils/usePuxar";
import { quandoFoi, TIPO_REUNIAO } from "@/utils/zoom";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const diasAtras = (n: number) => iso(new Date(Date.now() - n * 86400000));

const PERIODOS = [
  { id: "30", rotulo: "30 dias", dias: 30 },
  { id: "90", rotulo: "3 meses", dias: 90 },
  { id: "365", rotulo: "12 meses", dias: 365 },
  { id: "tudo", rotulo: "Tudo", dias: null },
] as const;

const RECUPERAR = [
  { value: "31", label: "Último mês" },
  { value: "92", label: "Últimos 3 meses" },
  { value: "365", label: "Últimos 12 meses" },
];

/**
 * Os relatórios das reuniões do Zoom: o resumo do AI Companion, quem participou e a
 * transcrição, que chegam sozinhos quando a reunião termina. Só para quem cuida das reuniões.
 */
export default function RelatoriosZoomScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { usuario } = useAuth();
  const pode = podeGerenciar(usuario, "reunioes");
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["id"]>("90");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [recuperando, setRecuperando] = useState(false);

  // Espera o irmão parar de digitar: uma busca por tecla seria uma ida ao servidor por letra.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);

  const filtro = useMemo(() => {
    const p = PERIODOS.find((x) => x.id === periodo);
    return { de: p && p.dias ? diasAtras(p.dias) : "", ate: p && p.dias ? iso(new Date()) : "", busca: buscaAplicada };
  }, [periodo, buscaAplicada]);

  const estado = useEstadoZoom();
  const lista = useReunioesZoom(filtro);
  const sincronizar = useSincronizarPeriodoZoom();
  const importar = useImportarRelatorioZoom();
  const { feito } = useCelebracao();
  const puxar = usePuxar(() => Promise.all([lista.refetch(), estado.refetch()]));

  if (!pode) {
    return (
      <View style={styles.tela}>
        <GradientHeader title="Relatórios do Zoom" showBack />
        <EmptyState icon="lock-closed-outline" title="Área de quem cuida das reuniões" />
      </View>
    );
  }

  const reunioes = lista.data?.pages.flatMap((p) => p.reunioes) ?? [];
  const total = lista.data?.pages[0]?.total ?? 0;
  const faltaConfigurar = estado.data && (!estado.data.api || !estado.data.webhook);

  /** "08/10" de "08/10/2026" */
  const diaMes = (data: string) => data.slice(0, 5);

  const contarImportacao = (r: ResultadoImportacaoZoom) => {
    const juntas = r.reunioes.filter((x) => x.assistencia);
    const semContagem = r.reunioes.filter((x) => !x.assistencia);
    const linhas = [
      `${r.reunioes.length} ${r.reunioes.length === 1 ? "reunião importada" : "reuniões importadas"}${
        r.reunioes.length ? ` (${diaMes(r.reunioes[0].data)} a ${diaMes(r.reunioes[r.reunioes.length - 1].data)})` : ""
      }.`,
      juntas.length
        ? `${juntas.length} ${juntas.length === 1 ? "entrou" : "entraram"} em "quem assistiu pelo Zoom" da assistência (${juntas.reduce((s, x) => s + (x.assistencia?.adicionados ?? 0), 0)} nomes novos).`
        : null,
      semContagem.length
        ? `${semContagem.length} sem a contagem da assistência registrada: ficam só aqui nos relatórios (${semContagem.map((x) => diaMes(x.data)).join(", ")}).`
        : null,
      r.ignoradas.length ? `${r.ignoradas.length} ${r.ignoradas.length === 1 ? "ignorada" : "ignoradas"} (só a conta ou poucas pessoas).` : null,
      ...r.erros,
    ].filter(Boolean);
    return linhas.join("\n\n");
  };

  const escolherRelatorios = async () => {
    // "*/*": o CSV chega com tipos diferentes (baixado, do WhatsApp, do Drive); quem confere é o servidor.
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: true, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    importar.mutate(
      res.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType })),
      {
        onSuccess: (r) => {
          if (r.reunioes.length) feito({ titulo: "Relatórios importados", detalhe: `${r.reunioes.length} reuniões`, icone: "videocam" });
          Alert.alert(r.reunioes.length ? "Importado" : "Nada importado", contarImportacao(r));
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para importar", "error"),
      },
    );
  };

  const recuperar = (dias: string) =>
    sincronizar.mutate(
      { de: diasAtras(Number(dias)), ate: iso(new Date()) },
      {
        onSuccess: (r) => {
          toast.show(
            r.encontradas
              ? `${r.encontradas} ${r.encontradas === 1 ? "reunião encontrada" : "reuniões encontradas"} (${r.novas} ${r.novas === 1 ? "nova" : "novas"}). Os relatórios chegam em instantes.`
              : "Nenhuma reunião encontrada no período.",
          );
          if (r.avisos.length) toast.show(r.avisos[0], "error");
        },
        onError: (e) => toast.show(e instanceof Error ? e.message : "Não deu para buscar no Zoom", "error"),
      },
    );

  const cartao = (r: ReuniaoZoomResumo, i: number) => (
    <Animated.View key={r.id} entering={FadeInDown.duration(220).delay(Math.min(i, 8) * 30)}>
      <Pressable
        style={({ pressed }) => [styles.cartao, pressed && { opacity: 0.85 }]}
        onPress={() => router.push({ pathname: "/reuniao/zoom-relatorio/[id]", params: { id: String(r.id) } })}
        accessibilityRole="button"
      >
        <View style={styles.cartaoTopo}>
          <Text style={styles.quando}>
            {quandoFoi(r.inicio)}
            {r.congregacao ? ` · ${TIPO_REUNIAO[r.congregacao.tipo]}` : ""}
          </Text>
          {r.situacao === "sincronizando" ? (
            <View style={styles.selo}>
              <ActivityIndicator size="small" color={colors.primaryDark} />
              <Text style={styles.seloTexto}>Buscando no Zoom</Text>
            </View>
          ) : r.situacao === "erro" ? (
            <View style={[styles.selo, { backgroundColor: colors.dangerBg }]}>
              <Ionicons name="alert-circle" size={14} color={colors.red} />
              <Text style={[styles.seloTexto, { color: colors.red }]}>Erro</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.titulo} numberOfLines={2}>
          {r.resumoTitulo || r.topico || "Reunião do Zoom"}
        </Text>
        <View style={styles.numeros}>
          <View style={styles.numero}>
            <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.numeroTexto}>{r.participantesQtd ?? "—"}</Text>
          </View>
          {r.duracaoMin ? (
            <View style={styles.numero}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.numeroTexto}>{r.duracaoMin} min</Text>
            </View>
          ) : null}
          <View style={styles.numero}>
            <Ionicons
              name={r.origem === "csv" ? "document-attach-outline" : r.temResumo ? "document-text-outline" : "document-outline"}
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.numeroTexto}>{r.origem === "csv" ? "Do relatório" : r.temResumo ? "Resumo" : "Sem resumo"}</Text>
          </View>
          {r.decisoes + r.proximosPassos > 0 ? (
            <View style={styles.numero}>
              <Ionicons name="checkbox-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.numeroTexto}>{r.decisoes + r.proximosPassos}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={styles.tela}>
      <GradientHeader title="Relatórios do Zoom" description="Resumo, participantes e transcrição" showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {faltaConfigurar ? (
          <View style={styles.aviso}>
            <Ionicons name="construct-outline" size={18} color={colors.amber} />
            <Text style={styles.avisoTexto}>
              A integração automática com o Zoom ainda não está ligada. Enquanto isso, importe o relatório de uso
              exportado do zoom.us (Relatórios › Uso): os participantes de cada reunião entram aqui e na assistência.
            </Text>
          </View>
        ) : null}

        <TextField icon="search" placeholder="Buscar no resumo, no tema ou por participante" value={busca} onChangeText={setBusca} returnKeyType="search" />

        <View style={styles.filtros}>
          {PERIODOS.map((p) => {
            const ativo = periodo === p.id;
            return (
              <Pressable
                key={p.id}
                style={[styles.filtro, ativo && styles.filtroAtivo]}
                onPress={() => setPeriodo(p.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
              >
                <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}>{p.rotulo}</Text>
              </Pressable>
            );
          })}
        </View>

        {lista.isLoading && !lista.data ? (
          <Loading label="Carregando os relatórios..." />
        ) : reunioes.length === 0 ? (
          <EmptyState
            icon="videocam-outline"
            title={buscaAplicada ? "Nada encontrado" : "Nenhum relatório no período"}
            message={
              buscaAplicada
                ? "Tente outra palavra ou um período maior."
                : "Importe o relatório de uso do Zoom (CSV) com o botão abaixo. Com a integração ligada, cada reunião chega sozinha."
            }
          />
        ) : (
          <>
            <Text style={styles.contagem}>
              {total} {total === 1 ? "reunião" : "reuniões"}
            </Text>
            {reunioes.map(cartao)}
            {lista.hasNextPage ? (
              <Button label="Carregar mais" variant="secondary" onPress={() => lista.fetchNextPage()} loading={lista.isFetchingNextPage} fullWidth />
            ) : null}
          </>
        )}

        <Button
          label="Importar relatório do Zoom (CSV)"
          icon="document-attach-outline"
          variant={estado.data?.api ? "secondary" : "primary"}
          onPress={escolherRelatorios}
          loading={importar.isPending}
          fullWidth
        />
        {estado.data?.api ? (
          <Button
            label="Buscar reuniões anteriores no Zoom"
            icon="cloud-download-outline"
            variant="secondary"
            onPress={() => setRecuperando(true)}
            loading={sincronizar.isPending}
            fullWidth
          />
        ) : null}
      </ScrollView>

      <SelectSheet
        visible={recuperando}
        title="Buscar no Zoom as reuniões de"
        options={RECUPERAR}
        allowClear={false}
        onSelect={recuperar}
        onClose={() => setRecuperando(false)}
      />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 12 },
    aviso: { flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: colors.warningBg },
    avisoTexto: { flex: 1, fontSize: 13.5, color: colors.text, lineHeight: 19 },
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
    contagem: { fontSize: 12.5, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
    cartao: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    cartaoTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    quando: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    selo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.infoBg,
    },
    seloTexto: { fontSize: 11.5, fontWeight: "800", color: colors.primaryDark },
    titulo: { fontSize: 16, fontWeight: "800", color: colors.text },
    numeros: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 2 },
    numero: { flexDirection: "row", alignItems: "center", gap: 4 },
    numeroTexto: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  });
