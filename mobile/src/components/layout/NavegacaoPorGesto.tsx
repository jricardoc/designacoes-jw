import { router, useSegments } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { ABAS, indiceDaAba } from "./abas";

/**
 * Arrastar para o lado troca de aba.
 *
 * NÃO é um pager: as telas não seguem o dedo. É um GESTO DE ATALHO — reconhecido o arrasto,
 * a navegação acontece com a mesma transição de sempre. Fazer as telas acompanharem o dedo
 * exigiria trocar o Stack do expo-router por um pager, e o layout de (tabs) registra por que
 * isso não se faz aqui: mudaria o formato de todas as rotas do app.
 *
 * SÓ VALE NAS CINCO ABAS. Em Território, Carrinho, Confirmações, Publicadores e Ajustes o
 * gesto não faz nada — não há vizinha para onde ir, e é justamente onde moram os únicos
 * scrolls horizontais do app (os chips de filtro de Publicadores), que brigariam pelo dedo.
 *
 * E não dá a volta: no Início, arrastar para a direita não leva à Conta. Uma lista de cinco
 * itens tem começo e fim, e circular faria o irmão perder a noção de onde está.
 */

/** Quanto o dedo precisa andar na horizontal para o gesto sequer começar a valer. */
const ATIVACAO = 28;

/** Se o dedo andar isto na VERTICAL antes, é rolagem — o gesto desiste. */
const DESISTE_NA_VERTICAL = 22;

/** Distância (ou velocidade) que confirma a troca ao soltar. */
const DISTANCIA = 70;
const VELOCIDADE = 550;

export function NavegacaoPorGesto({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const indice = indiceDaAba(segments as string[]);

  const irPara = (destino: number) => {
    const aba = ABAS[destino];
    if (aba) router.replace(aba.href);
  };

  const arrastar = Gesture.Pan()
    // Os dois limiares são o que faz este gesto conviver com a rolagem vertical das telas:
    // ele só entra em jogo depois de um movimento claramente lateral, e sai de cena assim
    // que o dedo mostra que quer subir ou descer.
    .activeOffsetX([-ATIVACAO, ATIVACAO])
    .failOffsetY([-DESISTE_NA_VERTICAL, DESISTE_NA_VERTICAL])
    .onEnd((evento) => {
      if (indice < 0) return;

      const paraEsquerda = evento.translationX < -DISTANCIA || evento.velocityX < -VELOCIDADE;
      const paraDireita = evento.translationX > DISTANCIA || evento.velocityX > VELOCIDADE;

      // Arrastar para a ESQUERDA puxa a próxima para dentro da tela — o mesmo sentido de
      // virar a página de um livro.
      if (paraEsquerda && indice < ABAS.length - 1) runOnJS(irPara)(indice + 1);
      else if (paraDireita && indice > 0) runOnJS(irPara)(indice - 1);
    });

  return (
    <GestureDetector gesture={arrastar}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
