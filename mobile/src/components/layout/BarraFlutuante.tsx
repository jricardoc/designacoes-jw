import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router, useSegments } from "expo-router";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ABAS, chaveDaRotaAtual, type Aba } from "./abas";
import { useBarraCompacta } from "./contextoRolagem";
import {
  ALTURA_DA_BARRA,
  LADO_DO_INDICADOR,
  LARGURA_DA_ABA,
  recuoDaBarra,
} from "./geometriaBarra";
import { RegistrarCampoSheet } from "@/components/grupos/RegistrarCampoSheet";
import { Avatar } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import type { Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

/**
 * A barra flutuante de vidro fosco: quatro destinos, só ícones, e o "+" no meio.
 *
 * Convive com o menu lateral em vez de substituí-lo. O menu continua sendo o mapa inteiro do
 * app (Território, Carrinho, Confirmações, Publicadores, Ajustes); esta barra é o atalho para
 * os quatro lugares em que o irmão entra todo dia, sem abrir menu nenhum. O "+" é "Registrar o
 * campo": o relatório do mês, que antes só o dirigente anotava.
 *
 * NÃO usa `@react-navigation/bottom-tabs`. O app é um Stack do expo-router — a pasta se chama
 * "(tabs)" por herança, e o próprio layout registra isso: trocar de navegador mudaria o
 * formato de todas as rotas. Então a barra lê a rota atual por `useSegments` e navega por
 * `router.replace`, exatamente como o menu lateral já faz.
 */

// --- Geometria (ver geometriaBarra.ts, compartilhado com as telas). ---
const ALTURA = ALTURA_DA_BARRA;
const LARGURA_ABA = LARGURA_DA_ABA;
const INDICADOR = LADO_DO_INDICADOR;
const INDICADOR_TOPO = (ALTURA - INDICADOR) / 2;
const INDICADOR_X = (LARGURA_ABA - INDICADOR) / 2;
/** O vão do meio, onde mora o "+", e o botão, que sobe um pouco acima da pílula. */
const VAO = 76;
const MAIS = 56;
const MEIO = ABAS.length / 2;

/** A mola do indicador ao trocar de aba, e a do "pop" do ícone. */
const MOLA_INDICADOR = { mass: 0.8, damping: 15, stiffness: 140 };
const MOLA_ICONE = { mass: 0.4, damping: 9, stiffness: 220 };

/** O ícone que cresce um tico ao ficar ativo. `children` troca o ícone (a foto da Conta). */
function IconeComPop({
  nome,
  tamanho,
  cor,
  ativo,
  children,
}: {
  nome: keyof typeof Ionicons.glyphMap;
  tamanho: number;
  cor: string;
  ativo: boolean;
  children?: ReactNode;
}) {
  const escala = useSharedValue(ativo ? 1.14 : 1);

  useEffect(() => {
    escala.value = withSpring(ativo ? 1.14 : 1, MOLA_ICONE);
  }, [ativo, escala]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <Animated.View style={estilo}>
      {children ?? <Ionicons name={nome} size={tamanho} color={cor} />}
    </Animated.View>
  );
}

export function BarraFlutuante() {
  const { colors, esquema, styles } = useTema(criarEstilos);
  const { usuario } = useAuth();
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
  const [campo, setCampo] = useState(false);

  const escuro = esquema === "escuro";

  const atual = chaveDaRotaAtual(segments as string[]);
  const indiceAtivo = ABAS.findIndex((a) => a.chave === atual);

  /**
   * A posição do indicador, em índice de aba.
   *
   * Fora das quatro abas (Dirigentes, Território, Carrinho, Ajustes...) o indicador não some do lugar: ele
   * FICA onde estava e só se apaga. Mandá-lo para a posição 0 faria um deslize longo e
   * mentiroso toda vez que o irmão abrisse uma tela pelo menu.
   */
  const posicao = useSharedValue(Math.max(indiceAtivo, 0));
  const visivel = useSharedValue(indiceAtivo >= 0 ? 1 : 0);
  const estavaVisivel = useRef(indiceAtivo >= 0);

  useEffect(() => {
    const agoraVisivel = indiceAtivo >= 0;

    if (agoraVisivel) {
      // Voltando de uma tela de fora das quatro, o indicador está apagado: ele SALTA para o
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
    // Da 3ª aba em diante, o indicador pula o vão do "+" (na troca, desliza por cima dele).
    transform: [{ translateX: posicao.value * LARGURA_ABA + INDICADOR_X + VAO * Math.min(1, Math.max(0, posicao.value - (MEIO - 1))) }],
    opacity: visivel.value,
  }));

  const ir = (aba: Aba) => {
    if (aba.chave === atual) return; // já está nela: navegar só remontaria a tela
    // `replace`, e não `push`: as quatro são irmãs dentro de (tabs), como as abas eram. Empilhar
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
              width: ABAS.length * LARGURA_ABA + VAO,
              // O véu por cima do blur. O desfoque sozinho fica lavado; é a dupla que lê
              // como vidro.
              backgroundColor: escuro ? "rgba(20,20,22,0.55)" : "rgba(255,255,255,0.60)",
              borderColor: escuro ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
            },
          ]}
        >
          {/* UM indicador que desliza, e não quatro fundos que acendem e apagam. É esta
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

          {ABAS.map((aba, i) => {
            const ativo = aba.chave === atual;
            return (
              <Fragment key={aba.chave}>
                {i === MEIO ? <View style={{ width: VAO }} /> : null}
                <Pressable
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
                  >
                    {/* Com foto de perfil, a Conta mostra a foto; o anel faz o papel da cor de "ativo". */}
                    {aba.chave === "conta" && usuario?.fotoEm ? (
                      <View style={[styles.foto, { borderColor: ativo ? colors.primary : "transparent" }]}>
                        <Avatar usuario={usuario} tamanho={26} fundo={colors.sand} corTexto={colors.primaryDark} />
                      </View>
                    ) : undefined}
                  </IconeComPop>
                </Pressable>
              </Fragment>
            );
          })}
        </BlurView>
        {/* Fora da pílula: ela recorta o que passa da borda (o overflow que o blur precisa). */}
        <Pressable
          onPress={() => setCampo(true)}
          style={({ pressed }) => [styles.mais, { left: MEIO * LARGURA_ABA + (VAO - MAIS) / 2 }, pressed && styles.maisApertado]}
          accessibilityRole="button"
          accessibilityLabel="Registrar o campo"
        >
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.maisFundo, { borderColor: escuro ? "rgba(20,20,22,0.9)" : "#FFFFFF" }]}
          >
            <Ionicons name="add" size={30} color={colors.textOnPrimary} />
          </LinearGradient>
        </Pressable>
      </Animated.View>
      <RegistrarCampoSheet visible={campo} onClose={() => setCampo(false)} />
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
    foto: { borderWidth: 2, borderRadius: 16, padding: 1 },
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
    mais: {
      position: "absolute",
      top: (ALTURA - MAIS) / 2 - 12,
      width: MAIS,
      height: MAIS,
      borderRadius: MAIS / 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 12,
    },
    maisApertado: { transform: [{ scale: 0.94 }] },
    maisFundo: { flex: 1, borderRadius: MAIS / 2, borderWidth: 3, alignItems: "center", justifyContent: "center" },
    aba: {
      width: LARGURA_ABA,
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
  });
