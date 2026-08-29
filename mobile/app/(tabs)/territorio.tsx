import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useImagemTerritorio, useTerritorios } from "@/api/hooks/useTerritorios";
import type { Territorio } from "@/api/types";
import { Button, EmptyState, GradientHeader, Loading, TextField } from "@/components/ui";
import { SaidasDeCampo } from "@/components/config/SaidasDeCampo";
import { useAuth } from "@/context/AuthContext";
import { podeGerenciar } from "@/utils/permissoes";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { useBarraFlutuante } from "@/components/layout/contextoRolagem";

/** Acentos fora da busca: "itapua" tem que achar "Itapuã". */
const normalizar = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Miniatura do cart\u00e3o com fallback: sem fonte (token ainda carregando) ou com
 * erro de download (rede, 401), mostra o \u00edcone de mapa em vez de um ret\u00e2ngulo
 * cinza mudo. O estado \u00e9 local porque cada linha falha por conta pr\u00f3pria.
 */
function Thumb({
  fonte,
}: {
  fonte: { uri: string; headers: Record<string, string> } | null;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const [erro, setErro] = useState(false);
  if (!fonte || erro) {
    return (
      <View style={[styles.thumb, styles.thumbVazio]}>
        <Ionicons
          name={erro ? "cloud-offline-outline" : "map-outline"}
          size={20}
          color={colors.textMuted}
        />
      </View>
    );
  }
  return (
    <Image
      source={fonte}
      style={styles.thumb}
      resizeMode="cover"
      onError={() => setErro(true)}
    />
  );
}

export default function TerritorioScreen() {
  // Chamado UMA vez, no topo: o ScrollView abaixo mora dentro de um condicional
  // (carregando / vazio / lista), e espalhar o hook lá dentro o tornaria uma
  // chamada condicional — proibido, e quebra na primeira troca de estado.
  const { rolagem, recuo } = useBarraFlutuante();
  const { usuario } = useAuth();
  // Saída de campo é da área de dirigentes — é o escopo que o backend exige em
  // /saidas-campo. Sem ele a aba nem aparece.
  const podeSaidas = podeGerenciar(usuario, "dirigentes");
  const [aba, setAba] = useState<"mapas" | "saidas">("mapas");

  const { colors, styles } = useTema(criarEstilos);
  const { data, isLoading, isError, refetch, isRefetching } = useTerritorios();
  const imagem = useImagemTerritorio();
  const [busca, setBusca] = useState("");

  const territorios = useMemo(() => {
    const todos = data?.territorios ?? [];
    const termo = normalizar(busca.trim());
    if (!termo) return todos;
    return todos.filter(
      (t) =>
        String(t.numero).includes(termo) ||
        String(t.numero).padStart(2, "0").includes(termo) ||
        normalizar(t.localidade).includes(termo),
    );
  }, [data, busca]);

  const renderItem = ({ item }: { item: Territorio }) => {
    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: "/territorio/[numero]",
            params: { numero: item.numero },
          })
        }
      >
        <Thumb fonte={imagem(item.imagens.thumb)} />
        <View style={styles.textos}>
          <Text style={styles.numero}>
            Território {String(item.numero).padStart(2, "0")}
          </Text>
          <Text style={styles.localidade} numberOfLines={1}>
            {item.localidade}
          </Text>
          {item.imagens.satelite ? (
            <View style={styles.badgeSatelite}>
              <Ionicons name="globe-outline" size={11} color={colors.primaryDark} />
              <Text style={styles.badgeSateliteTexto}>Mapa + satélite</Text>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  };

  return (
    <View style={styles.flex}>
      <GradientHeader
        title="Território"
        description="Cartões de mapa de território da congregação"
        icon="map"
      />

      {/* Mesmo seletor que a tela de cadastro tinha: são dois assuntos que dividem a tela,
          e a aba deixa claro que um não é continuação do outro. Some para quem não cuida de
          dirigentes — sem a segunda aba, não há o que escolher. */}
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
                  {s === "mapas" ? "Mapas" : "Saídas de campo"}
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
        <EmptyState
          icon="cloud-offline"
          title="Não foi possível carregar os territórios"
          message="Verifique a conexão e tente novamente."
        >
          <Button label="Tentar de novo" onPress={() => refetch()} />
        </EmptyState>
      ) : (
        <FlatList
          {...rolagem}
          data={territorios}
          keyExtractor={(t) => String(t.numero)}
          renderItem={renderItem}
          contentContainerStyle={[styles.lista, recuo]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          ListHeaderComponent={
            <View style={styles.topo}>
              <TextField
                icon="search"
                placeholder="Buscar por número ou localidade..."
                value={busca}
                onChangeText={setBusca}
                autoCorrect={false}
              />
              <Text style={styles.contagem}>
                {territorios.length === 1
                  ? "1 território"
                  : `${territorios.length} territórios`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="map-outline"
              title="Nenhum território encontrado"
              message="Tente outro número ou outra localidade."
            />
          }
        />
      )}
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
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
    topo: { gap: 6, marginBottom: 6 },
    contagem: { fontSize: 12.5, color: colors.textSecondary },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 10,
      paddingRight: 14,
    },
    // Mesma proporção do cartão (414x268): a miniatura é o próprio cartão.
    thumb: {
      width: 92,
      height: 60,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
    },
    thumbVazio: { alignItems: "center", justifyContent: "center" },
    textos: { flex: 1, gap: 2 },
    numero: { fontSize: 15.5, fontWeight: "700", color: colors.text },
    localidade: { fontSize: 13, color: colors.textSecondary },
    badgeSatelite: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      backgroundColor: colors.infoBg,
      borderRadius: radius.pill,
      paddingVertical: 2,
      paddingHorizontal: 8,
      marginTop: 2,
    },
    badgeSateliteTexto: {
      fontSize: 10.5,
      fontWeight: "700",
      color: colors.primaryDark,
    },
  });
