import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useImagemTerritorio, useTerritorios } from "@/api/hooks/useTerritorios";
import type { Territorio } from "@/api/types";
import { Button, EmptyState, GradientHeader, Loading, TextField } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

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

      {isLoading ? (
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
          data={territorios}
          keyExtractor={(t) => String(t.numero)}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          keyboardShouldPersistTaps="handled"
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
    lista: { padding: 16, paddingBottom: 40, gap: 10 },
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
