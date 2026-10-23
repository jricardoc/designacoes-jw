import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMapaTerritorios, useTerritorios } from "@/api/hooks/useTerritorios";
import type { SituacaoTerritorio } from "@/api/types";
import { CabecalhoTerritorio } from "@/components/territorio/CabecalhoTerritorio";
import {
  MapaTerritorio,
  mapaDisponivel,
  type AreaMapa,
  type FundoMapa,
  type MapaTerritorioRef,
} from "@/components/territorio/MapaTerritorio";
import { OndeEstou } from "@/components/territorio/OndeEstou";
import { APARECE, Pressionavel, Progresso, SOME } from "@/components/territorio/pecas";
import { Button, EmptyState, Loading } from "@/components/ui";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { quandoFoi, SITUACOES } from "@/territorios/constantes";

/** O rodapé do mapa fica acima da barra de baixo (66 de altura, a 10 da borda), com folga. */
const ACIMA_DA_BARRA = 90;

/**
 * O Mapa: todos os territórios de ponta a ponta, na cor da situação, com o "Você está aqui" no
 * topo. Tocar num território mostra o cartão dele; tocar numa área da legenda enquadra a área.
 */
export default function MapaScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  // Vindo de uma área na lista ("Mapa"): abre já enquadrado nela.
  const { area } = useLocalSearchParams<{ area?: string }>();
  const { data, isLoading, isError, refetch } = useTerritorios();
  const doBanco = data?.fonte === "banco";
  const { data: mapaGeral } = useMapaTerritorios(doBanco);
  // O território tocado (cartão de prévia) ou a área escolhida na legenda.
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [foco, setFoco] = useState<string | null>(area || null);
  const mapaRef = useRef<MapaTerritorioRef>(null);

  const todos = useMemo(() => data?.territorios ?? [], [data]);
  const cores = data?.cores ?? {};

  // O voltar do Android fecha o cartão aberto antes de sair.
  useEffect(() => {
    if (!selecionado && !foco) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setSelecionado(null);
      setFoco(null);
      return true;
    });
    return () => sub.remove();
  }, [selecionado, foco]);

  const areas = useMemo<AreaMapa[]>(
    () =>
      (mapaGeral?.territorios ?? []).flatMap((t) =>
        t.quadras.map((q, i) => ({
          chave: `${t.numero}|${i}`,
          nome: q.nome,
          pontos: q.pontos,
          cor: SITUACOES[t.situacao].cor(colors),
          rotulo: i === 0 ? t.numero : undefined,
        })),
      ),
    [mapaGeral, colors],
  );
  // A região de cada área, por baixo dos territórios, na cor da área.
  const fundos = useMemo<FundoMapa[]>(
    () =>
      (mapaGeral?.areas ?? []).flatMap((a) =>
        a.aneis.map((pontos, i) => ({ chave: `${a.nome}|${i}`, cor: a.cor, pontos })),
      ),
    [mapaGeral],
  );
  const pontosDaArea = (nome: string | null) => mapaGeral?.areas?.find((a) => a.nome === nome)?.aneis.flat();

  const abrir = (numero: string) => router.push({ pathname: "/territorio/[numero]", params: { numero } });

  if (isLoading) {
    return (
      <View style={styles.tela}>
        <CabecalhoTerritorio />
        <Loading label="Carregando territórios..." />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.tela}>
        <CabecalhoTerritorio />
        <EmptyState icon="cloud-offline" title="Não foi possível carregar os territórios" message="Verifique a conexão e tente novamente.">
          <Button label="Tentar de novo" onPress={() => refetch()} />
        </EmptyState>
      </View>
    );
  }
  if (!doBanco || !mapaDisponivel) {
    return (
      <View style={styles.tela}>
        <CabecalhoTerritorio />
        <EmptyState
          icon="map-outline"
          title="O mapa ainda não está aqui"
          message={
            mapaDisponivel
              ? "Os territórios aparecem no mapa depois que os mapas forem importados do My Maps."
              : "O mapa abre no app do celular."
          }
        >
          <Button label="Ver a lista" icon="albums-outline" onPress={() => router.replace("/territorio/lista")} />
        </EmptyState>
      </View>
    );
  }
  if (!mapaGeral) {
    return (
      <View style={styles.tela}>
        <CabecalhoTerritorio />
        <Loading label="Carregando o mapa..." />
      </View>
    );
  }

  const t = selecionado ? todos.find((x) => x.numero === selecionado) : undefined;
  const daArea = !t && foco ? todos.filter((x) => (x.area?.trim() ?? "") === foco) : [];

  return (
    <View style={styles.tela}>
      <Animated.View entering={FadeIn.duration(320)} style={StyleSheet.absoluteFill}>
        <MapaTerritorio
          ref={mapaRef}
          areas={areas}
          fundos={fundos}
          limite={mapaGeral.limite}
          enquadrarEm={pontosDaArea(foco)}
          onAreaPress={(chave) => {
            setFoco(null);
            setSelecionado(chave.split("|")[0]);
          }}
          style={styles.mapa}
        />
      </Animated.View>

      <View pointerEvents="box-none">
        <CabecalhoTerritorio sobreOMapa />
        <OndeEstou territorios={mapaGeral.territorios} resumos={todos} onAbrir={abrir} />
      </View>

      <View style={[styles.rodape, { bottom: insets.bottom + ACIMA_DA_BARRA }]} pointerEvents="box-none">
        {t ? (
          <Animated.View key={`t-${t.numero}`} entering={APARECE} exiting={SOME} style={styles.previa}>
            <View style={[styles.previaSelo, { backgroundColor: SITUACOES[t.situacao].cor(colors) }]}>
              <Text style={styles.previaSeloTexto}>{t.numero}</Text>
            </View>
            <View style={styles.textos}>
              <Text style={styles.nome} numberOfLines={1}>
                {t.nome}
              </Text>
              {t.observacoes ? (
                <Text style={styles.descricao} numberOfLines={1}>
                  {t.observacoes}
                </Text>
              ) : null}
              <Text style={styles.ultima} numberOfLines={1}>
                {SITUACOES[t.situacao].rotulo}
                {t.area ? ` · ${t.area}` : ""}
              </Text>
              <Text style={styles.ultima} numberOfLines={1}>
                {t.ultimaSaida ? `Última saída ${quandoFoi(t.ultimaSaida.dia)}` : "Nunca trabalhado"}
              </Text>
            </View>
            <Pressionavel style={styles.previaAbrir} onPress={() => abrir(t.numero)} accessibilityRole="button">
              <Text style={styles.previaAbrirTexto}>Abrir</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textOnPrimary} />
            </Pressionavel>
            <Pressable style={styles.previaFechar} onPress={() => setSelecionado(null)} hitSlop={10} accessibilityLabel="Fechar">
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>
        ) : foco && daArea.length ? (
          <Animated.View key={`a-${foco}`} entering={APARECE} exiting={SOME} style={styles.previa}>
            <View style={[styles.previaSelo, { backgroundColor: cores[foco] ?? colors.primary }]}>
              <Ionicons name="albums" size={20} color="#fff" />
            </View>
            <View style={styles.textos}>
              <Text style={styles.nome} numberOfLines={1}>
                {foco}
              </Text>
              <Text style={styles.ultima}>
                {daArea.length} territórios · {daArea.filter((x) => x.situacao === "concluido").length} concluídos no ciclo
              </Text>
              <Progresso fracao={daArea.filter((x) => x.situacao === "concluido").length / daArea.length} cor={cores[foco] ?? colors.primary} />
            </View>
            <Pressionavel
              style={styles.previaAbrir}
              onPress={() => router.replace({ pathname: "/territorio/lista", params: { area: foco } })}
              accessibilityRole="button"
            >
              <Text style={styles.previaAbrirTexto}>Lista</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textOnPrimary} />
            </Pressionavel>
            <Pressable style={styles.previaFechar} onPress={() => setFoco(null)} hitSlop={10} accessibilityLabel="Fechar">
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={APARECE} style={styles.legenda}>
          <View style={styles.legendaLinha}>
            {(Object.keys(SITUACOES) as SituacaoTerritorio[]).map((id) => (
              <View key={id} style={styles.legendaItem}>
                <View style={[styles.legendaCor, { backgroundColor: SITUACOES[id].cor(colors) }]} />
                <Text style={styles.legendaTexto}>{SITUACOES[id].rotulo}</Text>
              </View>
            ))}
          </View>
          {mapaGeral.areas?.length || mapaGeral.limite ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsAreas}>
              {(mapaGeral.areas ?? []).map((a) => {
                const ativa = foco === a.nome;
                return (
                  <Pressable
                    key={a.nome}
                    style={[styles.chipArea, ativa && { borderColor: a.cor, backgroundColor: `${a.cor}22` }]}
                    onPress={() => {
                      setSelecionado(null);
                      setFoco(a.nome);
                      mapaRef.current?.enquadrar(a.aneis.flat());
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: ativa }}
                  >
                    <View style={[styles.chipAreaCor, { backgroundColor: `${a.cor}55`, borderColor: a.cor }]} />
                    <Text style={styles.legendaTexto}>{a.nome}</Text>
                  </Pressable>
                );
              })}
              {mapaGeral.limite ? (
                <Pressable
                  style={styles.chipArea}
                  onPress={() => {
                    setSelecionado(null);
                    setFoco(null);
                    mapaRef.current?.enquadrar();
                  }}
                  accessibilityRole="button"
                >
                  <View style={[styles.chipAreaCor, { borderColor: mapaGeral.limite.cor ?? colors.primaryDark, borderWidth: 2.5 }]} />
                  <Text style={styles.legendaTexto}>{mapaGeral.limite.nome}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    mapa: { flex: 1 },
    rodape: { position: "absolute", left: 12, right: 12, gap: 8 },
    textos: { flex: 1, gap: 3 },
    nome: { flex: 1, fontSize: 15.5, fontWeight: "700", color: colors.text },
    descricao: { fontSize: 13.5, lineHeight: 18, color: colors.textSecondary },
    ultima: { fontSize: 13, color: colors.textSecondary },
    legenda: { gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.surface, ...shadow.card },
    legendaLinha: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    legendaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendaCor: { width: 12, height: 12, borderRadius: 3 },
    legendaTexto: { fontSize: 12, fontWeight: "700", color: colors.text },
    chipsAreas: { gap: 8 },
    chipArea: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    chipAreaCor: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: "transparent" },
    previa: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      ...shadow.card,
    },
    previaSelo: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    previaSeloTexto: { color: "#fff", fontSize: 19, fontWeight: "900" },
    previaAbrir: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingLeft: 14,
      paddingRight: 10,
      height: 42,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    previaAbrirTexto: { color: colors.textOnPrimary, fontWeight: "800", fontSize: 14 },
    previaFechar: { position: "absolute", top: 6, right: 6, padding: 2 },
  });
