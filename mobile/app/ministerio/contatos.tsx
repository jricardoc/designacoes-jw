import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useRevisitas } from "@/api/hooks/usePioneiro";
import type { Revisita, TipoVisita } from "@/api/types";
import { useAcoesContato } from "@/components/ministerio/acoesContato";
import { quando } from "@/components/ministerio/escolhas";
import {
  BotaoIcone,
  CabecalhoMinisterio,
  entrada,
  linkComoChegar,
  MenuAcoes,
  Pilula,
  quandoRelativo,
  Segmentos,
  SITUACAO,
  situacaoDe,
  TituloTela,
  useRecuo,
  Vidro,
} from "@/components/ministerio/kit";
import { RevisitaSheet } from "@/components/ministerio/RevisitaSheet";
import { VisitaSheet } from "@/components/ministerio/VisitaSheet";
import { mapaDisponivel, provedor } from "@/components/territorio/MapaTerritorio";
import { Button, EmptyState, iniciais } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

type Filtro = "todos" | "estudos" | "marcados" | "semData" | "arquivados";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "estudos", rotulo: "Estudos" },
  { valor: "marcados", rotulo: "Com visita marcada" },
  { valor: "semData", rotulo: "Sem data" },
  { valor: "arquivados", rotulo: "Arquivados" },
];

/** "Conceição" e "conceicao" casam na busca. */
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const abrirContato = (id: number) => router.push({ pathname: "/ministerio/contato", params: { id: String(id) } });

/** Os contatos (revisitas e estudos) em lista ou no mapa, com a situação de cada um na cor do pino. */
export default function ContatosMinisterio() {
  const { colors, styles } = useTema(criarEstilos);
  const recuo = useRecuo();
  const [modo, setModo] = useState<"lista" | "mapa">("lista");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const { data: revisitas = [], isLoading, refetch } = useRevisitas(filtro === "arquivados");
  const puxar = usePuxar(refetch);
  const acoesDe = useAcoesContato();
  const [menu, setMenu] = useState<Revisita | null>(null);
  const [visita, setVisita] = useState<{ id: number; nome: string; tipo: TipoVisita } | null>(null);
  const [editando, setEditando] = useState<Revisita | null>(null);
  const [novo, setNovo] = useState(false);

  const lista = useMemo(() => {
    const q = normal(busca.trim());
    return revisitas.filter((r) => {
      if (q && !normal(`${r.nome} ${r.endereco ?? ""}`).includes(q)) return false;
      if (filtro === "estudos") return r.estudo;
      if (filtro === "marcados") return !!r.proximaVisita;
      if (filtro === "semData") return !r.proximaVisita;
      return true;
    });
  }, [revisitas, busca, filtro]);

  return (
    <View style={styles.tela}>
      <CabecalhoMinisterio />
      <View style={styles.topo}>
        <TituloTela titulo="Contatos" subtitulo={`${revisitas.length} ${filtro === "arquivados" ? "arquivados" : revisitas.length === 1 ? "contato" : "contatos"}`} />
        <Segmentos
          opcoes={[
            { valor: "lista", rotulo: "Lista", icone: "list" },
            { valor: "mapa", rotulo: "Mapa", icone: "map" },
          ]}
          valor={modo}
          onMudar={setModo}
        />
      </View>

      {modo === "lista" ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, recuo]}
          refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.busca}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por nome ou endereço"
              placeholderTextColor={colors.textMuted}
              style={styles.buscaCampo}
              returnKeyType="search"
              accessibilityLabel="Buscar contato"
            />
            {busca ? (
              <Pressable onPress={() => setBusca("")} hitSlop={8} accessibilityLabel="Limpar a busca">
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros} keyboardShouldPersistTaps="handled">
            {FILTROS.map((f) => {
              const ativo = f.valor === filtro;
              return (
                <Pressable
                  key={f.valor}
                  onPress={() => setFiltro(f.valor)}
                  style={[styles.filtro, ativo && styles.filtroAtivo]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativo }}
                >
                  <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo]}>{f.rotulo}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {lista.length ? (
            <Vidro style={styles.lista}>
              {lista.map((r, i) => {
                const s = situacaoDe(r.proximaVisita);
                return (
                  <Animated.View key={r.id} entering={entrada(i)}>
                    <Pressable
                      onPress={() => abrirContato(r.id)}
                      onLongPress={() => setMenu(r)}
                      delayLongPress={350}
                      style={({ pressed }) => [styles.item, i > 0 && styles.itemBorda, pressed && styles.pressionado]}
                      accessibilityRole="button"
                      accessibilityHint="Toque longo para mais ações"
                    >
                      <View style={[styles.avatar, { backgroundColor: SITUACAO[s].fundo(colors) }]}>
                        <Text style={[styles.avatarTexto, { color: SITUACAO[s].cor(colors) }]}>{iniciais(r.nome)}</Text>
                      </View>
                      <View style={styles.flex}>
                        <View style={styles.linha}>
                          <Text style={styles.nome} numberOfLines={1}>
                            {r.nome}
                          </Text>
                          {r.estudo ? <Ionicons name="book" size={14} color={colors.purple} accessibilityLabel="Estudo bíblico" /> : null}
                        </View>
                        <View style={styles.linha}>
                          <Pilula situacao={s} texto={r.proximaVisita ? quandoRelativo(r.proximaVisita) : undefined} />
                          {r.proximaVisita ? (
                            <Text style={styles.detalhe} numberOfLines={1}>
                              {quando(r.proximaVisita)}
                            </Text>
                          ) : null}
                        </View>
                        {r.endereco ? (
                          <Text style={styles.detalhe} numberOfLines={1}>
                            {r.endereco}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </Vidro>
          ) : isLoading ? null : (
            <EmptyState
              icon={busca || filtro !== "todos" ? "search-outline" : "people-outline"}
              title={busca || filtro !== "todos" ? "Nada por aqui" : "Nenhum contato ainda"}
              message={busca || filtro !== "todos" ? "Tente outra busca ou outro filtro." : "Anote as pessoas que você revisita e os estudos."}
            >
              {!busca && filtro === "todos" ? <Button label="Novo contato" icon="person-add" onPress={() => setNovo(true)} /> : null}
            </EmptyState>
          )}
        </ScrollView>
      ) : (
        <MapaContatos contatos={lista} />
      )}

      <MenuAcoes
        visible={!!menu}
        onClose={() => setMenu(null)}
        titulo={menu?.nome}
        subtitulo={menu?.endereco}
        acoes={
          menu
            ? acoesDe(menu, {
                registrar: () => setVisita({ id: menu.id, nome: menu.nome, tipo: menu.estudo ? "estudo" : "conversa" }),
                editar: () => setEditando(menu),
              })
            : []
        }
      />
      <VisitaSheet revisitaId={visita?.id ?? null} nome={visita?.nome ?? ""} tipo={visita?.tipo} onClose={() => setVisita(null)} />
      <RevisitaSheet
        visible={!!editando || novo}
        revisita={editando}
        onClose={() => {
          setEditando(null);
          setNovo(false);
        }}
      />
    </View>
  );
}

/** O mapa dos contatos: o pino na cor da situação (com ícone: estudo ou revisita), satélite e o cartão do escolhido. */
function MapaContatos({ contatos }: { contatos: Revisita[] }) {
  const { colors, styles } = useTema(criarEstilos);
  const recuo = useRecuo();
  const mapa = useRef<MapView>(null);
  const [satelite, setSatelite] = useState(false);
  const [escolhido, setEscolhido] = useState<Revisita | null>(null);
  const noMapa = contatos.filter((r) => r.lat != null && r.lng != null);
  const coordenadas = noMapa.map((r) => ({ latitude: r.lat as number, longitude: r.lng as number }));

  // Pinos com view própria desenham uma vez com rastreio ligado (senão saem em branco no
  // Android) e depois desligam, que é o que mantém o mapa leve ao arrastar.
  const [rastrear, setRastrear] = useState(true);
  const assinatura = `${noMapa.map((r) => `${r.id}:${situacaoDe(r.proximaVisita)}`).join("|")}#${escolhido?.id ?? ""}`;
  useEffect(() => {
    setRastrear(true);
    const t = setTimeout(() => setRastrear(false), 700);
    return () => clearTimeout(t);
  }, [assinatura]);

  if (!mapaDisponivel) {
    return <EmptyState icon="map-outline" title="Mapa indisponível neste aparelho" message="Atualize o app pela loja para ver os contatos no mapa." />;
  }
  if (!noMapa.length) {
    return (
      <EmptyState
        icon="location-outline"
        title="Nenhum contato no mapa"
        message="Ao anotar ou editar um contato, toque em “Usar minha localização” e ele aparece aqui."
      />
    );
  }

  const enquadrar = (animado = true) =>
    mapa.current?.fitToCoordinates(coordenadas, { edgePadding: { top: 90, right: 60, bottom: recuo.paddingBottom + 60, left: 60 }, animated: animado });
  const lats = coordenadas.map((c) => c.latitude);
  const lngs = coordenadas.map((c) => c.longitude);
  const inicial = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(0.01, (Math.max(...lats) - Math.min(...lats)) * 1.6),
    longitudeDelta: Math.max(0.01, (Math.max(...lngs) - Math.min(...lngs)) * 1.6),
  };
  const rota = escolhido ? linkComoChegar(escolhido) : null;
  const s = escolhido ? situacaoDe(escolhido.proximaVisita) : "semData";

  return (
    <View style={styles.flex}>
      <MapView
        ref={mapa}
        provider={provedor}
        style={StyleSheet.absoluteFill}
        mapType={satelite ? "hybrid" : "standard"}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        initialRegion={inicial}
        onMapReady={() => enquadrar(false)}
      >
        {noMapa.map((r) => {
          const cor = SITUACAO[situacaoDe(r.proximaVisita)].cor(colors);
          const ativo = escolhido?.id === r.id;
          return (
            <Marker
              key={r.id}
              coordinate={{ latitude: r.lat as number, longitude: r.lng as number }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={rastrear}
              onPress={() => setEscolhido(r)}
            >
              <View style={[styles.pino, { backgroundColor: cor }, ativo && styles.pinoAtivo]}>
                <Ionicons name={r.estudo ? "book" : "person"} size={ativo ? 17 : 14} color="#FFFFFF" />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.legenda} pointerEvents="none">
        {(["atrasada", "hoje", "breve", "marcada", "semData"] as const).map((k) => (
          <View key={k} style={styles.legendaItem}>
            <View style={[styles.legendaPonto, { backgroundColor: SITUACAO[k].cor(colors) }]} />
            <Text style={styles.legendaTexto}>{SITUACAO[k].rotulo}</Text>
          </View>
        ))}
      </View>
      <View style={styles.mapaBotoes}>
        <BotaoIcone icone="earth" rotulo={satelite ? "Mapa comum" : "Satélite"} ativo={satelite} onPress={() => setSatelite((v) => !v)} />
        <BotaoIcone icone="scan-outline" rotulo="Mostrar todos" onPress={() => enquadrar()} />
      </View>

      {escolhido ? (
        <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(180)} style={[styles.previa, { bottom: recuo.paddingBottom - 34 }]}>
          <Vidro style={styles.previaCartao}>
            <View style={styles.linha}>
              <View style={styles.flex}>
                <Text style={styles.nome} numberOfLines={1}>
                  {escolhido.nome}
                </Text>
                <Pilula situacao={s} texto={escolhido.proximaVisita ? `${quandoRelativo(escolhido.proximaVisita)} · ${quando(escolhido.proximaVisita)}` : undefined} />
              </View>
              <Pressable onPress={() => setEscolhido(null)} hitSlop={10} accessibilityLabel="Fechar">
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            {escolhido.endereco ? <Text style={styles.detalhe}>{escolhido.endereco}</Text> : null}
            <View style={styles.linha}>
              <Button label="Abrir" icon="person-circle-outline" onPress={() => abrirContato(escolhido.id)} style={styles.flex} />
              {rota ? <Button label="Navegar" icon="navigate" variant="secondary" onPress={() => Linking.openURL(rota)} style={styles.flex} /> : null}
            </View>
          </Vidro>
        </Animated.View>
      ) : null}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1 },
    flex: { flex: 1 },
    pressionado: { opacity: 0.7 },
    topo: { paddingHorizontal: 16, gap: 12, paddingBottom: 12 },
    scroll: { paddingHorizontal: 16, gap: 12 },
    busca: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buscaCampo: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.text },
    filtros: { gap: 8, paddingRight: 16 },
    filtro: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    filtroAtivo: { backgroundColor: colors.text, borderColor: colors.text },
    filtroTexto: { fontSize: 13.5, fontWeight: "700", color: colors.textSecondary },
    filtroTextoAtivo: { color: colors.background },
    lista: { padding: 0 },
    item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
    itemBorda: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
    avatarTexto: { fontSize: 16, fontWeight: "900" },
    linha: { flexDirection: "row", alignItems: "center", gap: 8 },
    nome: { flexShrink: 1, fontSize: 16, fontWeight: "800", color: colors.text },
    detalhe: { flexShrink: 1, fontSize: 13, color: colors.textSecondary, marginTop: 3 },
    pino: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2.5,
      borderColor: "#FFFFFF",
    },
    pinoAtivo: { width: 38, height: 38, borderRadius: 19 },
    legenda: {
      position: "absolute",
      top: 10,
      left: 12,
      gap: 4,
      padding: 10,
      borderRadius: 16,
      backgroundColor: colors.surface,
      opacity: 0.94,
    },
    legendaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendaPonto: { width: 9, height: 9, borderRadius: 5 },
    legendaTexto: { fontSize: 11.5, fontWeight: "700", color: colors.textSecondary },
    mapaBotoes: { position: "absolute", top: 10, right: 12, gap: 8 },
    previa: { position: "absolute", left: 16, right: 16 },
    previaCartao: { gap: 10 },
  });
