import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SinoNotificacoes } from "@/components/layout/SinoNotificacoes";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { alvoTour } from "@/tour/estado";
import { TrocarAmbienteSheet } from "./Ambientes";
import { DrawerMenu } from "./DrawerMenu";
import { MarcaServirMais } from "./MarcaServirMais";

/**
 * Barra global do app: [sanduíche] [marca "Servir Mais"] ... [sino].
 * Fica acima do Stack das telas, por isso é enxuta — o título da página
 * continua sendo o GradientHeader de cada tela. A marca troca de ambiente, como no
 * topo do Ministério, do Território e do Estudo.
 */
export function AppHeader() {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const [menuAberto, setMenuAberto] = useState(false);
  const [trocar, setTrocar] = useState(false);

  return (
    <>
      <View style={[styles.barra, { paddingTop: insets.top + 6 }]}>
        <Pressable
          ref={alvoTour("servir.menu")}
          collapsable={false}
          hitSlop={10}
          onPress={() => setMenuAberto(true)}
          style={styles.sanduiche}
          accessibilityRole="button"
          accessibilityLabel="Abrir menu"
        >
          <Ionicons name="menu" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.marca}>
          <Pressable
            ref={alvoTour("servir.marca")}
            collapsable={false}
            onPress={() => setTrocar(true)}
            style={({ pressed }) => [styles.marcaBotao, pressed && styles.pressionado]}
            accessibilityRole="button"
            accessibilityLabel="Servir Mais. Trocar de ambiente"
          >
            <MarcaServirMais tamanho={30} />
            <Text style={styles.nome}>Servir Mais</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View ref={alvoTour("servir.sino")} collapsable={false}>
          <SinoNotificacoes onPress={() => router.push("/notificacoes")} />
        </View>
      </View>

      <DrawerMenu visible={menuAberto} onClose={() => setMenuAberto(false)} />
      <TrocarAmbienteSheet visible={trocar} onClose={() => setTrocar(false)} atual="servir" />
    </>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
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
  marca: { flex: 1, flexDirection: "row", alignItems: "center" },
  marcaBotao: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4, paddingRight: 6 },
  pressionado: { opacity: 0.75 },
  nome: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  });
