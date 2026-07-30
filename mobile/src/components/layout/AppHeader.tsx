import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SinoNotificacoes } from "@/components/layout/SinoNotificacoes";
import { colors, radius, spacing } from "@/theme";
import { DrawerMenu } from "./DrawerMenu";
import { MarcaServirMais } from "./MarcaServirMais";

/**
 * Barra global do app: [sanduíche] [marca "Servir Mais"] ... [sino].
 * Fica acima do Stack das telas, por isso é enxuta — o título da página
 * continua sendo o GradientHeader de cada tela.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <>
      <View style={[styles.barra, { paddingTop: insets.top + 6 }]}>
        <Pressable
          hitSlop={10}
          onPress={() => setMenuAberto(true)}
          style={styles.sanduiche}
          accessibilityRole="button"
          accessibilityLabel="Abrir menu"
        >
          <Ionicons name="menu" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.marca}>
          <MarcaServirMais tamanho={30} />
          <Text style={styles.nome}>Servir Mais</Text>
        </View>

        <SinoNotificacoes onPress={() => router.push("/notificacoes")} />
      </View>

      <DrawerMenu visible={menuAberto} onClose={() => setMenuAberto(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: 18,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  sanduiche: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  marca: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nome: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
});
