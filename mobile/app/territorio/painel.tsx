import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConfig } from "@/api/hooks/useMisc";
import {
  buscarS13,
  useApagarDesignacao,
  useConflitosTerritorio,
  useDesignacoesTerritorio,
  usePainelTerritorios,
  useRevisarSaida,
} from "@/api/hooks/useTerritorios";
import { AreasTerritorios, LimiteCongregacao } from "@/components/territorio/AreasTerritorios";
import { Button, GradientHeader, Loading, useToast } from "@/components/ui";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { CASA_TRABALHADA, DIAS_PARADO, diaCurto } from "@/territorios/constantes";
import { gerarHtmlS13 } from "@/territorios/s13Html";
import { exportarPdf } from "@/utils/exportPdf";
import { usePuxar } from "@/utils/usePuxar";

const PERIODOS = [
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "3 meses" },
  { dias: 180, rotulo: "6 meses" },
  { dias: 365, rotulo: "1 ano" },
  { dias: 3650, rotulo: "Tudo" },
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Ano de serviço atual: de setembro em diante já é o ano seguinte. */
function anoDeServicoAtual() {
  const hoje = new Date();
  return hoje.getFullYear() + (hoje.getMonth() >= 8 ? 1 : 0);
}

/**
 * O painel de quem cuida dos territórios: o que pede atenção primeiro (revisão, parados, Não
 * bater vencido), depois as designações, os números do período e o S-13.
 */
export default function PainelTerritoriosScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [dias, setDias] = useState(90);
  const [anoS13, setAnoS13] = useState(anoDeServicoAtual());
  const [gerandoS13, setGerandoS13] = useState(false);
  const { data: config } = useConfig();
  const { data, isLoading, refetch } = usePainelTerritorios(dias);
  const { data: conflitos, refetch: refetchConflitos } = useConflitosTerritorio();
  const { data: designacoes, refetch: refetchDesignacoes } = useDesignacoesTerritorio();
  const puxar = usePuxar(() => Promise.all([refetch(), refetchConflitos(), refetchDesignacoes()]));
  const revisar = useRevisarSaida();
  const apagarDesignacao = useApagarDesignacao();

  const porDia = useMemo(() => {
    const mapa = new Map<string, NonNullable<typeof designacoes>>();
    for (const d of designacoes ?? []) mapa.set(d.dia, [...(mapa.get(d.dia) ?? []), d]);
    return [...mapa];
  }, [designacoes]);

  if (isLoading || !data) return <Loading label="Carregando painel..." />;

  const r = data.resumo;
  const maiorMes = Math.max(1, ...data.porMes.map((m) => m.saidas));
  const maiorTerritorio = Math.max(1, ...data.maisTrabalhados.map((m) => m.dias));
  const abrir = (numero: string) => router.push({ pathname: "/territorio/[numero]", params: { numero } });

  const gerarS13 = async () => {
    setGerandoS13(true);
    try {
      const s13 = await buscarS13(anoS13);
      await exportarPdf(gerarHtmlS13(s13, config?.subtitulo), `S-13-${anoS13 - 1}-${anoS13}.pdf`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro ao gerar o S-13", "error");
    } finally {
      setGerandoS13(false);
    }
  };

  const numeros: { valor: number; rotulo: string; icone: keyof typeof Ionicons.glyphMap; alerta?: boolean }[] = [
    { valor: r.trabalhados, rotulo: `trabalhados de ${r.total}`, icone: "walk" },
    { valor: r.concluidosNoCiclo, rotulo: "concluídos no ciclo", icone: "checkmark-done" },
    { valor: r.designacoesProximos7, rotulo: "designações em 7 dias", icone: "calendar" },
    { valor: r.parados, rotulo: `parados há ${DIAS_PARADO}+ dias`, icone: "hourglass", alerta: r.parados > 0 },
    { valor: r.naoBaterVencidas, rotulo: "Não bater p/ reconfirmar", icone: "hand-left", alerta: r.naoBaterVencidas > 0 },
    { valor: r.conflitos, rotulo: "aguardando revisão", icone: "git-compare", alerta: r.conflitos > 0 },
  ];

  return (
    <View style={styles.flex}>
      <GradientHeader title="Gerenciar territórios" description="Painel, designações e relatórios" showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            {...puxar}
          />
        }
      >
        <Pressable style={styles.myMaps} onPress={() => router.push("/territorio/importar")}>
          <Ionicons name="layers" size={22} color={colors.primaryDark} />
          <View style={styles.flex1}>
            <Text style={styles.myMapsTitulo}>Mapas do My Maps</Text>
            <Text style={styles.myMapsSub}>Importar territórios ou atualizar o desenho das quadras</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.secao}>Áreas</Text>
        <AreasTerritorios />

        <Text style={styles.secao}>Limite da congregação</Text>
        <LimiteCongregacao />

        <View style={styles.periodos}>
          {PERIODOS.map((p) => (
            <Pressable key={p.dias} onPress={() => setDias(p.dias)} style={[styles.periodo, dias === p.dias && styles.periodoAtivo]}>
              <Text style={[styles.periodoTexto, dias === p.dias && styles.periodoTextoAtivo]}>{p.rotulo}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.numeros}>
          {numeros.map((n) => (
            <View key={n.rotulo} style={[styles.numero, n.alerta && styles.numeroAlerta]}>
              <Ionicons name={n.icone} size={18} color={n.alerta ? colors.amber : colors.primaryDark} />
              <Text style={[styles.numeroValor, n.alerta && { color: colors.amber }]}>{n.valor}</Text>
              <Text style={styles.numeroRotulo}>{n.rotulo}</Text>
            </View>
          ))}
        </View>

        {conflitos && conflitos.length > 0 ? (
          <>
            <Text style={styles.secao}>Aguardando revisão</Text>
            <Text style={styles.ajuda}>
              Dois dirigentes registraram a mesma parte no mesmo dia com orientações diferentes. Vale o que você aceitar.
            </Text>
            {conflitos.map((c) => (
              <View key={c.id} style={styles.cartao}>
                <Text style={styles.cartaoTitulo}>
                  Território {c.territorio.numero} · {c.quadra?.nome ?? "inteiro"}
                </Text>
                <Text style={styles.linha}>Pararam em: {c.ondeParou ?? "ponto no mapa"}</Text>
                {c.casaTrabalhada ? <Text style={styles.linha}>Casa trabalhada: {CASA_TRABALHADA[c.casaTrabalhada].rotulo}</Text> : null}
                {c.proximoInicio ? <Text style={styles.linha}>Próxima: {c.proximoInicio}</Text> : null}
                <Text style={styles.meta}>
                  {c.autor?.nome ?? "—"} · {diaCurto(c.dia)}
                </Text>
                <View style={styles.botoes}>
                  <Button
                    label="Aceitar"
                    icon="checkmark"
                    onPress={() => revisar.mutate({ id: c.id, status: "ativa" }, { onSuccess: () => refetchConflitos() })}
                    style={styles.flex1}
                  />
                  <Button
                    label="Descartar"
                    variant="secondary"
                    onPress={() => revisar.mutate({ id: c.id, status: "descartada" }, { onSuccess: () => refetchConflitos() })}
                    style={styles.flex1}
                  />
                </View>
                <Pressable onPress={() => router.push({ pathname: "/territorio/historico", params: { numero: c.territorio.numero } })}>
                  <Text style={styles.link}>Ver o histórico do território</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.secao}>Próximas designações</Text>
        {porDia.length === 0 ? (
          <Text style={styles.ajuda}>Nenhuma. Designe pela tela do território: ⚙️ › Designar.</Text>
        ) : (
          porDia.map(([dia, lista]) => (
            <View key={dia} style={styles.cartao}>
              <Text style={styles.cartaoTitulo}>{diaCurto(dia)}</Text>
              {lista.map((d) => (
                <View key={d.id} style={styles.designacao}>
                  <Pressable style={styles.flex1} onPress={() => abrir(d.territorio.numero)}>
                    <Text style={styles.linha}>
                      <Text style={{ fontWeight: "800" }}>{d.territorio.numero}</Text> {d.territorio.nome}
                    </Text>
                    <Text style={styles.meta}>{d.dirigente.nome}</Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      Alert.alert("Apagar designação?", `${d.territorio.numero} · ${d.dirigente.nome}`, [
                        { text: "Cancelar", style: "cancel" },
                        { text: "Apagar", style: "destructive", onPress: () => apagarDesignacao.mutate(d.id, { onSuccess: () => refetchDesignacoes() }) },
                      ])
                    }
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}

        <Text style={styles.secao}>Há mais tempo sem trabalhar</Text>
        <View style={styles.cartao}>
          {data.maisTempoParados.slice(0, 10).map((t) => (
            <Pressable key={t.numero} style={styles.ranking} onPress={() => abrir(t.numero)}>
              <Text style={styles.rankingNumero}>{t.numero}</Text>
              <Text style={styles.rankingNome} numberOfLines={1}>
                {t.nome}
              </Text>
              <Text style={[styles.rankingValor, (t.dias ?? 0) >= DIAS_PARADO && { color: colors.amber }]}>
                {t.nunca ? `nunca (${t.dias} d)` : `${t.dias} dias`}
              </Text>
            </Pressable>
          ))}
        </View>

        {data.maisTrabalhados.length > 0 ? (
          <>
            <Text style={styles.secao}>Mais trabalhados no período</Text>
            <View style={styles.cartao}>
              {data.maisTrabalhados.slice(0, 10).map((t) => (
                <Pressable key={t.numero} style={styles.ranking} onPress={() => abrir(t.numero)}>
                  <Text style={styles.rankingNumero}>{t.numero}</Text>
                  <View style={styles.barraFundo}>
                    <View style={[styles.barra, { width: `${(t.dias / maiorTerritorio) * 100}%` }]} />
                  </View>
                  <Text style={styles.rankingValor}>{t.dias}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.secao}>Saídas por mês</Text>
        <View style={[styles.cartao, styles.meses]}>
          {data.porMes.map((m) => (
            <View key={m.mes} style={styles.mes}>
              <Text style={styles.mesValor}>{m.saidas || ""}</Text>
              <View style={[styles.mesBarra, { height: 4 + (m.saidas / maiorMes) * 70 }]} />
              <Text style={styles.mesRotulo}>{MESES[Number(m.mes.slice(5, 7)) - 1]}</Text>
            </View>
          ))}
        </View>

        {data.dirigentes.length > 0 ? (
          <>
            <Text style={styles.secao}>Dirigentes no período</Text>
            <View style={styles.cartao}>
              {data.dirigentes.map((d) => (
                <View key={d.nome} style={styles.ranking}>
                  <Text style={[styles.rankingNome, { flex: 1 }]}>{d.nome}</Text>
                  <Text style={styles.meta}>
                    {d.saidas} saída{d.saidas > 1 ? "s" : ""} · {d.territorios} terr. · última {diaCurto(d.ultima)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {data.concluidos.length > 0 ? (
          <>
            <Text style={styles.secao}>Concluídos no período</Text>
            <View style={styles.cartao}>
              {data.concluidos.map((c, i) => (
                <Pressable key={`${c.numero}-${c.dia}-${i}`} style={styles.ranking} onPress={() => abrir(c.numero)}>
                  <Text style={styles.rankingNumero}>{c.numero}</Text>
                  <Text style={styles.rankingNome} numberOfLines={1}>
                    {c.nome}
                  </Text>
                  <Text style={styles.meta}>
                    {diaCurto(c.dia)}
                    {c.autor ? ` · ${c.autor.split(" ")[0]}` : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.secao}>Registro de designação (S-13)</Text>
        <View style={styles.cartao}>
          <Text style={styles.ajuda}>Ano de serviço (setembro a agosto):</Text>
          <View style={styles.periodos}>
            {[0, 1, 2, 3].map((i) => {
              const ano = anoDeServicoAtual() - i;
              return (
                <Pressable key={ano} onPress={() => setAnoS13(ano)} style={[styles.periodo, anoS13 === ano && styles.periodoAtivo]}>
                  <Text style={[styles.periodoTexto, anoS13 === ano && styles.periodoTextoAtivo]}>
                    {ano - 1}/{String(ano).slice(2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Button label="Gerar S-13 em PDF" icon="document-text" onPress={gerarS13} loading={gerandoS13} fullWidth />
        </View>
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    flex1: { flex: 1 },
    scroll: { padding: 16, gap: 12 },
    myMaps: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    myMapsTitulo: { fontSize: 16, fontWeight: "800", color: colors.text },
    myMapsSub: { fontSize: 12.5, color: colors.textSecondary },
    periodos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    periodo: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    periodoAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    periodoTexto: { fontSize: 13, fontWeight: "700", color: colors.text },
    periodoTextoAtivo: { color: colors.textOnPrimary },
    numeros: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    numero: {
      flexGrow: 1,
      flexBasis: "30%",
      gap: 2,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      ...shadow.card,
    },
    numeroAlerta: { backgroundColor: colors.warningBg },
    numeroValor: { fontSize: 26, fontWeight: "900", color: colors.text },
    numeroRotulo: { fontSize: 12, color: colors.textSecondary, lineHeight: 15 },
    secao: { fontSize: 13, fontWeight: "800", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 },
    ajuda: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    cartao: { gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    cartaoTitulo: { fontSize: 15.5, fontWeight: "800", color: colors.text },
    linha: { fontSize: 14, color: colors.text },
    meta: { fontSize: 12.5, color: colors.textMuted },
    link: { fontSize: 13.5, fontWeight: "800", color: colors.primaryDark },
    botoes: { flexDirection: "row", gap: 10 },
    designacao: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
    ranking: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
    rankingNumero: { width: 34, fontSize: 15, fontWeight: "900", color: colors.text },
    rankingNome: { flex: 1, fontSize: 14, color: colors.text },
    rankingValor: { fontSize: 13.5, fontWeight: "800", color: colors.textSecondary },
    barraFundo: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    barra: { height: 10, borderRadius: 5, backgroundColor: colors.primary },
    meses: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 4 },
    mes: { flex: 1, alignItems: "center", gap: 3 },
    mesValor: { fontSize: 10.5, fontWeight: "700", color: colors.textSecondary },
    mesBarra: { width: "70%", borderRadius: 3, backgroundColor: colors.primary },
    mesRotulo: { fontSize: 10.5, color: colors.textMuted },
  });
