import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useImagemTerritorio, useTerritorios } from "@/api/hooks/useTerritorios";
import { Button, EmptyState, GradientHeader, Loading, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/** Proporção do cartão S-12-T (414x268 pt) — mantém a imagem sem cortes. */
const PROPORCAO_CARTAO = 414 / 268;

type Visao = "mapa" | "satelite";

export default function TerritorioDetalheScreen() {
  const { colors, styles } = useTema(criarEstilos);
  const { numero } = useLocalSearchParams<{ numero: string }>();
  const { data, isLoading, isError, refetch } = useTerritorios();
  const imagem = useImagemTerritorio();
  const toast = useToast();

  const [visao, setVisao] = useState<Visao>("mapa");
  const [carregandoImagem, setCarregandoImagem] = useState(true);
  const [erroImagem, setErroImagem] = useState(false);
  // Entra na key da imagem: incrementar força o RN a tentar o download de novo.
  const [tentativa, setTentativa] = useState(0);
  const [compartilhando, setCompartilhando] = useState(false);

  const territorio = data?.territorios.find(
    (t) => t.numero === Number(numero),
  );

  if (isLoading) {
    return <Loading label="Carregando território..." />;
  }

  // Falha de rede ANTES do "não encontrado": sem cache (deep link offline) a
  // query erra e dizer "território não encontrado" seria falso e sem saída.
  if (isError) {
    return (
      <View style={styles.flex}>
        <GradientHeader title="Território" showBack />
        <EmptyState
          icon="cloud-offline"
          title="Não foi possível carregar os territórios"
          message="Verifique a conexão e tente novamente."
        >
          <Button label="Tentar de novo" onPress={() => refetch()} />
        </EmptyState>
      </View>
    );
  }

  if (!territorio) {
    return (
      <View style={styles.flex}>
        <GradientHeader title="Território" showBack />
        <EmptyState
          icon="map-outline"
          title="Território não encontrado"
          message="Volte à lista e escolha um território."
        />
      </View>
    );
  }

  const nn = String(territorio.numero).padStart(2, "0");
  // Sem satélite a visão fica travada no mapa, aconteça o que acontecer com o estado.
  const visaoAtiva: Visao = territorio.imagens.satelite ? visao : "mapa";
  const caminho =
    visaoAtiva === "satelite" && territorio.imagens.satelite
      ? territorio.imagens.satelite
      : territorio.imagens.mapa;
  const fonte = imagem(caminho);

  const compartilhar = async () => {
    if (!fonte) return;
    setCompartilhando(true);
    try {
      const nome = `territorio-${nn}-${visaoAtiva}.jpg`;
      const destino = `${FileSystem.cacheDirectory}${nome}`;
      // O cartão fica atrás do login: o download precisa levar o mesmo Bearer
      // que o <Image> usa.
      const res = await FileSystem.downloadAsync(fonte.uri, destino, {
        headers: fonte.headers,
      });
      if (res.status !== 200) {
        throw new Error("Não consegui baixar o cartão. Confira a conexão.");
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, {
          mimeType: "image/jpeg",
          dialogTitle: nome,
        });
      }
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Erro ao compartilhar o cartão",
        "error",
      );
    } finally {
      setCompartilhando(false);
    }
  };

  const abaVisao = (valor: Visao, rotulo: string, icone: string) => {
    const ativa = visaoAtiva === valor;
    return (
      <Pressable
        style={[styles.aba, ativa && styles.abaAtiva]}
        onPress={() => {
          if (valor !== visaoAtiva) {
            setCarregandoImagem(true);
            setErroImagem(false);
            setVisao(valor);
          }
        }}
      >
        <Ionicons
          name={icone as keyof typeof Ionicons.glyphMap}
          size={14}
          color={ativa ? colors.textOnPrimary : colors.textSecondary}
        />
        <Text style={[styles.abaTexto, ativa && styles.abaTextoAtiva]}>
          {rotulo}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.flex}>
      <GradientHeader
        title={`Território ${nn}`}
        description={territorio.localidade}
        showBack
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {territorio.imagens.satelite ? (
          <View style={styles.abas}>
            {abaVisao("mapa", "Mapa", "map-outline")}
            {abaVisao("satelite", "Satélite", "globe-outline")}
          </View>
        ) : null}

        <View style={styles.cartao}>
          {fonte && !erroImagem ? (
            <Image
              // key força remontagem ao trocar de visão (ou ao tentar de novo):
              // sem ela o Android segura a imagem anterior e não refaz o load.
              key={`${caminho}-${tentativa}`}
              source={fonte}
              style={styles.cartaoImagem}
              resizeMode="contain"
              onLoadEnd={() => setCarregandoImagem(false)}
              onError={() => {
                // No Android a falha NÃO dispara onLoadEnd: sem isto o spinner
                // ficaria girando para sempre; no iOS sobraria um cartão em
                // branco. Token expirado e queda de rede caem aqui.
                setCarregandoImagem(false);
                setErroImagem(true);
              }}
            />
          ) : (
            <View style={styles.cartaoImagem} />
          )}
          {erroImagem ? (
            <View style={styles.cartaoLoading}>
              <Ionicons name="cloud-offline-outline" size={22} color={colors.textMuted} />
              <Text style={styles.cartaoErroTexto}>
                Não foi possível carregar o cartão
              </Text>
              <Button
                label="Tentar de novo"
                variant="secondary"
                onPress={() => {
                  setErroImagem(false);
                  setCarregandoImagem(true);
                  setTentativa((t) => t + 1);
                }}
              />
            </View>
          ) : carregandoImagem || !fonte ? (
            <View style={styles.cartaoLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </View>

        <Button
          label={compartilhando ? "Preparando..." : "Compartilhar cartão"}
          icon="share-social-outline"
          onPress={compartilhar}
          loading={compartilhando}
          fullWidth
        />

        <View style={styles.dica}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={styles.dicaTexto}>
            O cartão é compartilhado como imagem, na visão selecionada — dá para
            mandar direto no WhatsApp do grupo de serviço.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 40, gap: 14 },
    abas: {
      flexDirection: "row",
      gap: 8,
      alignSelf: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      padding: 4,
    },
    aba: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 16,
      borderRadius: radius.pill,
    },
    abaAtiva: { backgroundColor: colors.primary },
    abaTexto: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    abaTextoAtiva: { color: colors.textOnPrimary },
    cartao: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    cartaoImagem: { width: "100%", aspectRatio: PROPORCAO_CARTAO },
    cartaoLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.surface,
    },
    cartaoErroTexto: { fontSize: 13, color: colors.textSecondary },
    dica: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 4,
    },
    dicaTexto: { flex: 1, fontSize: 12.5, color: colors.textMuted, lineHeight: 17 },
  });
