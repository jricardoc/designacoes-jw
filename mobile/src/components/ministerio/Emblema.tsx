import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { EmblemaPioneiro, NivelEmblema } from "@/api/types";
import { Button, Sheet, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { exportarImagem } from "@/utils/exportImagem";
import type { Icone } from "./kit";
import { METAL } from "./tema";

export const NOME_NIVEL: Record<NivelEmblema, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro" };

/** O ícone gravado no metal: escuro, para ler bem até na prata. */
const GRAVACAO: Record<NivelEmblema, string> = { ouro: "#6B4100", prata: "#3B4652", bronze: "#5A2A0B" };

/** A medalha: o degradê do metal, o ícone gravado e um brilho que a atravessa de tempos em tempos. */
export function Medalha({ emblema, tamanho = 72 }: { emblema: Pick<EmblemaPioneiro, "icone" | "nivel">; tamanho?: number }) {
  const { colors } = useTema();
  const parado = useReducedMotion();
  const x = useSharedValue(-1);
  const nivel = emblema.nivel;
  useEffect(() => {
    if (!nivel || parado) return;
    x.value = withRepeat(withDelay(2600, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })), -1, false);
    return () => cancelAnimation(x);
  }, [nivel, parado, x]);
  const estiloBrilho = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * tamanho * 1.1 }, { rotate: "20deg" }] }));
  const cores = nivel ? METAL[nivel] : ([colors.surfaceMuted, colors.border, colors.borderStrong] as const);

  return (
    <LinearGradient
      colors={cores}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[
        styles.medalha,
        { width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderColor: nivel ? "rgba(255,255,255,0.7)" : colors.border },
      ]}
    >
      <Ionicons name={emblema.icone as Icone} size={tamanho * 0.44} color={nivel ? GRAVACAO[nivel] : colors.textMuted} />
      {nivel ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.brilho, { top: -tamanho * 0.25, bottom: -tamanho * 0.25, width: tamanho * 0.26 }, estiloBrilho]}
        />
      ) : null}
    </LinearGradient>
  );
}

/** O emblema na grade do Progresso: medalha, nome, nível e o quanto falta para o próximo. */
export function EmblemaCartao({ emblema, onPress }: { emblema: EmblemaPioneiro; onPress: () => void }) {
  const { colors, styles: s } = useTema(criarEstilos);
  const p = emblema.proximo;
  const fracao = p ? Math.min(1, emblema.valor / (emblema.valor + p.falta)) : 1;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.cartao, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${emblema.nome}: ${emblema.nivel ? NOME_NIVEL[emblema.nivel] : "ainda não conquistado"}`}
    >
      <Medalha emblema={emblema} tamanho={64} />
      <Text style={s.nome} numberOfLines={1}>
        {emblema.nome}
      </Text>
      <Text style={[s.nivel, { color: emblema.nivel ? colors.primaryDark : colors.textMuted }]}>
        {emblema.nivel ? NOME_NIVEL[emblema.nivel] : "A conquistar"}
      </Text>
      <View style={s.trilho}>
        <View style={[s.cheio, { width: `${Math.round(fracao * 100)}%` }]} />
      </View>
      <Text style={s.falta} numberOfLines={1}>
        {p ? `Faltam ${p.falta} para ${NOME_NIVEL[p.nivel].toLowerCase()}` : "Nível máximo"}
      </Text>
    </Pressable>
  );
}

/** O detalhe de um emblema, com o cartão que se compartilha como imagem. */
export function EmblemaSheet({ emblema, onClose }: { emblema: EmblemaPioneiro | null; onClose: () => void }) {
  const { styles: s } = useTema(criarEstilos);
  const toast = useToast();
  const cartao = useRef<View>(null);
  const [enviando, setEnviando] = useState(false);
  const e = emblema;

  const compartilhar = async () => {
    setEnviando(true);
    try {
      await exportarImagem(cartao, `emblema-${e?.id ?? "ministerio"}.png`);
    } catch {
      toast.show("Não deu para gerar a imagem", "error");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Sheet visible={!!e} onClose={onClose}>
      {e ? (
        <View style={s.folha}>
          {/* O cartão compartilhado tem cores fixas: sai igual para quem recebe, seja qual for o tema. */}
          <View ref={cartao} collapsable={false} style={s.compartilhavel}>
            <LinearGradient colors={["#0B3D30", "#05261D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cartaoFundo}>
              <Medalha emblema={e} tamanho={110} />
              <Text style={s.cartaoNivel}>{e.nivel ? NOME_NIVEL[e.nivel] : "A conquistar"}</Text>
              <Text style={s.cartaoNome}>{e.nome}</Text>
              <Text style={s.cartaoValor}>
                {e.valor} {e.unidade}
              </Text>
              <Text style={s.cartaoMarca}>Ministério · Servir Mais</Text>
            </LinearGradient>
          </View>
          <Text style={s.explica}>
            {e.proximo
              ? `Faltam ${e.proximo.falta} para o ${NOME_NIVEL[e.proximo.nivel].toLowerCase()}.`
              : "Você chegou ao nível mais alto deste emblema."}{" "}
            Os emblemas comemoram a constância, não a quantidade de horas.
          </Text>
          {e.nivel ? <Button label="Compartilhar" icon="share-social-outline" onPress={compartilhar} loading={enviando} fullWidth /> : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  medalha: { alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 3 },
  brilho: { position: "absolute", backgroundColor: "rgba(255,255,255,0.45)" },
});

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    cartao: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      padding: 14,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nome: { fontSize: 14, fontWeight: "800", color: colors.text, marginTop: 6 },
    nivel: { fontSize: 12.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
    trilho: { alignSelf: "stretch", height: 5, borderRadius: radius.pill, backgroundColor: colors.border, overflow: "hidden", marginTop: 6 },
    cheio: { height: 5, borderRadius: radius.pill, backgroundColor: colors.primary },
    falta: { fontSize: 11.5, color: colors.textSecondary },
    folha: { gap: 14, paddingBottom: 8 },
    compartilhavel: { borderRadius: 26, overflow: "hidden" },
    cartaoFundo: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20, gap: 4 },
    cartaoNivel: { color: "#FFD873", fontSize: 13, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase", marginTop: 14 },
    cartaoNome: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
    cartaoValor: { color: "#B8E8D6", fontSize: 15, textAlign: "center" },
    cartaoMarca: { color: "#6FBFA3", fontSize: 12, fontWeight: "700", marginTop: 16 },
    explica: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  });
