import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from "react-native-maps";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRevisitas } from "@/api/hooks/usePioneiro";
import type { Revisita } from "@/api/types";
import { diaCurto, isoDoDia, quando } from "@/components/ministerio/escolhas";
import { RevisitaSheet } from "@/components/ministerio/RevisitaSheet";
import { mapaDisponivel } from "@/components/territorio/MapaTerritorio";
import { Button, EmptyState, GradientHeader, Loading } from "@/components/ui";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { usePuxar } from "@/utils/usePuxar";

const extra = Constants.expoConfig?.extra as { mapaGoogle?: { ios?: boolean } } | undefined;
// O mesmo provedor do mapa dos territórios: Google no Android (e no iPhone com chave), Apple no resto.
const provedor = Platform.OS === "android" || extra?.mapaGoogle?.ios ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

type Filtro = "todas" | "estudos" | "arquivadas";

/** As revisitas e os estudos do pioneiro, em lista ou no mapa. */
export default function RevisitasScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [modo, setModo] = useState<"lista" | "mapa">("lista");
  const [nova, setNova] = useState(false);
  const { data, isLoading, refetch } = useRevisitas(filtro === "arquivadas");
  const puxar = usePuxar(refetch);

  const lista = useMemo(() => (data ?? []).filter((r) => filtro !== "estudos" || r.estudo), [data, filtro]);
  const comPosicao = lista.filter((r) => r.lat != null && r.lng != null);
  const hoje = isoDoDia(new Date());
  const abrir = (r: Revisita) => router.push({ pathname: "/ministerio/revisita", params: { id: String(r.id) } });

  const regiao = useMemo(() => {
    if (comPosicao.length === 0) return undefined;
    const lats = comPosicao.map((r) => r.lat as number);
    const lngs = comPosicao.map((r) => r.lng as number);
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5),
      longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.5),
    };
  }, [comPosicao]);

  const cartao = (r: Revisita, i: number) => {
    const visitaHoje = r.proximaVisita && isoDoDia(new Date(r.proximaVisita)) === hoje;
    return (
      <Animated.View key={r.id} entering={FadeInDown.duration(220).delay(Math.min(i, 8) * 30)}>
        <Pressable style={({ pressed }) => [styles.cartao, pressed && { opacity: 0.85 }]} onPress={() => abrir(r)} accessibilityRole="button">
          <View style={[styles.icone, { backgroundColor: r.estudo ? colors.successBg : colors.infoBg }]}>
            <Ionicons name={r.estudo ? "book" : "person"} size={16} color={r.estudo ? colors.greenDark : colors.primaryDark} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.nome}>{r.nome}</Text>
            {r.endereco ? (
              <Text style={styles.detalhe} numberOfLines={1}>
                {r.endereco}
              </Text>
            ) : null}
            <Text style={[styles.detalhe, visitaHoje && { color: colors.amber, fontWeight: "800" }]}>
              {r.proximaVisita
                ? `Próxima: ${quando(r.proximaVisita)}`
                : r.ultimaVisita
                  ? `Última visita: ${diaCurto(r.ultimaVisita)}`
                  : "Ainda sem visita registrada"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={styles.tela}>
      <GradientHeader title="Revisitas" description="E os estudos bíblicos" showBack />
      <View style={styles.filtros}>
        {(
          [
            { id: "todas", rotulo: "Todas" },
            { id: "estudos", rotulo: "Estudos" },
            { id: "arquivadas", rotulo: "Arquivadas" },
          ] as const
        ).map((f) => (
          <Pressable
            key={f.id}
            style={[styles.filtro, filtro === f.id && styles.filtroAtivo]}
            onPress={() => setFiltro(f.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: filtro === f.id }}
          >
            <Text style={[styles.filtroTexto, filtro === f.id && styles.filtroTextoAtivo]}>{f.rotulo}</Text>
          </Pressable>
        ))}
        {mapaDisponivel ? (
          <Pressable
            style={styles.modo}
            onPress={() => setModo(modo === "lista" ? "mapa" : "lista")}
            accessibilityRole="button"
            accessibilityLabel={modo === "lista" ? "Ver no mapa" : "Ver em lista"}
          >
            <Ionicons name={modo === "lista" ? "map-outline" : "list-outline"} size={20} color={colors.primaryDark} />
          </Pressable>
        ) : null}
      </View>

      {isLoading && !data ? (
        <Loading label="Carregando..." />
      ) : modo === "mapa" && mapaDisponivel ? (
        comPosicao.length === 0 ? (
          <EmptyState icon="map-outline" title="Nenhuma revisita com posição" message='Ao anotar, toque em "Usar minha localização" para ela aparecer aqui.' />
        ) : (
          <MapView style={styles.flex} provider={provedor} initialRegion={regiao} showsUserLocation>
            {comPosicao.map((r) => (
              <Marker
                key={r.id}
                coordinate={{ latitude: r.lat as number, longitude: r.lng as number }}
                title={r.nome}
                description={r.proximaVisita ? `Próxima: ${quando(r.proximaVisita)}` : r.endereco ?? undefined}
                pinColor={r.estudo ? colors.greenDark : colors.terracotta}
                onCalloutPress={() => abrir(r)}
              />
            ))}
          </MapView>
        )
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} refreshControl={<RefreshControl {...puxar} tintColor={colors.primary} />}>
          {lista.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title={filtro === "estudos" ? "Nenhum estudo marcado" : filtro === "arquivadas" ? "Nada arquivado" : "Nenhuma revisita ainda"}
              message={filtro === "todas" ? "Anote quem você vai visitar de novo: o endereço, a posição no mapa e a próxima visita, com aviso." : undefined}
            />
          ) : (
            lista.map(cartao)
          )}
        </ScrollView>
      )}

      {filtro !== "arquivadas" ? (
        <View style={[styles.rodape, { paddingBottom: insets.bottom + 12 }]}>
          <Button label="Nova revisita" icon="add" onPress={() => setNova(true)} fullWidth />
        </View>
      ) : null}
      <RevisitaSheet visible={nova} onClose={() => setNova(false)} />
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, gap: 10 },
    flex: { flex: 1 },
    filtros: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, alignItems: "center" },
    filtro: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filtroAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    filtroTexto: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    filtroTextoAtivo: { color: colors.textOnPrimary },
    modo: {
      marginLeft: "auto",
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cartao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    icone: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    nome: { fontSize: 16, fontWeight: "800", color: colors.text },
    detalhe: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
    rodape: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.background },
  });
