import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { useTerritorio } from "@/api/hooks/useTerritorios";
import type { SaidaTerritorio } from "@/api/types";
import { FilaBanner } from "@/components/territorio/FilaBanner";
import { GerenciarTerritorioSheet } from "@/components/territorio/GerenciarTerritorioSheet";
import { MapaTerritorio, mapaDisponivel, type MapaTerritorioRef, type PinoMapa } from "@/components/territorio/MapaTerritorio";
import { MarcarSheet, type PontoEscolhido } from "@/components/territorio/MarcarSheet";
import { PinoSheet } from "@/components/territorio/PinoSheet";
import { SaidaSheet } from "@/components/territorio/SaidaSheet";
import { Button, EmptyState, GradientHeader, Loading, useToast } from "@/components/ui";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { abrirComoChegar, AVISOS, CASA_TRABALHADA, MARCACOES, quandoFoi, SITUACOES } from "@/territorios/constantes";
import { useFilaTerritorios } from "@/territorios/fila";
import { minhaLocalizacao } from "@/territorios/gps";
import { usePuxar } from "@/utils/usePuxar";

/**
 * O território, de cima para baixo na ordem em que o dirigente precisa no campo: o mapa, a
 * situação, ONDE PARAMOS (aberto, nunca atrás de um botão), os avisos e, embaixo, as duas ações
 * grandes — marcar onde estou e registrar a saída.
 */
export default function TerritorioScreen() {
  // `marcacao` vem do toque no aviso de marcação: abre o território já no ponto.
  const { numero, marcacao } = useLocalSearchParams<{ numero: string; marcacao?: string }>();
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { data: t, isLoading, isError, error, refetch } = useTerritorio(numero);
  const puxar = usePuxar(refetch);
  const { itens: fila } = useFilaTerritorios();
  const mapa = useRef<MapaTerritorioRef>(null);
  const mapaCheio = useRef<MapaTerritorioRef>(null);
  const rolagem = useRef<ScrollView>(null);

  const [satelite, setSatelite] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [ponto, setPonto] = useState<PontoEscolhido | null>(null);
  const [saida, setSaida] = useState(false);
  const [gerenciar, setGerenciar] = useState(false);
  // O pino tocado no mapa: abre os detalhes e o "remover".
  const [pino, setPino] = useState<string | null>(null);

  // Veio do aviso de marcação: centraliza o mapa no ponto e abre os detalhes dele, uma vez.
  const pontoDoAviso = useRef(marcacao);
  useEffect(() => {
    const id = Number(pontoDoAviso.current);
    const m = id ? t?.marcacoes.find((x) => x.id === id) : undefined;
    if (!m) return;
    pontoDoAviso.current = undefined;
    // Espera o mapa montar: antes disso o pedido de mover a câmera se perde.
    setTimeout(() => {
      if (m.lat !== null && m.lng !== null) mapa.current?.focar(m.lat, m.lng);
      setPino(`m-${m.id}`);
    }, 700);
  }, [t]);

  const areas = useMemo(
    () => (t?.quadras ?? []).map((q) => ({ chave: String(q.id), nome: q.nome, pontos: q.pontos, cor: q.cor })),
    [t?.quadras],
  );

  const pinos = useMemo<PinoMapa[]>(() => {
    if (!t) return [];
    const doServidor = t.marcacoes
      .filter((m) => m.lat !== null && m.lng !== null)
      .map((m) => ({ chave: `m-${m.id}`, tipo: m.tipo, lat: m.lat!, lng: m.lng! }));
    const dasSaidas = t.ondeParamos
      .filter((s) => s.lat !== null && s.lng !== null)
      .map((s) => ({ chave: `s-${s.id}`, tipo: "parada" as const, lat: s.lat!, lng: s.lng! }));
    // O que está na fila do celular aparece já, tracejado: o irmão vê que marcou.
    const naFila = fila
      .filter((i) => i.numero === t.numero && i.tipo === "marcacao" && typeof i.corpo.lat === "number")
      .map((i) => ({
        chave: `f-${i.clientKey}`,
        tipo: i.corpo.tipo as PinoMapa["tipo"],
        lat: i.corpo.lat as number,
        lng: i.corpo.lng as number,
        pendente: true,
      }));
    return [...doServidor, ...dasSaidas, ...naFila];
  }, [t, fila]);

  if (isLoading) return <Loading label="Carregando território..." />;

  if (isError || !t) {
    const naoImportado = error instanceof ApiError && error.status === 404;
    return (
      <View style={styles.flex}>
        <GradientHeader title={`Território ${numero ?? ""}`} showBack />
        <EmptyState
          icon={naoImportado ? "map-outline" : "cloud-offline"}
          title={naoImportado ? "Território ainda sem mapa" : "Não foi possível carregar"}
          message={
            naoImportado
              ? "Ele aparece aqui depois que os mapas forem importados do My Maps."
              : "Sem internet e sem cópia guardada deste território. Tente de novo com sinal."
          }
        >
          {naoImportado ? (
            <Button
              label="Ver o cartão"
              icon="image-outline"
              onPress={() => router.push({ pathname: "/territorio/cartao", params: { numero } })}
            />
          ) : (
            <Button label="Tentar de novo" onPress={() => refetch()} />
          )}
        </EmptyState>
      </View>
    );
  }

  const situacao = SITUACOES[t.situacao];
  const designacao = t.designacoes.find((d) => !d.concluidoEm && d.dia >= new Date().toISOString().slice(0, 10));
  const naoBater = t.marcacoes.filter((m) => m.tipo === "nao_bater");
  const vencidas = naoBater.filter((m) => m.precisaReconfirmar).length;
  const territorio = { id: t.id, numero: t.numero, quadras: t.quadras };

  const marcarAqui = async () => {
    setBuscandoGps(true);
    try {
      const local = await minhaLocalizacao();
      setPonto({ ...local, origem: "gps" });
      (telaCheia ? mapaCheio : mapa).current?.focar(local.lat, local.lng);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Não consegui achar sua localização", "error");
    } finally {
      setBuscandoGps(false);
    }
  };

  // Onde continuar, se houver ponto marcado: o "próximo começa aqui" mais recente, senão o
  // "onde paramos" com GPS, senão o "paramos aqui". As marcações já vêm da mais nova à mais velha.
  const comGps = (m: { lat: number | null; lng: number | null }) => m.lat !== null && m.lng !== null;
  const continuar =
    t.marcacoes.find((m) => m.tipo === "proximo" && comGps(m)) ??
    t.ondeParamos.find(comGps) ??
    t.marcacoes.find((m) => m.tipo === "parada" && comGps(m));

  const comoChegar = () => {
    const pontos = t.quadras.flatMap((q) => q.pontos);
    const irAoTerritorio = () => {
      if (pontos.length === 0) return;
      const [lat, lng] = pontos.reduce(([a, b], [x, y]) => [a + x / pontos.length, b + y / pontos.length], [0, 0]);
      abrirComoChegar(lat, lng);
    };
    if (!continuar) return irAoTerritorio();
    Alert.alert("Como chegar", "Para onde você quer ir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Território", onPress: irAoTerritorio },
      { text: "Onde paramos", onPress: () => abrirComoChegar(continuar.lat!, continuar.lng!) },
    ]);
  };

  const verNoMapa = (s: SaidaTerritorio) => {
    if (s.lat === null || s.lng === null) return;
    rolagem.current?.scrollTo({ y: 0, animated: true });
    mapa.current?.focar(s.lat, s.lng);
  };

  const controlesDoMapa = (cheio: boolean) => (
    <View style={styles.controles}>
      <Pressable style={styles.controle} onPress={() => setSatelite((v) => !v)} accessibilityLabel="Alternar satélite">
        <Ionicons name={satelite ? "map" : "earth"} size={20} color={colors.text} />
      </Pressable>
      <Pressable
        style={styles.controle}
        onPress={() => (cheio ? mapaCheio : mapa).current?.enquadrar()}
        accessibilityLabel="Ver o território inteiro"
      >
        <Ionicons name="scan-outline" size={20} color={colors.text} />
      </Pressable>
      <Pressable
        style={styles.controle}
        onPress={() => setTelaCheia(!cheio)}
        accessibilityLabel={cheio ? "Fechar tela cheia" : "Mapa em tela cheia"}
      >
        <Ionicons name={cheio ? "contract" : "expand"} size={20} color={colors.text} />
      </Pressable>
    </View>
  );

  const botaoMarcar = (
    <Pressable
      style={[styles.marcar, buscandoGps && { opacity: 0.7 }]}
      onPress={marcarAqui}
      disabled={buscandoGps}
      accessibilityRole="button"
    >
      {buscandoGps ? (
        <ActivityIndicator color={colors.textOnPrimary} />
      ) : (
        <Ionicons name="location" size={26} color={colors.textOnPrimary} />
      )}
      <Text style={styles.marcarTexto}>{buscandoGps ? "Buscando sua localização..." : "Marcar onde estou"}</Text>
    </Pressable>
  );

  return (
    <View style={styles.flex}>
      <GradientHeader
        title={`Território ${t.numero}`}
        description={t.nome}
        showBack
        right={
          t.permissoes.gerenciar ? (
            <Pressable style={styles.gerenciar} onPress={() => setGerenciar(true)} hitSlop={8}>
              <Ionicons name="settings-outline" size={18} color={colors.primaryDark} />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        ref={rolagem}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl {...puxar} />}
      >
        {t.copiaLocalDe ? (
          <View style={styles.offline}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.offlineTexto}>
              Sem internet: mostrando a cópia guardada em {new Date(t.copiaLocalDe).toLocaleString("pt-BR")}
            </Text>
          </View>
        ) : null}

        <FilaBanner numero={t.numero} />

        {t.quadras.length > 0 ? (
          <View style={styles.mapaCaixa}>
            <MapaTerritorio ref={mapa} areas={areas} pinos={pinos} satelite={satelite} onPinoPress={setPino} />
            {mapaDisponivel ? controlesDoMapa(false) : null}
          </View>
        ) : null}

        <View style={styles.situacao}>
          <View style={[styles.selo, { backgroundColor: situacao.fundo(colors) }]}>
            <Ionicons name={situacao.icone} size={15} color={situacao.cor(colors)} />
            <Text style={[styles.seloTexto, { color: situacao.cor(colors) }]}>{situacao.rotulo}</Text>
          </View>
          <Text style={styles.ultima}>
            {t.ultimaSaida
              ? `Última saída ${quandoFoi(t.ultimaSaida.dia)}${t.ultimaSaida.autor ? ` · ${t.ultimaSaida.autor.nome}` : ""}`
              : "Ainda sem saída registrada"}
          </Text>
        </View>

        {designacao ? (
          <View style={styles.designado}>
            <Ionicons name="person-circle" size={20} color={colors.teal} />
            <Text style={styles.designadoTexto}>
              Designado para {designacao.dirigente.nome} · {quandoFoi(designacao.dia) === "hoje" ? "hoje" : designacao.dia.split("-").reverse().join("/")}
            </Text>
          </View>
        ) : null}

        {t.avisos.map((a) => (
          <View key={a.id} style={styles.aviso}>
            <Ionicons name="warning" size={18} color={colors.amber} />
            <Text style={styles.avisoTexto}>
              <Text style={styles.avisoTipo}>{AVISOS[a.tipo] ?? "Aviso"}: </Text>
              {a.texto}
            </Text>
          </View>
        ))}

        <Text style={styles.secao}>Onde paramos</Text>
        {t.ondeParamos.length === 0 ? (
          <View style={styles.vazio}>
            <Text style={styles.vazioTexto}>
              {t.situacao === "concluido"
                ? "Território concluído neste ciclo. A próxima saída começa do início."
                : "Ainda não há registro de onde pararam."}
            </Text>
          </View>
        ) : (
          t.ondeParamos.map((s) => (
            <View key={s.id} style={styles.parada}>
              <View style={styles.paradaTopo}>
                <View style={[styles.paradaIcone, { backgroundColor: MARCACOES.parada.cor(colors) }]}>
                  <Text style={styles.paradaLetra}>P</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.paradaParte}>{s.quadra?.nome ?? "Território inteiro"}</Text>
                  <Text style={styles.paradaOnde}>{s.ondeParou ?? "Ponto marcado no mapa"}</Text>
                </View>
              </View>
              {s.casaTrabalhada ? (
                <Text style={styles.paradaLinha}>
                  <Text style={styles.paradaRotulo}>Última casa trabalhada? </Text>
                  {CASA_TRABALHADA[s.casaTrabalhada].rotulo} — {CASA_TRABALHADA[s.casaTrabalhada].explicacao.toLowerCase()}
                </Text>
              ) : null}
              {s.proximoInicio ? (
                <Text style={styles.paradaLinha}>
                  <Text style={styles.paradaRotulo}>Próxima começa em: </Text>
                  {s.proximoInicio}
                </Text>
              ) : null}
              {s.pendente ? (
                <Text style={styles.paradaLinha}>
                  <Text style={styles.paradaRotulo}>Pendente: </Text>
                  {s.pendente}
                </Text>
              ) : null}
              <View style={styles.paradaRodape}>
                <Text style={styles.paradaAutor}>
                  {s.autor?.nome ?? "—"} · {quandoFoi(s.dia)}
                </Text>
                {s.lat !== null && s.lng !== null ? (
                  <View style={styles.links}>
                    {mapaDisponivel ? (
                      <Pressable onPress={() => verNoMapa(s)} hitSlop={8}>
                        <Text style={styles.link}>Ver no mapa</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => abrirComoChegar(s.lat!, s.lng!)} hitSlop={8}>
                      <Text style={styles.link}>Como chegar</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}

        {t.permissoes.marcar ? (
          <View style={styles.acoes}>
            {botaoMarcar}
            <Button label="Registrar saída" icon="checkmark-done" variant="secondary" onPress={() => setSaida(true)} fullWidth />
          </View>
        ) : null}

        <View style={styles.atalhos}>
          <Pressable
            style={styles.atalho}
            onPress={() => router.push({ pathname: "/territorio/nao-bater", params: { numero: t.numero } })}
          >
            <Ionicons name="hand-left" size={22} color={colors.redDark} />
            <Text style={styles.atalhoTexto}>Não bater</Text>
            <Text style={[styles.atalhoSub, vencidas > 0 && { color: colors.amber, fontWeight: "800" }]}>
              {naoBater.length === 0 ? "nenhuma" : vencidas > 0 ? `${vencidas} p/ reconfirmar` : `${naoBater.length} casa${naoBater.length > 1 ? "s" : ""}`}
            </Text>
          </Pressable>
          <Pressable
            style={styles.atalho}
            onPress={() => router.push({ pathname: "/territorio/historico", params: { numero: t.numero } })}
          >
            <Ionicons name="time" size={22} color={colors.primaryDark} />
            <Text style={styles.atalhoTexto}>Histórico</Text>
            <Text style={styles.atalhoSub}>saídas e pontos</Text>
          </Pressable>
          <Pressable style={styles.atalho} onPress={comoChegar}>
            <Ionicons name="navigate" size={22} color={colors.teal} />
            <Text style={styles.atalhoTexto}>Como chegar</Text>
            <Text style={styles.atalhoSub}>{continuar ? "ou onde paramos" : "no Google Maps"}</Text>
          </Pressable>
          {t.imagens?.mapa ? (
            <Pressable
              style={styles.atalho}
              onPress={() => router.push({ pathname: "/territorio/cartao", params: { numero: t.numero } })}
            >
              <Ionicons name="image" size={22} color={colors.brown} />
              <Text style={styles.atalhoTexto}>Cartão</Text>
              <Text style={styles.atalhoSub}>original</Text>
            </Pressable>
          ) : null}
        </View>

        {t.observacoes ? <Text style={styles.obs}>{t.observacoes}</Text> : null}
      </ScrollView>

      {/* Tela cheia: o mapa grande para andar com ele na rua. Segurar o dedo marca outro ponto. */}
      <Modal visible={telaCheia} animationType="slide" onRequestClose={() => setTelaCheia(false)}>
        <View style={styles.flex}>
          <MapaTerritorio
            ref={mapaCheio}
            areas={areas}
            pinos={pinos}
            satelite={satelite}
            onLongPress={t.permissoes.marcar ? (p) => setPonto({ ...p, precisao: null, origem: "mapa" }) : undefined}
            onPinoPress={setPino}
          />
          <View style={[styles.cheioTopo, { top: insets.top + 10 }]}>
            <Text style={styles.cheioTitulo} numberOfLines={1}>
              {t.numero} · {t.nome}
            </Text>
          </View>
          <View style={{ position: "absolute", right: 12, top: insets.top + 60 }}>{controlesDoMapa(true)}</View>
          <View style={[styles.cheioRodape, { paddingBottom: insets.bottom + 14 }]}>
            {t.permissoes.marcar ? (
              <>
                {botaoMarcar}
                <Text style={styles.cheioDica}>Para marcar outro lugar, segure o dedo no mapa.</Text>
              </>
            ) : null}
          </View>
          {/* Dentro do Modal: a folha precisa abrir por cima do mapa em tela cheia. */}
          <MarcarSheet territorio={territorio} ponto={telaCheia ? ponto : null} onClose={() => setPonto(null)} />
          <PinoSheet chave={telaCheia ? pino : null} territorio={t} onClose={() => setPino(null)} />
        </View>
      </Modal>

      <MarcarSheet territorio={territorio} ponto={telaCheia ? null : ponto} onClose={() => setPonto(null)} />
      <PinoSheet chave={telaCheia ? null : pino} territorio={t} onClose={() => setPino(null)} />
      <SaidaSheet territorio={territorio} visible={saida} onClose={() => setSaida(false)} />
      {t.permissoes.gerenciar ? (
        <GerenciarTerritorioSheet territorio={t} visible={gerenciar} onClose={() => setGerenciar(false)} />
      ) : null}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 12 },
    gerenciar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.infoBg,
      alignItems: "center",
      justifyContent: "center",
    },
    offline: { flexDirection: "row", gap: 8, alignItems: "center", padding: 10, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
    offlineTexto: { flex: 1, fontSize: 12.5, color: colors.textSecondary },
    mapaCaixa: { height: 320, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceMuted, ...shadow.card },
    controles: { position: "absolute", right: 10, top: 10, gap: 8 },
    controle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.card,
    },
    situacao: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
    selo: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill },
    seloTexto: { fontSize: 13, fontWeight: "800" },
    ultima: { fontSize: 14, color: colors.textSecondary, fontWeight: "600" },
    designado: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.tealBg },
    designadoTexto: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
    aviso: { flexDirection: "row", gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.warningBg },
    avisoTexto: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 19 },
    avisoTipo: { fontWeight: "800" },
    secao: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 6,
    },
    vazio: { padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    vazioTexto: { fontSize: 14, color: colors.textSecondary },
    parada: {
      padding: 14,
      gap: 8,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    paradaTopo: { flexDirection: "row", gap: 12, alignItems: "center" },
    paradaIcone: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    paradaLetra: { color: "#fff", fontWeight: "900", fontSize: 17 },
    paradaParte: { fontSize: 12, fontWeight: "800", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
    paradaOnde: { fontSize: 18, fontWeight: "800", color: colors.text },
    paradaLinha: { fontSize: 14, color: colors.text, lineHeight: 20 },
    paradaRotulo: { fontWeight: "700", color: colors.textSecondary },
    paradaRodape: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    paradaAutor: { fontSize: 12.5, color: colors.textMuted },
    link: { fontSize: 13.5, fontWeight: "800", color: colors.primaryDark },
    links: { flexDirection: "row", gap: 16 },
    acoes: { gap: 10, marginTop: 6 },
    marcar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      minHeight: 64,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      ...shadow.card,
    },
    marcarTexto: { fontSize: 18, fontWeight: "800", color: colors.textOnPrimary },
    atalhos: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
    atalho: {
      flexGrow: 1,
      flexBasis: "45%",
      gap: 2,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    atalhoTexto: { fontSize: 15.5, fontWeight: "800", color: colors.text, marginTop: 4 },
    atalhoSub: { fontSize: 12.5, color: colors.textSecondary },
    obs: { fontSize: 13, color: colors.textSecondary, fontStyle: "italic" },
    cheioTopo: {
      position: "absolute",
      left: 12,
      right: 70,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      ...shadow.card,
    },
    cheioTitulo: { fontSize: 15, fontWeight: "800", color: colors.text },
    cheioRodape: { position: "absolute", left: 12, right: 12, bottom: 0, gap: 8 },
    cheioDica: {
      textAlign: "center",
      fontSize: 12.5,
      fontWeight: "600",
      color: colors.text,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingVertical: 6,
      paddingHorizontal: 12,
      alignSelf: "center",
      overflow: "hidden",
    },
  });
