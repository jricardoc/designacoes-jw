import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router, useSegments, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBarraCompacta } from "./contextoRolagem";
import {
  ALTURA_DA_BARRA,
  LADO_DO_INDICADOR,
  LARGURA_DA_ABA,
  recuoDaBarra,
} from "./geometriaBarra";
import type { Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * A barra flutuante de vidro fosco: cinco destinos, só ícones.
 *
 * Convive com o menu lateral em vez de substituí-lo. O menu continua sendo o mapa inteiro do
 * app (Território, Carrinho, Confirmações, Publicadores, Ajustes); esta barra é o atalho para
 * os cinco lugares em que o irmão entra todo dia, sem abrir menu nenhum.
 *
 * NÃO usa `@react-navigation/bottom-tabs`. O app é um Stack do expo-router — a pasta se chama
 * "(tabs)" por herança, e o próprio layout registra isso: trocar de navegador mudaria o
 * formato de todas as rotas. Então a barra lê a rota atual por `useSegments` e navega por
 * `router.replace`, exatamente como o menu lateral já faz.
 */

interface Aba {
  /** O nome do arquivo da rota — é por ele que a aba acende. */
  chave: string;
  rotulo: string;
  href: Href;
  icone: keyof typeof Ionicons.glyphMap;
  iconeAtivo: keyof typeof Ionicons.glyphMap;
  /** Glifos com muito ar interno parecem menores; compensa-se por aba. */
  tamanho?: number;
}

const ABAS: Aba[] = [
  { chave: "minhas", rotulo: "Início", href: "/(tabs)/minhas", icone: "home-outline", iconeAtivo: "home" },
  { chave: "index", rotulo: "Designações", href: "/(tabs)", icone: "clipboard-outline", iconeAtivo: "clipboard" },
  { chave: "dirigentes", rotulo: "Dirigentes", href: "/(tabs)/dirigentes", icone: "people-outline", iconeAtivo: "people" },
  { chave: "reuniao", rotulo: "Reunião", href: "/(tabs)/reuniao", icone: "calendar-outline", iconeAtivo: "calendar" },
  { chave: "conta", rotulo: "Conta", href: "/(tabs)/conta", icone: "person-circle-outline", iconeAtivo: "person-circle", tamanho: 28 },
];

// --- Geometria (ver geometriaBarra.ts, compartilhado com as telas). ---
const ALTURA = ALTURA_DA_BARRA;
const LARGURA_ABA = LARGURA_DA_ABA;
const INDICADOR = LADO_DO_INDICADOR;
const INDICADOR_TOPO = (ALTURA - INDICADOR) / 2;
const INDICADOR_X = (LARGURA_ABA - INDICADOR) / 2;

/** A mola do indicador ao trocar de aba, e a do "pop" do ícone. */
const MOLA_INDICADOR = { mass: 0.8, damping: 15, stiffness: 140 };
const MOLA_ICONE = { mass: 0.4, damping: 9, stiffness: 220 };

/** O ícone que cresce um tico ao ficar ativo. */
function IconeComPop({
  nome,
  tamanho,
  cor,
  ativo,
}: {
  nome: keyof typeof Ionicons.glyphMap;
  tamanho: number;
  cor: string;
  ativo: boolean;
}) {
  const escala = useSharedValue(ativo ? 1.14 : 1);

  useEffect(() => {
    escala.value = withSpring(ativo ? 1.14 : 1, MOLA_ICONE);
  }, [ativo, escala]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <Animated.View style={estilo}>
      <Ionicons name={nome} size={tamanho} color={cor} />
    </Animated.View>
  );
}

export function BarraFlutuante() {
  const { colors, esquema, styles } = useTema(criarEstilos);
  const segments = useSegments();
  const compacta = useBarraCompacta();
  const insets = useSafeAreaInsets();

  /**
   * A distância até a borda de baixo, calculada AQUI.
   *
   * Antes a barra usava `bottom: 10` contando com o recuo do container de (tabs). Duas coisas
   * estavam erradas nisso: o container não reserva mais nada (o recuo dele pintava uma faixa
   * de fundo no fim de toda tela), e mesmo quando reservava um filho absoluto se posiciona
   * pela BORDA do pai, não pelo padding — então a pílula ficava colada no rodapé de qualquer
   * jeito, por cima da barra de navegação do sistema.
   */
  const recuoInferior = recuoDaBarra(insets.bottom);

  const escuro = esquema === "escuro";

  // Mesma leitura de rota do menu lateral: divergir faria a aba acender numa tela e o menu
  // marcar outra.
  const grupo = segments[0] as string | undefined;
  const atual = grupo === "(tabs)" ? ((segments[1] as string | undefined) ?? "index") : (grupo ?? "");
  const indiceAtivo = ABAS.findIndex((a) => a.chave === atual);

  /**
   * A posição do indicador, em índice de aba.
   *
   * Fora das cinco abas (Território, Carrinho, Ajustes...) o indicador não some do lugar: ele
   * FICA onde estava e só se apaga. Mandá-lo para a posição 0 faria um deslize longo e
   * mentiroso toda vez que o irmão abrisse uma tela pelo menu.
   */
  const posicao = useSharedValue(Math.max(indiceAtivo, 0));
  const visivel = useSharedValue(indiceAtivo >= 0 ? 1 : 0);
  const estavaVisivel = useRef(indiceAtivo >= 0);

  useEffect(() => {
    const agoraVisivel = indiceAtivo >= 0;

    if (agoraVisivel) {
      // Voltando de uma tela de fora das cinco, o indicador está apagado: ele SALTA para o
      // lugar novo em vez de deslizar. Deslizar apagado e aparecer no meio do caminho faria
      // um movimento que ninguém pediu e que não corresponde a troca de aba nenhuma.
      if (estavaVisivel.current) posicao.value = withSpring(indiceAtivo, MOLA_INDICADOR);
      else posicao.value = indiceAtivo;
    }

    visivel.value = withTiming(agoraVisivel ? 1 : 0, { duration: 160 });
    estavaVisivel.current = agoraVisivel;
  }, [indiceAtivo, posicao, visivel]);

  const estiloDaPilula = useAnimatedStyle(() => ({
    // Só a escala é animada. Esconder ou deslocar a barra causaria salto no layout — e ela
    // precisa continuar alcançável mesmo no meio de uma rolagem longa.
    transform: [{ scale: 1 - compacta.value * 0.14 }],
  }));

  const estiloDoIndicador = useAnimatedStyle(() => ({
    transform: [{ translateX: posicao.value * LARGURA_ABA + INDICADOR_X }],
    opacity: visivel.value,
  }));

  const ir = (aba: Aba) => {
    if (aba.chave === atual) return; // já está nela: navegar só remontaria a tela
    // `replace`, e não `push`: as cinco são irmãs dentro de (tabs), como as abas eram. Empilhar
    // faria o voltar do Android refazer todo o passeio em vez de sair do app.
    router.replace(aba.href);
  };

  return (
    // `box-none`: o container ocupa a largura toda, mas só a pílula recebe toque. Sem isso ele
    // engoliria os toques na faixa inteira acima do rodapé.
    <View pointerEvents="box-none" style={[styles.raiz, { bottom: recuoInferior }]}>
      <Animated.View style={[styles.sombra, estiloDaPilula]}>
        <BlurView
          intensity={escuro ? 40 : 60}
          tint={escuro ? "dark" : "light"}
          // Sem isto o Android ignora o desfoque e sobra um retângulo translúcido.
          experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
          style={[
            styles.pilula,
            {
              width: ABAS.length * LARGURA_ABA,
              // O véu por cima do blur. O desfoque sozinho fica lavado; é a dupla que lê
              // como vidro.
              backgroundColor: escuro ? "rgba(20,20,22,0.55)" : "rgba(255,255,255,0.60)",
              borderColor: escuro ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
            },
          ]}
        >
          {/* UM indicador que desliza, e não cinco fundos que acendem e apagam. É esta
              decisão que dá o caráter da barra. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicador,
              // A cor da marca a ~13%: vem do tema, então o modo daltônico acompanha.
              { backgroundColor: `${colors.primary}22` },
              estiloDoIndicador,
            ]}
          />

          {ABAS.map((aba) => {
            const ativo = aba.chave === atual;
            return (
              <Pressable
                key={aba.chave}
                onPress={() => ir(aba)}
                style={styles.aba}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                accessibilityLabel={aba.rotulo}
              >
                <IconeComPop
                  nome={ativo ? aba.iconeAtivo : aba.icone}
                  tamanho={aba.tamanho ?? 24}
                  cor={ativo ? colors.primary : colors.textMuted}
                  ativo={ativo}
                />
              </Pressable>
            );
          })}
        </BlurView>
      </Animated.View>
    </View>
  );
}

const criarEstilos = (_colors: Cores) =>
  StyleSheet.create({
    // `bottom` entra em tempo de render: depende da área segura do aparelho.
    raiz: {
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
    },
    /**
     * A sombra vive AQUI, e não na BlurView: ela precisa de `overflow: hidden` para o blur
     * respeitar o raio, e overflow recorta a própria sombra.
     */
    sombra: {
      borderRadius: ALTURA / 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 10,
    },
    pilula: {
      flexDirection: "row",
      alignItems: "center",
      height: ALTURA,
      borderRadius: ALTURA / 2,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
    },
    indicador: {
      position: "absolute",
      left: 0,
      top: INDICADOR_TOPO,
      width: INDICADOR,
      height: INDICADOR,
      borderRadius: INDICADOR / 2,
    },
    aba: {
      width: LARGURA_ABA,
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
  });
