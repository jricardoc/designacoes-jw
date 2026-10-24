import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AMBIENTES } from "@/components/layout/Ambientes";
import { entrada } from "@/components/ministerio/kit";
import { VISUAL } from "@/components/SplashAnimated";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { iniciarTour, marcarNovidadesVistas, REGRAS } from "@/tour/estado";
import { NOVIDADES, type SecaoNovidades } from "@/tour/novidades";
import { lerAmbiente } from "@/utils/ambiente";

/**
 * "O que há de novo": abre sozinha uma vez a cada leva de novidades (ver ServicosDoApp) e fica em
 * Ajustes e no menu do Ministério. Cada um vê só o que usa (o Ministério, de quem é pioneiro).
 * No fim, o convite para o tutorial do ambiente em que a pessoa está.
 */
export default function NovidadesScreen() {
  const { colors, esquema, styles } = useTema(criarEstilos);
  const insets = useSafeAreaInsets();
  const { usuario } = useAuth();
  const vale = (s: { se?: keyof typeof REGRAS }) => !s.se || REGRAS[s.se](usuario);
  const secoes = NOVIDADES.filter(vale)
    .map((s) => ({ ...s, itens: s.itens.filter(vale) }))
    .filter((s) => s.itens.length);

  // Vista ao sair (por qualquer caminho): enquanto está aberta, o tutorial não começa por baixo.
  const usuarioId = usuario?.id ?? null;
  useEffect(() => () => void marcarNovidadesVistas(usuarioId), [usuarioId]);

  const fechar = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const fazerTour = async () => {
    const ambiente = await lerAmbiente();
    fechar();
    // Depois de a tela sair: o tutorial mede o que está por baixo.
    setTimeout(() => iniciarTour(ambiente, usuario), 500);
  };

  /** A cor de cada seção é a da marca do ambiente; no escuro, o tom mais claro dela. */
  const corDe = (chave: SecaoNovidades["chave"]) =>
    chave === "app" || chave === "admin" ? colors.primary : VISUAL[chave].fundo[esquema === "escuro" ? 0 : 1];
  const marcaDe = (chave: SecaoNovidades["chave"]) => AMBIENTES.find((a) => a.chave === chave)?.Marca;

  return (
    <View style={styles.tela}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 150 }]}>
        <Text style={styles.selo}>Outubro de 2026</Text>
        <Text style={styles.titulo} accessibilityRole="header">
          O que há de novo
        </Text>
        <Text style={styles.sub}>Tudo o que entrou no app, ambiente por ambiente.</Text>

        {secoes.map((s, si) => {
          const Marca = marcaDe(s.chave);
          const cor = corDe(s.chave);
          return (
            <Animated.View key={s.chave} entering={entrada(si)} style={styles.secao}>
              <View style={styles.secaoTopo}>
                {Marca ? (
                  <Marca tamanho={28} />
                ) : (
                  <View style={[styles.marcaGeral, { backgroundColor: cor }]}>
                    <Ionicons name={s.chave === "admin" ? "construct" : "phone-portrait"} size={15} color={colors.textOnPrimary} />
                  </View>
                )}
                <Text style={styles.secaoNome} accessibilityRole="header">
                  {s.nome}
                </Text>
              </View>
              <View style={styles.cartao}>
                {s.itens.map((item, i) => (
                  <View key={item.titulo} style={[styles.item, i > 0 && styles.itemBorda]}>
                    <View style={[styles.itemIcone, { backgroundColor: `${cor}1F` }]}>
                      <Ionicons name={item.icone} size={18} color={cor} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.itemTitulo}>{item.titulo}</Text>
                      <Text style={styles.itemTexto}>{item.texto}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View style={[styles.rodape, { paddingBottom: insets.bottom + 12 }]}>
        <Button label="Fazer o tour do app" icon="school" onPress={fazerTour} fullWidth />
        <Button label="Fechar" variant="ghost" onPress={fechar} fullWidth />
      </View>
    </View>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: 18 },
    flex: { flex: 1 },
    selo: { fontSize: 13, fontWeight: "900", color: colors.primary, textTransform: "uppercase", letterSpacing: 1.2 },
    titulo: { fontSize: 30, fontWeight: "900", color: colors.text, letterSpacing: -0.6, marginTop: 4 },
    sub: { fontSize: 15, color: colors.textSecondary, marginTop: 6, lineHeight: 21 },
    secao: { marginTop: 24, gap: 10 },
    secaoTopo: { flexDirection: "row", alignItems: "center", gap: 10 },
    marcaGeral: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    secaoNome: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
    cartao: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },
    item: { flexDirection: "row", gap: 12, paddingVertical: 13, alignItems: "flex-start" },
    itemBorda: { borderTopWidth: 1, borderTopColor: colors.border },
    itemIcone: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
    itemTitulo: { fontSize: 15.5, fontWeight: "800", color: colors.text },
    itemTexto: { fontSize: 14, color: colors.textSecondary, lineHeight: 19.5, marginTop: 2 },
    rodape: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 18,
      paddingTop: 12,
      gap: 4,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });
