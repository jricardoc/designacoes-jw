import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { router, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { ehAdminGeral } from "@/utils/permissoes";
import { radius, shadow, spacing, motion, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { MarcaServirMais } from "./MarcaServirMais";

const CURVA = Easing.bezier(...motion.curvaSuave);

interface ItemMenu {
  /** Nome do arquivo da rota — é por ele que o item acende. */
  chave: string;
  rotulo: string;
  icone: keyof typeof Ionicons.glyphMap;
  href: Href;
  /** Some do menu para quem não é administrador. */
  somenteAdmin?: boolean;
}

const ITENS: ItemMenu[] = [
  { chave: "minhas", rotulo: "Início", icone: "home-outline", href: "/(tabs)/minhas" },
  { chave: "index", rotulo: "Designações", icone: "document-text-outline", href: "/(tabs)" },
  { chave: "dirigentes", rotulo: "Dirigentes", icone: "compass-outline", href: "/(tabs)/dirigentes" },
  { chave: "reuniao", rotulo: "Reunião", icone: "people-outline", href: "/(tabs)/reuniao" },
  { chave: "carrinho", rotulo: "Carrinho", icone: "book-outline", href: "/(tabs)/carrinho" },
  { chave: "conta", rotulo: "Conta", icone: "person-outline", href: "/(tabs)/conta" },
  // Cadastro da congregação (irmãos, saídas de campo): só administradores.
  { chave: "config", rotulo: "Configurações", icone: "options-outline", href: "/(tabs)/config", somenteAdmin: true },
  { chave: "ajustes", rotulo: "Ajustes", icone: "settings-outline", href: "/(tabs)/ajustes" },
];

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Menu lateral próprio: overlay que desliza da esquerda com backdrop em fade.
 * Não usa @react-navigation/drawer de propósito — o app é um Stack e trocar de
 * navegador mudaria o formato das rotas.
 */
export function DrawerMenu({ visible, onClose }: DrawerMenuProps) {
  const { colors, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { usuario } = useAuth();
  const segments = useSegments();

  const largura = Math.min(316, width * 0.84);
  // O Modal some junto com `visible`, então a animação de saída só existe se o
  // desmonte esperar ela terminar.
  const [montado, setMontado] = useState(visible);
  const progresso = useSharedValue(0);

  useEffect(() => {
    if (visible) setMontado(true);
  }, [visible]);

  useEffect(() => {
    if (!montado) return;
    if (visible) {
      progresso.value = withTiming(1, { duration: motion.entrada, easing: CURVA });
    } else {
      progresso.value = withTiming(0, { duration: motion.saida, easing: CURVA }, (fim) => {
        if (fim) runOnJS(setMontado)(false);
      });
    }
  }, [visible, montado, progresso]);

  const painelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -largura * (1 - progresso.value) }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progresso.value }));

  const grupo = segments[0] as string | undefined;
  const atual = grupo === "(tabs)" ? ((segments[1] as string | undefined) ?? "index") : (grupo ?? "");

  const ir = (item: ItemMenu) => {
    onClose();
    if (item.chave === atual) return; // já está nela: navegar só remontaria a tela
    // Todos os itens são irmãos dentro de (tabs), como eram as abas: trocar de
    // item TROCA a tela. `navigate` empilharia mais uma cópia a cada toque (o
    // StackRouter só reaproveita a rota do topo), e o voltar do Android refaria
    // todo o passeio pelo menu em vez de sair do app.
    router.replace(item.href);
  };

  if (!montado) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar menu" />
        </Animated.View>

        <Animated.View
          style={[
            styles.painel,
            shadow.raised,
            painelStyle,
            { width: largura, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 14 },
          ]}
        >
          <View style={styles.topo}>
            <MarcaServirMais tamanho={38} />
            <View style={styles.topoTexto}>
              <Text style={styles.topoNome}>Servir Mais</Text>
              <Text style={styles.topoTag}>Designações da congregação</Text>
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={styles.fechar}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.lista} showsVerticalScrollIndicator={false}>
            {ITENS.filter((item) => !item.somenteAdmin || ehAdminGeral(usuario)).map((item) => {
              const ativo = item.chave === atual;
              return (
                <Pressable
                  key={item.chave}
                  onPress={() => ir(item)}
                  style={[styles.item, ativo && styles.itemAtivo]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                >
                  <Ionicons
                    name={item.icone}
                    size={20}
                    color={ativo ? colors.primaryDark : colors.textSecondary}
                  />
                  <Text style={[styles.itemTexto, ativo && styles.itemTextoAtivo]}>
                    {item.rotulo}
                  </Text>
                  {ativo ? <View style={styles.marcador} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {usuario ? (
            <View style={styles.rodape}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTexto}>
                  {usuario.nome.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rodapeTexto}>
                <Text style={styles.rodapeNome} numberOfLines={1}>
                  {usuario.nome}
                </Text>
                <Text style={styles.rodapeNick} numberOfLines={1}>
                  @{usuario.nickname}
                </Text>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    root: { flex: 1, flexDirection: "row" },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    painel: {
      backgroundColor: colors.surface,
      borderTopRightRadius: 26,
      borderBottomRightRadius: 26,
      paddingHorizontal: spacing.lg,
    },
    topo: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingBottom: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    topoTexto: { flex: 1 },
    topoNome: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: -0.3,
    },
    topoTag: { color: colors.textSecondary, fontSize: 11.5, marginTop: 2 },
    fechar: {
      width: 30,
      height: 30,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    lista: { paddingTop: spacing.lg, gap: 4, paddingBottom: spacing.lg },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
    itemAtivo: { backgroundColor: colors.infoBg },
    itemTexto: { flex: 1, color: colors.textSecondary, fontSize: 15.5, fontWeight: "500" },
    itemTextoAtivo: { color: colors.primaryDark, fontWeight: "700" },
    marcador: {
      width: 6,
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
    },
    rodape: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: colors.sand,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarTexto: { color: colors.primaryDark, fontSize: 16, fontWeight: "700" },
    rodapeTexto: { flex: 1 },
    rodapeNome: { color: colors.text, fontSize: 14.5, fontWeight: "600" },
    rodapeNick: { color: colors.textMuted, fontSize: 12.5, marginTop: 1 },
  });
