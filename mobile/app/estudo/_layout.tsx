import { Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { ProvedorCelebracao } from "@/components/celebracao/contextoCelebracao";
import { BarraEstudo } from "@/components/estudo/BarraEstudo";
import { paletaEstudo } from "@/components/estudo/tema";
import { LEVE } from "@/components/ministerio/kit";
import { ToastProvider } from "@/components/ui";
import { PaletaPropria, useTema } from "@/theme/TemaContext";
import { guardarAmbiente } from "@/utils/ambiente";

/**
 * O ambiente Estudo pessoal: a leitura da Bíblia e o estudo de cada um, com paleta e barra
 * próprias. É de todos; os dados são do usuário (não precisa de cadastro de irmão ligado).
 */
export default function LayoutEstudo() {
  return (
    <PaletaPropria paleta={paletaEstudo}>
      <Ambiente />
    </PaletaPropria>
  );
}

function Ambiente() {
  const { colors } = useTema();

  // Quem está aqui reabre o app aqui.
  useEffect(() => {
    guardarAmbiente("estudo");
  }, []);

  // Toast e "feito" daqui de dentro: os da raiz ficam acima da paleta e sairiam com as cores do Servir Mais.
  return (
    <ToastProvider>
      <ProvedorCelebracao>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* As abas trocam em fade; as telas empilhadas (programa, livro, sessão) deslizam. */}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: "fade",
              animationDuration: LEVE,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="leitura" />
            <Stack.Screen name="assuntos" />
            <Stack.Screen name="rotina" />
            <Stack.Screen name="programa" options={{ animation: "default" }} />
            <Stack.Screen name="livro" options={{ animation: "default" }} />
            <Stack.Screen name="sessao" options={{ animation: "default" }} />
          </Stack>
          <BarraEstudo />
        </View>
      </ProvedorCelebracao>
    </ToastProvider>
  );
}
