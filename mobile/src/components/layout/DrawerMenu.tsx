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
import type { EscopoAdmin } from "@/api/types";
import { useAuth } from "@/context/AuthContext";
import { ehAdminGeral, podeGerenciar } from "@/utils/permissoes";
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
  /** Some do menu para quem não pode entrar na tela. */
  somenteAdmin?: boolean;
  /** Some para quem não tem este escopo (o admin geral passa em todos). */
  escopo?: EscopoAdmin;
}

/**
 * O que o menu lateral guarda.
 *
 * Início, Designações, Dirigentes, Reunião e Conta NÃO estão aqui: são os cinco da barra
 * flutuante (ver BarraFlutuante.tsx), sempre visível em qualquer tela de (tabs). Repeti-los
 * aqui só faria o irmão escolher entre dois caminhos para o mesmo lugar, e um menu que é
 * quase todo atalho duplicado deixa de valer a abertura.
 *
 * Sobra o que a barra não alcança — e a divisão não é arbitrária: a barra leva ao que se abre
 * todo dia, o menu ao que se abre de vez em quando.
 */
const ITENS: ItemMenu[] = [
  { chave: "territorio", rotulo: "Território", icone: "map-outline", href: "/(tabs)/territorio" },
  { chave: "carrinho", rotulo: "Carrinho", icone: "book-outline", href: "/(tabs)/carrinho" },
  // Falar com quem tem parte de estudante e anotar quem confirmou: área própria.
  {
    chave: "confirmacoes",
    rotulo: "Confirmações",
    icone: "checkmark-done-outline",
    href: "/(tabs)/confirmacoes",
    escopo: "confirmacoes",
  },
  // Cadastro das pessoas da congregação: só o admin geral. As saídas de campo, que também
  // moravam aqui, foram para o Território.
  { chave: "config", rotulo: "Publicadores", icone: "people-circle-outline", href: "/(tabs)/config", somenteAdmin: true },
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

  const irPara = (chave: string, href: Href) => {
    onClose();
    if (chave === atual) return; // já está nela: navegar só remontaria a tela
    // Todos os destinos são irmãos dentro de (tabs), como eram as abas: trocar de
    // item TROCA a tela. `navigate` empilharia mais uma cópia a cada toque (o
    // StackRouter só reaproveita a rota do topo), e o voltar do Android refaria
    // todo o passeio pelo menu em vez de sair do app.
    router.replace(href);
  };

  const ir = (item: ItemMenu) => irPara(item.chave, item.href);

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
            {ITENS.filter((item) => {
              // A ORDEM importa, e o item sem restrição nenhuma é visível para todo irmão
              // logado. Antes o último ramo era `ehAdminGeral(usuario)`, o que exigia admin
              // geral de TODO item sem escopo — Início, Designações, Território, Conta,
              // Ajustes... Para quem não é admin geral o menu abria vazio.
              //
              // Publicadores é só do admin geral (`somenteAdmin`). As saídas de campo, que
              // davam acesso a quem cuida de dirigentes, saíram de lá para o Território.
              if (item.somenteAdmin) return ehAdminGeral(usuario);
              // `podeGerenciar` já contempla o admin geral em qualquer escopo.
              if (item.escopo) return podeGerenciar(usuario, item.escopo);
              return true;
            }).map((item) => {
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

          {/* O rodapé é o atalho para a Conta. Ele já mostrava nome e @nickname, e desde
              que Conta saiu da lista (foi para a barra flutuante) tocar no próprio nome é o
              gesto que sobra — um cartão de perfil que não abre o perfil só decepciona. */}
          {usuario ? (
            <Pressable
              onPress={() => irPara("conta", "/(tabs)/conta")}
              accessibilityRole="button"
              accessibilityLabel={`Abrir a conta de ${usuario.nome}`}
              accessibilityState={{ selected: atual === "conta" }}
              style={({ pressed }) => [styles.rodape, pressed && styles.rodapePressionado]}
            >
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
              {/* A seta é o que diz que isto se toca. Sem ela o rodapé continua lendo como
                  legenda, e ninguém descobre o atalho. */}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
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
      // Alarga a área de toque para a borda do painel sem mexer no desenho: o recuo
      // horizontal é devolvido pela margem negativa.
      paddingHorizontal: spacing.lg,
      marginHorizontal: -spacing.lg,
      paddingBottom: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    rodapePressionado: { backgroundColor: colors.surfaceMuted },
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
