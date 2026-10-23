import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useImagemProtegida } from "@/api/hooks/useImagemProtegida";
import { useMapaTerritorios, useTerritorios } from "@/api/hooks/useTerritorios";
import type { SituacaoTerritorio, TerritorioResumo } from "@/api/types";
import { TituloTela, useRecuo } from "@/components/ministerio/kit";
import { CabecalhoTerritorio } from "@/components/territorio/CabecalhoTerritorio";
import { FilaBanner } from "@/components/territorio/FilaBanner";
import { mapaDisponivel } from "@/components/territorio/MapaTerritorio";
import { OndeEstou } from "@/components/territorio/OndeEstou";
import { APARECE, Pressionavel, Progresso } from "@/components/territorio/pecas";
import { Button, EmptyState, Loading, TextField } from "@/components/ui";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { DIAS_PARADO, diaCurto, quandoFoi, SITUACOES } from "@/territorios/constantes";
import { usePuxar } from "@/utils/usePuxar";

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

/** Os territórios: as áreas primeiro (com o quanto já foi trabalhado), e dentro delas a lista com filtros e busca. */
export default function ListaTerritoriosScreen() {
  // Vindo do mapa ("Lista" no cartão da área): abre já dentro da área.
  const params = useLocalSearchParams<{ area?: string }>();
  const { colors, styles } = useTema(criarEstilos);
  const recuo = useRecuo();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  // A área aberta: null = a tela das áreas; TODAS = todos os territórios; "" = os sem área.
  const [area, setArea] = useState<string | null>(params.area ?? null);

  const { data, isLoading, isError, refetch } = useTerritorios();
  const puxar = usePuxar(refetch);
  const doBanco = data?.fonte === "banco";
  // Sempre que há mapas: os contornos dizem em que território o irmão está.
  const { data: mapaGeral } = useMapaTerritorios(doBanco);
  const imagem = useImagemProtegida();
  const gerencia = !!data?.permissoes.gerenciar;

  const todos = useMemo(() => data?.territorios ?? [], [data]);
  const cores = data?.cores ?? {};

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

  // O voltar do Android sai da área antes de sair da aba.
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

  const abrir = (numero: string) => router.push({ pathname: "/territorio/[numero]", params: { numero } });
  // A aba Mapa, já enquadrada na área aberta (se ela tiver desenho no mapa).
  const verNoMapa = () =>
    router.replace(area && area !== TODAS ? { pathname: "/territorio", params: { area } } : "/territorio");

  const renderArea = (nome: string, lista: TerritorioResumo[]) => {
    const trabalhados = lista.filter((t) => t.ultimaSaida && (t.diasSemTrabalho ?? 99) < 30).length;
    const concluidos = lista.filter((t) => t.situacao === "concluido").length;
    const thumb = lista.find((t) => t.imagens?.thumb)?.imagens?.thumb;
    return (
      <Pressionavel
        style={[styles.areaCard, nome === TODAS && styles.areaTodas]}
        onPress={() => {
          setArea(nome);
          setFiltro("todos");
        }}
        accessibilityRole="button"
        accessibilityLabel={`${nomeDaArea(nome)}, ${lista.length} territórios`}
      >
        <View style={[styles.faixa, { backgroundColor: cores[nome] ?? (nome === TODAS ? colors.primary : colors.borderStrong) }]} />
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
          <Progresso fracao={concluidos / lista.length} />
          <Text style={styles.progressoTexto}>
            {concluidos} de {lista.length} concluídos no ciclo
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressionavel>
    );
  };

  const renderItem = ({ item: linha }: { item: Item }) => {
    if (linha.tipo === "area") return renderArea(linha.nome, linha.lista);
    const item = linha.t;
    const s = SITUACOES[item.situacao];
    const parado = (item.diasSemTrabalho ?? 0) >= DIAS_PARADO;
    return (
      <Pressionavel
        style={styles.card}
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
          {item.observacoes ? (
            <Text style={styles.descricao} numberOfLines={2}>
              {item.observacoes}
            </Text>
          ) : null}
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
      </Pressionavel>
    );
  };

  const contagem = (f: (typeof FILTROS)[number]) => base.filter(f.passa).length;

  return (
    <View style={styles.flex}>
      <CabecalhoTerritorio />
      {doBanco ? <OndeEstou territorios={mapaGeral?.territorios} resumos={todos} onAbrir={abrir} /> : null}

      {isLoading ? (
        <Loading label="Carregando territórios..." />
      ) : isError ? (
        <EmptyState icon="cloud-offline" title="Não foi possível carregar os territórios" message="Verifique a conexão e tente novamente.">
          <Button label="Tentar de novo" onPress={() => refetch()} />
        </EmptyState>
      ) : (
        <Animated.FlatList
          // Entrar numa área (ou voltar para a lista de áreas) é outra lista: troca com um fade só.
          key={`lista:${area ?? ""}`}
          entering={APARECE}
          data={itens}
          keyExtractor={(i) => (i.tipo === "area" ? `area:${i.nome}` : i.t.numero)}
          renderItem={renderItem}
          contentContainerStyle={[styles.lista, recuo]}
          refreshControl={<RefreshControl {...puxar} />}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          ListHeaderComponent={
            <View style={styles.topo}>
              {area === null ? (
                <TituloTela
                  titulo="Territórios"
                  subtitulo={
                    doBanco
                      ? `${todos.length} territórios · ${todos.filter((t) => t.situacao === "concluido").length} concluídos no ciclo`
                      : "Cartões de mapa de território da congregação"
                  }
                />
              ) : null}
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
                  <View style={styles.areaTituloLinha}>
                    {cores[area] ? <View style={[styles.areaTituloCor, { backgroundColor: cores[area] }]} /> : null}
                    <Text style={styles.areaTitulo}>{nomeDaArea(area)}</Text>
                  </View>
                </View>
              ) : null}
              <View style={styles.buscaLinha}>
                <View style={styles.flex1}>
                  <TextField
                    icon="search"
                    placeholder="Número, nome ou rua..."
                    value={busca}
                    onChangeText={setBusca}
                    autoCorrect={false}
                  />
                </View>
                {doBanco && mapaDisponivel ? (
                  <Pressable style={styles.alternar} onPress={verNoMapa} accessibilityLabel="Ver no mapa">
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
    flex1: { flex: 1 },
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
    thumbGrande: { width: 96, height: 76 },
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
      overflow: "hidden",
      ...shadow.card,
    },
    areaTodas: { borderColor: colors.primary, borderWidth: 1.5 },
    areaNome: { fontSize: 19, fontWeight: "800", color: colors.text },
    areaSub: { fontSize: 13.5, color: colors.textSecondary },
    progressoTexto: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
    areaTopo: { gap: 2 },
    voltarArea: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
    voltarAreaTexto: { fontSize: 14, fontWeight: "700", color: colors.primaryDark },
    areaTituloLinha: { flexDirection: "row", alignItems: "center", gap: 8 },
    areaTituloCor: { width: 14, height: 14, borderRadius: 7 },
    areaTitulo: { fontSize: 22, fontWeight: "800", color: colors.text },
    textos: { flex: 1, gap: 3 },
    descricao: { fontSize: 13.5, lineHeight: 18, color: colors.textSecondary },
    linhaTopo: { flexDirection: "row", alignItems: "baseline", gap: 8 },
    numero: { fontSize: 20, fontWeight: "900", color: colors.text },
    nome: { flex: 1, fontSize: 15.5, fontWeight: "700", color: colors.text },
    ultima: { fontSize: 13, color: colors.textSecondary },
    selos: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
    selo: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
    seloTexto: { fontSize: 11.5, fontWeight: "800" },
  });
