import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useImagemProtegida } from "@/api/hooks/useImagemProtegida";
import type { MapaGeralTerritorios, TerritorioResumo } from "@/api/types";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { territorioDoPonto, type PontoGeo } from "@/territorios/onde";

/** Entre uma leitura do GPS e outra: abrir e fechar a aba não fica pedindo posição. */
const INTERVALO_MS = 60_000;

/**
 * Em que território o irmão está, pelo GPS, ao abrir a tela (e ao voltar para o app).
 *
 * Pede a permissão só se ela nunca foi respondida; negada, a tela segue sem o aviso. Vale a
 * última posição conhecida se for recente: é rápida e não liga o GPS à toa.
 */
function useOndeEstou(territorios: MapaGeralTerritorios["territorios"] | undefined) {
  const [ponto, setPonto] = useState<PontoGeo | null>(null);
  const ultimaLeitura = useRef(0);

  const ler = useCallback(async () => {
    if (Date.now() - ultimaLeitura.current < INTERVALO_MS) return;
    ultimaLeitura.current = Date.now();
    try {
      let permissao = await Location.getForegroundPermissionsAsync();
      if (!permissao.granted && permissao.canAskAgain) permissao = await Location.requestForegroundPermissionsAsync();
      if (!permissao.granted) return;
      const posicao =
        (await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 100 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setPonto([posicao.coords.latitude, posicao.coords.longitude]);
    } catch {
      // GPS desligado ou sem sinal: fica sem o aviso desta vez.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      ler();
    }, [ler]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") ler();
    });
    return () => sub.remove();
  }, [ler]);

  return useMemo(() => (ponto && territorios ? territorioDoPonto(ponto, territorios) : null), [ponto, territorios]);
}

/**
 * "Você está aqui": o cartão do território onde o irmão está, no topo da tela de Territórios.
 * Mesmo jeito do cartão da lista (miniatura do mapa, título, descrição), com o selo dentro.
 * Tocar abre o território.
 */
export function OndeEstou({
  territorios,
  resumos,
  onAbrir,
}: {
  territorios: MapaGeralTerritorios["territorios"] | undefined;
  /** A lista de territórios: de lá vêm a miniatura e a descrição. */
  resumos?: TerritorioResumo[];
  onAbrir: (numero: string) => void;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const imagem = useImagemProtegida();
  const [semImagem, setSemImagem] = useState(false);
  const aqui = useOndeEstou(territorios);
  if (!aqui) return null;
  const resumo = resumos?.find((t) => t.numero === aqui.numero);
  const fonte = resumo?.imagens?.thumb ? imagem(resumo.imagens.thumb) : null;

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.grupo}>
      <Pressable
        style={({ pressed }) => [styles.cartao, pressed && { opacity: 0.85 }]}
        onPress={() => onAbrir(aqui.numero)}
        accessibilityRole="button"
        accessibilityLabel={`Você está no território ${aqui.numero}, ${aqui.nome}. Abrir`}
      >
        {fonte && !semImagem ? (
          <Image source={fonte} style={styles.miniatura} resizeMode="cover" onError={() => setSemImagem(true)} />
        ) : (
          <View style={[styles.miniatura, styles.miniaturaVazia]}>
            <Ionicons name="map-outline" size={24} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.textos}>
          <View style={styles.selo}>
            <Ionicons name="navigate" size={10} color={colors.textOnPrimary} />
            <Text style={styles.seloTexto}>Você está aqui</Text>
          </View>
          <Text style={styles.titulo} numberOfLines={1}>
            {aqui.nome || `Território ${aqui.numero}`}
          </Text>
          <Text style={styles.descricao} numberOfLines={2}>
            Território {aqui.numero}
            {resumo?.observacoes ? ` · ${resumo.observacoes}` : ""}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
      </Pressable>
    </Animated.View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    grupo: { paddingHorizontal: 16, paddingTop: 12 },
    selo: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingVertical: 3,
      paddingHorizontal: 8,
      marginBottom: 2,
    },
    seloTexto: {
      color: colors.textOnPrimary,
      fontSize: 10.5,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    cartao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      ...shadow.card,
    },
    miniatura: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
    miniaturaVazia: { alignItems: "center", justifyContent: "center" },
    textos: { flex: 1, gap: 2 },
    titulo: { fontSize: 16, fontWeight: "800", color: colors.text },
    descricao: { fontSize: 13.5, lineHeight: 18, color: colors.textSecondary },
  });
