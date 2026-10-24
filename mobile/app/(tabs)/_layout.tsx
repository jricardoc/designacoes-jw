import { Stack, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { AppHeader } from "@/components/layout/AppHeader";
import { BarraFlutuante } from "@/components/layout/BarraFlutuante";
import { NavegacaoPorGesto } from "@/components/layout/NavegacaoPorGesto";
import { ProvedorRolagem } from "@/components/layout/contextoRolagem";
import { BarraGlobalProvider } from "@/components/layout/contextoBarra";
import { useTema } from "@/theme/TemaContext";
import { useTourAutomatico } from "@/tour/estado";
import { guardarAmbiente } from "@/utils/ambiente";

export default function LayoutDoMenu() {
  const { colors } = useTema();

  // Push, sincronização e biometria moram na raiz (ServicosDoApp), valendo em todos os ambientes.
  // Daqui só sai o lembrete de que é aqui que o app abre da próxima vez — também ao voltar do
  // Território aberto pelo menu, que fica por cima daqui.
  useFocusEffect(useCallback(() => guardarAmbiente("servir"), []));
  // A primeira vez aqui, o tutorial começa sozinho (é ele que ensina a trocar de ambiente).
  useTourAutomatico("servir");

  // A pasta continua "(tabs)" de propósito: o nome entre parênteses não entra na
  // URL, então trocar a tab bar pelo menu lateral não mexeu em nenhuma rota.
  //
  // SEM recuo embaixo, e isso é decisão. O recuo que morava aqui pintava uma faixa da cor do
  // fundo no fim de TODA tela: o conteúdo parava antes da borda e nada rolava por baixo da
  // barra flutuante — que é justamente o que dá o efeito de vidro. Agora quem reserva o
  // espaço é cada tela, pelo `recuo` de `useBarraFlutuante`, que já soma a área segura.
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader />
      {/* O provedor envolve as telas E a barra: é ele que leva a rolagem de uma para a
          outra. Fora dele a barra não encolheria ao rolar. Um Provider não desenha view
          nenhuma, então o Stack continua sendo o filho que ocupa a altura. */}
      <ProvedorRolagem>
        <BarraGlobalProvider value>
          {/* Envolve só o Stack, e não a barra: arrastar SOBRE a pílula é para tocar nela,
              não para trocar de tela. */}
          <NavegacaoPorGesto>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: "fade",
              }}
            >
              <Stack.Screen name="minhas" />
              <Stack.Screen name="index" />
              <Stack.Screen name="dirigentes" />
              <Stack.Screen name="reuniao" />
              <Stack.Screen name="confirmacoes" />
              <Stack.Screen name="grupos" />
              <Stack.Screen name="tarefas" />
              <Stack.Screen name="carrinho" />
              <Stack.Screen name="conta" />
              <Stack.Screen name="config" />
              <Stack.Screen name="ajustes" />
            </Stack>
          </NavegacaoPorGesto>
        </BarraGlobalProvider>

        {/* Depois do Stack, para ficar por cima dele. O menu lateral continua sendo o mapa
            inteiro do app; esta barra é o atalho dos cinco destinos do dia a dia. */}
        <BarraFlutuante />
      </ProvedorRolagem>
    </View>
  );
}
