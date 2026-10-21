import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text } from "react-native";
import Animated, { SlideInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/** Ao voltar para o app, procura versão nova no máximo a cada tanto. */
const INTERVALO_MS = 30 * 60_000;

/**
 * Faixa "Versão nova pronta · Atualizar" para as atualizações pelo ar (`eas update`).
 *
 * Sem ela, a versão nova só entrava depois de fechar o app de vez e abrir DUAS vezes: a primeira
 * abertura baixa em segundo plano, a segunda usa. O iPhone quase nunca fecha o app de verdade, e
 * na prática a atualização "nunca chegava". Aqui o app procura ao abrir (o próprio expo-updates)
 * e ao voltar para ele; quando terminou de baixar, a faixa aparece e um toque aplica.
 *
 * Montar UMA vez, na área logada.
 */
export function AvisoAtualizacao() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();
  const [aplicando, setAplicando] = useState(false);
  const ultimaBusca = useRef(Date.now());

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    const sub = AppState.addEventListener("change", async (estado) => {
      if (estado !== "active" || Date.now() - ultimaBusca.current < INTERVALO_MS) return;
      ultimaBusca.current = Date.now();
      try {
        if ((await Updates.checkForUpdateAsync()).isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Sem internet agora: procura de novo numa próxima volta ao app.
      }
    });
    return () => sub.remove();
  }, []);

  if (!isUpdatePending) return null;

  return (
    <Animated.View entering={SlideInUp.springify().damping(16)} style={[styles.faixa, { top: insets.top + 8 }]}>
      <Ionicons name="sparkles" size={20} color={colors.textOnPrimary} />
      <Text style={styles.texto}>Versão nova do app pronta</Text>
      <Pressable
        style={styles.botao}
        disabled={aplicando}
        onPress={() => {
          setAplicando(true);
          Updates.reloadAsync().catch(() => setAplicando(false));
        }}
        accessibilityRole="button"
      >
        {aplicando ? (
          <ActivityIndicator size="small" color={colors.primaryDark} />
        ) : (
          <Text style={styles.botaoTexto}>Atualizar</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    faixa: {
      position: "absolute",
      left: 12,
      right: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingLeft: 14,
      paddingRight: 10,
      borderRadius: radius.lg,
      backgroundColor: colors.primaryDark,
      ...shadow.card,
    },
    texto: { flex: 1, fontSize: 14.5, fontWeight: "800", color: colors.textOnPrimary },
    botao: {
      minWidth: 96,
      height: 38,
      paddingHorizontal: 14,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    botaoTexto: { fontSize: 14, fontWeight: "800", color: colors.primaryDark },
  });
