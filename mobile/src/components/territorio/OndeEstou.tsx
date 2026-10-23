import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { MapaGeralTerritorios } from "@/api/types";
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
 * "Você está no território 12": o aviso no topo da tela de Territórios, no mesmo jeito da
 * "Reunião desta semana". Tocar abre o território.
 */
export function OndeEstou({
  territorios,
  descricoes,
  onAbrir,
}: {
  territorios: MapaGeralTerritorios["territorios"] | undefined;
  /** Descrição de cada território, por número (vem da lista). */
  descricoes?: Record<string, string | null | undefined>;
  onAbrir: (numero: string) => void;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const aqui = useOndeEstou(territorios);
  if (!aqui) return null;
  const descricao = descricoes?.[aqui.numero];

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.grupo}>
      <View style={styles.selo}>
        <Ionicons name="navigate" size={12} color={colors.textOnPrimary} />
        <Text style={styles.seloTexto}>Você está aqui</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.cartao, pressed && { opacity: 0.85 }]}
        onPress={() => onAbrir(aqui.numero)}
        accessibilityRole="button"
        accessibilityLabel={`Você está no território ${aqui.numero}, ${aqui.nome}. Abrir`}
      >
        <View style={styles.numeroCaixa}>
          <Text style={styles.numero}>{aqui.numero}</Text>
        </View>
        <View style={styles.textos}>
          <Text style={styles.titulo} numberOfLines={1}>
            Território {aqui.numero} · {aqui.nome}
          </Text>
          {descricao ? (
            <Text style={styles.descricao} numberOfLines={2}>
              {descricao}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
      </Pressable>
    </Animated.View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    grupo: { gap: 8, paddingHorizontal: 16, paddingTop: 12 },
    selo: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingVertical: 5,
      paddingHorizontal: 11,
    },
    seloTexto: {
      color: colors.textOnPrimary,
      fontSize: 11.5,
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
    numeroCaixa: {
      minWidth: 44,
      height: 44,
      borderRadius: 22,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    numero: { color: colors.textOnPrimary, fontSize: 17, fontWeight: "900" },
    textos: { flex: 1, gap: 2 },
    titulo: { fontSize: 16, fontWeight: "800", color: colors.text },
    descricao: { fontSize: 13.5, lineHeight: 18, color: colors.textSecondary },
  });
