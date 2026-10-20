import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useImagemProtegida } from "@/api/hooks/useImagemProtegida";
import { preCarregarTerritorios, useMapaTerritorios, useTerritorios } from "@/api/hooks/useTerritorios";
import type { SituacaoTerritorio, TerritorioResumo } from "@/api/types";
import { SaidasDeCampo } from "@/components/config/SaidasDeCampo";
import { useBarraFlutuante } from "@/components/layout/contextoRolagem";
import { FilaBanner } from "@/components/territorio/FilaBanner";
import { MapaTerritorio, mapaDisponivel, type AreaMapa } from "@/components/territorio/MapaTerritorio";
import { Button, EmptyState, GradientHeader, Loading, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { DIAS_PARADO, diaCurto, quandoFoi, SITUACOES } from "@/territorios/constantes";
import { podeGerenciar } from "@/utils/permissoes";

/** Acentos fora da busca: "joao" tem que achar "João". */
const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Filtro = "todos" | "parados" | SituacaoTerritorio | "designados";

const FILTROS: { id: Filtro; rotulo: string; passa: (t: TerritorioResumo) => boolean }[] = [
  { id: "todos", rotulo: "Todos", passa: () => true },
  { id: "parados", rotulo: `Parados ${DIAS_PARADO}+ dias`, passa: (t) => (t.diasSemTrabalho ?? 0) >= DIAS_PARADO },
  { id: "andamento", rotulo: "Em andamento", passa: (t) => t.situacao === "andamento" },
  { id: "concluido", rotulo: "Concluídos", passa: (t) => t.situacao === "concluido" },
  { id: "sem_registro", rotulo: "Sem registro", passa: (t) => t.situacao === "sem_registro" },
  { id: "designados", rotulo: "Designados", passa: (t) => !!t.designacao },
];

/** Chave da "área" que junta todos, para não colidir com nome de área de verdade. */
const TODAS = "\u0000todas";

type Item =
  | { tipo: "area"; nome: string; lista: TerritorioResumo[] }
  | { tipo: "territorio"; t: TerritorioResumo };

/**
 * Miniatura do cartão com fallback: sem fonte (token ainda carregando) ou com erro de download,
 * mostra o ícone de mapa em vez de um retângulo cinza mudo.
 */
function Thumb({
  fonte,
  grande = false,
}: {
  fonte: { uri: string; headers: Record<string, string> } | null;
  grande?: boolean;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const [erro, setErro] = useState(false);
  const estilo = [styles.thumb, grande && styles.thumbGrande];
  if (!fonte || erro) {
    return (
      <View style={[estilo, styles.thumbVazio]}>
        <Ionicons name={erro ? "cloud-offline-outline" : "map-outline"} size={20} color={colors.textMuted} />
      </View>
    );
  }
  return <Image source={fonte} style={estilo} resizeMode="cover" onError={() => setErro(true)} />;
}

export default function TerritorioScreen() {
  // Chamado UMA vez, no topo: o conteúdo mora dentro de condicionais (carregando / vazio /
  // lista), e espalhar o hook lá dentro o tornaria uma chamada condicional.
  const { rolagem, recuo } = useBarraFlutuante();
  const { usuario } = useAuth();
  // Saída de campo é da área de dirigentes — é o escopo que o backend exige em /saidas-campo.
  const podeSaidas = podeGerenciar(usuario, "dirigentes");
  const [aba, setAba] = useState<"mapas" | "saidas">("mapas");
  const [modo, setModo] = useState<"lista" | "mapa">("lista");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  // A área aberta: null = a tela das áreas; TODAS = todos os territórios; "" = os sem área.
  const [area, setArea] = useState<string | null>(null);

  const { colors, styles } = useTema(criarEstilos);
  const { data, isLoading, isError, refetch, isRefetching } = useTerritorios();
  const doBanco = data?.fonte === "banco";
  const { data: mapaGeral } = useMapaTerritorios(doBanco && modo === "mapa");
  const imagem = useImagemProtegida();
  const gerencia = !!data?.permissoes.gerenciar;

  // Guarda todos os territórios no celular para abrir no campo sem sinal (de 6 em 6 horas).
  useEffect(() => {
    if (data && doBanco && !data.copiaLocalDe) preCarregarTerritorios(data.territorios.map((t) => t.numero));
  }, [doBanco, data]);

  const todos = useMemo(() => data?.territorios ?? [], [data]);

  // As áreas, na ordem do primeiro número de cada uma; "sem área" por último.
  const grupos = useMemo(() => {
    const mapa = new Map<string, TerritorioResumo[]>();
    for (const t of todos) {
      const nome = t.area?.trim() ?? "";
      mapa.set(nome, [...(mapa.get(nome) ?? []), t]);
    }
    return [...mapa]
      .map(([nome, lista]) => ({ nome, lista }))
      .sort((a, b) =>
        a.nome === "" ? 1 : b.nome === "" ? -1 : a.lista[0].numero.localeCompare(b.lista[0].numero, "pt-BR", { numeric: true }),
      );
  }, [todos]);
  // Sem nenhuma área cadastrada (instalação nova), a lista é plana, como antes.
  const temAreas = doBanco && grupos.some((g) => g.nome !== "");
  const naTelaDasAreas = temAreas && area === null && !busca.trim();

  // O voltar do Android, dentro de uma área, volta para as áreas — e não sai da aba.
  useEffect(() => {
    if (area === null) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setArea(null);
      return true;
    });
    return () => sub.remove();
  }, [area]);

  const base = useMemo(
    () => (area === null || area === TODAS ? todos : todos.filter((t) => (t.area?.trim() ?? "") === area)),
    [todos, area],
  );
  const territorios = useMemo(() => {
    const termo = normalizar(busca.trim()).replace(/^0+(?=\d)/, "");
    const regra = FILTROS.find((f) => f.id === filtro)!;
    return base.filter(
      (t) =>
        regra.passa(t) &&
        (!termo ||
          t.numero.replace(/^0+(?=\d)/, "").toLowerCase().includes(termo) ||
          normalizar(`${t.nome} ${t.apelidos ?? ""} ${t.area ?? ""}`).includes(termo)),
    );
  }, [base, busca, filtro]);

  const itens: Item[] = naTelaDasAreas
    ? [...grupos.map((g) => ({ tipo: "area" as const, ...g })), { tipo: "area" as const, nome: TODAS, lista: todos }]
    : territorios.map((t) => ({ tipo: "territorio" as const, t }));
  const nomeDaArea = (nome: string) => (nome === TODAS ? "Todos os territórios" : nome || "Sem área");

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

  const abrir = (numero: string) => router.push({ pathname: "/territorio/[numero]", params: { numero } });

  const renderArea = (nome: string, lista: TerritorioResumo[]) => {
    const trabalhados = lista.filter((t) => t.ultimaSaida && (t.diasSemTrabalho ?? 99) < 30).length;
    const concluidos = lista.filter((t) => t.situacao === "concluido").length;
    const thumb = lista.find((t) => t.imagens?.thumb)?.imagens?.thumb;
    return (
      <Pressable
        style={({ pressed }) => [styles.areaCard, nome === TODAS && styles.areaTodas, pressed && { opacity: 0.85 }]}
        onPress={() => {
          setArea(nome);
          setFiltro("todos");
        }}
        accessibilityRole="button"
        accessibilityLabel={`${nomeDaArea(nome)}, ${lista.length} territórios`}
      >
        {thumb ? (
          <Thumb fonte={imagem(thumb)} grande />
        ) : (
          <View style={[styles.thumb, styles.thumbGrande, styles.thumbVazio]}>
            <Ionicons name={nome === TODAS ? "albums-outline" : "map-outline"} size={26} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.textos}>
          <Text style={styles.areaNome}>{nomeDaArea(nome)}</Text>
          <Text style={styles.areaSub}>
            {lista.length} território{lista.length > 1 ? "s" : ""} · {lista[0].numero} a {lista[lista.length - 1].numero}
          </Text>
          <Text style={styles.areaSub}>
            {trabalhados} trabalhado{trabalhados === 1 ? "" : "s"} nos últimos 30 dias
          </Text>
          <View style={styles.progresso}>
            <View style={[styles.progressoCheio, { width: `${(concluidos / lista.length) * 100}%` }]} />
          </View>
          <Text style={styles.progressoTexto}>
            {concluidos} de {lista.length} concluídos no ciclo
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  };

  const renderItem = ({ item: linha }: { item: Item }) => {
    if (linha.tipo === "area") return renderArea(linha.nome, linha.lista);
    const item = linha.t;
    const s = SITUACOES[item.situacao];
    const parado = (item.diasSemTrabalho ?? 0) >= DIAS_PARADO;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        onPress={() => abrir(item.numero)}
        accessibilityRole="button"
        accessibilityLabel={`Território ${item.numero}, ${item.nome}, ${s.rotulo}`}
      >
        <View style={[styles.faixa, { backgroundColor: s.cor(colors) }]} />
        {item.imagens?.thumb ? <Thumb fonte={imagem(item.imagens.thumb)} /> : null}
        <View style={styles.textos}>
          <View style={styles.linhaTopo}>
            <Text style={styles.numero}>{item.numero}</Text>
            <Text style={styles.nome} numberOfLines={1}>
              {item.nome}
            </Text>
          </View>
          <Text style={styles.ultima} numberOfLines={1}>
            {item.ultimaSaida
              ? `Última saída ${quandoFoi(item.ultimaSaida.dia)}${item.ultimaSaida.autor ? ` · ${item.ultimaSaida.autor}` : ""}`
              : doBanco
                ? "Nunca trabalhado"
                : "Cartão de mapa"}
          </Text>
          {doBanco ? (
            <View style={styles.selos}>
              <View style={[styles.selo, { backgroundColor: s.fundo(colors) }]}>
                <Text style={[styles.seloTexto, { color: s.cor(colors) }]}>{s.rotulo}</Text>
              </View>
              {item.designacao ? (
                <View style={[styles.selo, { backgroundColor: colors.tealBg }]}>
                  <Ionicons name="person" size={11} color={colors.teal} />
                  <Text style={[styles.seloTexto, { color: colors.teal }]}>
                    {item.designacao.dirigente.split(" ")[0]} · {diaCurto(item.designacao.dia)}
                  </Text>
                </View>
              ) : null}
              {parado ? (
                <View style={[styles.selo, { backgroundColor: colors.warningBg }]}>
                  <Ionicons name="hourglass-outline" size={11} color={colors.amber} />
                  <Text style={[styles.seloTexto, { color: colors.amber }]}>{item.diasSemTrabalho} dias</Text>
                </View>
              ) : null}
              {item.naoBater.total > 0 ? (
                <View style={[styles.selo, { backgroundColor: colors.dangerBg }]}>
                  <Ionicons name="hand-left" size={11} color={colors.redDark} />
                  <Text style={[styles.seloTexto, { color: colors.redDark }]}>
                    {item.naoBater.total}
                    {item.naoBater.vencidas ? ` · ${item.naoBater.vencidas} reconfirmar` : ""}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  };

  const contagem = (f: (typeof FILTROS)[number]) => base.filter(f.passa).length;

  return (
    <View style={styles.flex}>
      <GradientHeader
        title="Território"
        description={
          doBanco
            ? `${todos.length} territórios · ${todos.filter((t) => t.situacao === "concluido").length} concluídos no ciclo`
            : "Cartões de mapa de território da congregação"
        }
        icon="map"
        right={
          gerencia ? (
            <Pressable style={styles.gerenciar} onPress={() => router.push("/territorio/painel")} hitSlop={8}>
              <Ionicons name="stats-chart" size={16} color={colors.textOnPrimary} />
              <Text style={styles.gerenciarTexto}>Gerenciar</Text>
            </Pressable>
          ) : undefined
        }
      />

      {podeSaidas ? (
        <View style={styles.segmented}>
          {(["mapas", "saidas"] as const).map((s) => {
            const ativa = aba === s;
            return (
              <Pressable
                key={s}
                style={[styles.segment, ativa && styles.segmentActive]}
                onPress={() => setAba(s)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativa }}
              >
                <Ionicons
                  name={s === "mapas" ? "map-outline" : "send-outline"}
                  size={16}
                  color={ativa ? colors.primaryDark : colors.textSecondary}
                />
                <Text style={[styles.segmentText, ativa && styles.segmentTextActive]}>
                  {s === "mapas" ? "Territórios" : "Saídas de campo"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {aba === "saidas" && podeSaidas ? (
        <ScrollView {...rolagem} contentContainerStyle={[styles.scrollSaidas, recuo]}>
          <SaidasDeCampo />
        </ScrollView>
      ) : isLoading ? (
        <Loading label="Carregando territórios..." />
      ) : isError ? (
        <EmptyState icon="cloud-offline" title="Não foi possível carregar os territórios" message="Verifique a conexão e tente novamente.">
          <Button label="Tentar de novo" onPress={() => refetch()} />
        </EmptyState>
      ) : modo === "mapa" && doBanco ? (
        <View style={styles.flex}>
          <MapaTerritorio areas={areas} onAreaPress={(chave) => abrir(chave.split("|")[0])} style={styles.mapaGeral} />
          <View style={styles.legenda}>
            {(Object.keys(SITUACOES) as SituacaoTerritorio[]).map((id) => (
              <View key={id} style={styles.legendaItem}>
                <View style={[styles.legendaCor, { backgroundColor: SITUACOES[id].cor(colors) }]} />
                <Text style={styles.legendaTexto}>{SITUACOES[id].rotulo}</Text>
              </View>
            ))}
          </View>
          <Pressable style={[styles.alternar, styles.alternarFlutuante]} onPress={() => setModo("lista")}>
            <Ionicons name="list" size={18} color={colors.textOnPrimary} />
            <Text style={styles.alternarTexto}>Lista</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          {...rolagem}
          data={itens}
          keyExtractor={(i) => (i.tipo === "area" ? `area:${i.nome}` : i.t.numero)}
          renderItem={renderItem}
          contentContainerStyle={[styles.lista, recuo]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          ListHeaderComponent={
            <View style={styles.topo}>
              {data?.copiaLocalDe ? (
                <View style={styles.offline}>
                  <Ionicons name="cloud-offline-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.offlineTexto}>Sem internet: mostrando a última cópia guardada neste celular.</Text>
                </View>
              ) : null}
              <FilaBanner />
              {!doBanco && gerencia ? (
                <Pressable style={styles.importar} onPress={() => router.push("/territorio/importar")}>
                  <Ionicons name="cloud-download" size={22} color={colors.textOnPrimary} />
                  <View style={styles.textos}>
                    <Text style={styles.importarTitulo}>Importar os mapas do My Maps</Text>
                    <Text style={styles.importarSub}>Os territórios ganham mapa de verdade, GPS e onde paramos.</Text>
                  </View>
                </Pressable>
              ) : null}
              {temAreas && area !== null ? (
                <View style={styles.areaTopo}>
                  <Pressable style={styles.voltarArea} onPress={() => setArea(null)} hitSlop={8}>
                    <Ionicons name="chevron-back" size={18} color={colors.primaryDark} />
                    <Text style={styles.voltarAreaTexto}>Áreas</Text>
                  </Pressable>
                  <Text style={styles.areaTitulo}>{nomeDaArea(area)}</Text>
                </View>
              ) : null}
              <View style={styles.buscaLinha}>
                <View style={styles.flex}>
                  <TextField
                    icon="search"
                    placeholder="Número, nome ou rua..."
                    value={busca}
                    onChangeText={setBusca}
                    autoCorrect={false}
                  />
                </View>
                {doBanco && mapaDisponivel ? (
                  <Pressable style={styles.alternar} onPress={() => setModo("mapa")} accessibilityLabel="Ver no mapa">
                    <Ionicons name="map" size={18} color={colors.textOnPrimary} />
                    <Text style={styles.alternarTexto}>Mapa</Text>
                  </Pressable>
                ) : null}
              </View>
              {doBanco && !naTelaDasAreas ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros}>
                  {FILTROS.map((f) => {
                    const ativo = filtro === f.id;
                    return (
                      <Pressable key={f.id} onPress={() => setFiltro(f.id)} style={[styles.filtro, ativo && styles.filtroAtivo]}>
                        <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}>
                          {f.rotulo} · {contagem(f)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            busca.trim() || filtro !== "todos" ? (
              <EmptyState icon="map-outline" title="Nenhum território encontrado" message="Tente outro número, nome ou filtro." />
            ) : (
              <EmptyState
                icon="map-outline"
                title="Nenhum território cadastrado"
                message={
                  gerencia
                    ? "Toque em \"Gerenciar\" para importar os mapas do My Maps."
                    : "Os territórios aparecem aqui quando forem cadastrados."
                }
              />
            )
          }
        />
      )}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    gerenciar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
    },
    gerenciarTexto: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 13 },
    segmented: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: colors.sand,
      borderRadius: radius.md,
      padding: 5,
      gap: 5,
    },
    segment: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: radius.sm,
    },
    segmentActive: { backgroundColor: colors.surface, ...shadow.card },
    segmentText: { fontWeight: "700", color: colors.textSecondary, fontSize: 13.5 },
    segmentTextActive: { color: colors.primaryDark },
    scrollSaidas: { padding: 16 },
    lista: { padding: 16, gap: 10 },
    topo: { gap: 10, marginBottom: 4 },
    offline: { flexDirection: "row", gap: 8, alignItems: "center", padding: 10, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
    offlineTexto: { flex: 1, fontSize: 12.5, color: colors.textSecondary },
    importar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
    },
    importarTitulo: { fontSize: 16, fontWeight: "800", color: colors.textOnPrimary },
    importarSub: { fontSize: 12.5, color: colors.textOnPrimary, opacity: 0.85 },
    buscaLinha: { flexDirection: "row", alignItems: "center", gap: 10 },
    alternar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 48,
      paddingHorizontal: 14,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    alternarFlutuante: { position: "absolute", top: 12, right: 12, ...shadow.card },
    alternarTexto: { color: colors.textOnPrimary, fontWeight: "800", fontSize: 14 },
    filtros: { gap: 8, paddingRight: 8 },
    filtro: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    filtroAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    filtroTexto: { fontSize: 13, fontWeight: "700", color: colors.text },
    filtroTextoAtivo: { color: colors.textOnPrimary },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingVertical: 12,
      paddingRight: 14,
      overflow: "hidden",
      ...shadow.card,
    },
    faixa: { width: 5, alignSelf: "stretch" },
    thumb: { width: 72, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
    thumbVazio: { alignItems: "center", justifyContent: "center" },
    thumbGrande: { width: 96, height: 76, marginLeft: 12 },
    areaCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingVertical: 12,
      paddingRight: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    areaTodas: { borderColor: colors.primary, borderWidth: 1.5 },
    areaNome: { fontSize: 19, fontWeight: "800", color: colors.text },
    areaSub: { fontSize: 13.5, color: colors.textSecondary },
    progresso: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: "hidden", marginTop: 6 },
    progressoCheio: { height: 6, borderRadius: 3, backgroundColor: colors.greenDark },
    progressoTexto: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
    areaTopo: { gap: 2 },
    voltarArea: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
    voltarAreaTexto: { fontSize: 14, fontWeight: "700", color: colors.primaryDark },
    areaTitulo: { fontSize: 22, fontWeight: "800", color: colors.text },
    textos: { flex: 1, gap: 3 },
    linhaTopo: { flexDirection: "row", alignItems: "baseline", gap: 8 },
    numero: { fontSize: 20, fontWeight: "900", color: colors.text },
    nome: { flex: 1, fontSize: 15.5, fontWeight: "700", color: colors.text },
    ultima: { fontSize: 13, color: colors.textSecondary },
    selos: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
    selo: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
    seloTexto: { fontSize: 11.5, fontWeight: "800" },
    mapaGeral: { flex: 1 },
    legenda: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 110,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      padding: 10,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      ...shadow.card,
    },
    legendaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendaCor: { width: 12, height: 12, borderRadius: 3 },
    legendaTexto: { fontSize: 12, fontWeight: "700", color: colors.text },
  });
