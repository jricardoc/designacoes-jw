import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { colors, shadow } from "@/theme";

interface MarcaServirMaisProps {
  /** Lado da caixa da marca, em px. Padrão 28. */
  tamanho?: number;
  /** Marca em cima do fundo oliva (drawer/splash): dispensa a caixa e o gradiente. */
  solta?: boolean;
}

/**
 * A marca "S+" do app, no mesmo desenho da splash: o "S" pesado com o "+" menor
 * apoiado no ombro direito. As medidas saem todas de `tamanho` para a marca
 * continuar proporcional em qualquer lugar (barra do topo, drawer, vazios).
 */
export function MarcaServirMais({ tamanho = 28, solta }: MarcaServirMaisProps) {
  const corpoS = tamanho * (solta ? 1 : 0.66);
  const corpoMais = corpoS * 0.46;

  const conteudo = (
    <View style={styles.linha}>
      <Text
        style={[
          styles.s,
          { fontSize: corpoS, lineHeight: corpoS * 1.08, letterSpacing: -corpoS * 0.04 },
        ]}
      >
        S
      </Text>
      <Text
        style={[
          styles.mais,
          { fontSize: corpoMais, lineHeight: corpoMais * 1.1, marginTop: corpoS * 0.12 },
        ]}
      >
        +
      </Text>
    </View>
  );

  if (solta) return conteudo;

  return (
    <LinearGradient
      colors={colors.primaryGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.caixa,
        shadow.card,
        { width: tamanho, height: tamanho, borderRadius: tamanho * 0.31 },
      ]}
    >
      {conteudo}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  caixa: { alignItems: "center", justifyContent: "center" },
  linha: { flexDirection: "row", alignItems: "flex-start" },
  s: { color: colors.textOnPrimary, fontWeight: "800" },
  mais: { color: colors.textOnPrimary, fontWeight: "800", marginLeft: 1 },
});
