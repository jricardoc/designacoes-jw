import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, router, Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { ProvedorCelebracao } from "@/components/celebracao/contextoCelebracao";
import { BarraMinisterio } from "@/components/ministerio/BarraMinisterio";
import { Fundo, LEVE } from "@/components/ministerio/kit";
import { paletaMinisterio } from "@/components/ministerio/tema";
import { ToastProvider } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { PaletaPropria, useTema } from "@/theme/TemaContext";
import { guardarAmbiente, KEY_TOUR_MINISTERIO } from "@/utils/ambiente";
import { podeUsarPioneiro } from "@/utils/permissoes";

/**
 * O ambiente Ministério: um "app" dentro do app, com paleta, fundo e barra próprios. Entra-se
 * pela marca no topo do menu lateral do Servir Mais (e volta pela marca daqui).
 */
export default function LayoutMinisterio() {
  const { usuario } = useAuth();
  if (!podeUsarPioneiro(usuario)) return <Redirect href="/(tabs)/minhas" />;
  return (
    <PaletaPropria paleta={paletaMinisterio}>
      <Ambiente />
    </PaletaPropria>
  );
}

function Ambiente() {
  const { colors } = useTema();

  useEffect(() => {
    guardarAmbiente("ministerio");
    // A primeira vez aqui abre o tour das novidades.
    AsyncStorage.getItem(KEY_TOUR_MINISTERIO)
      .then((visto) => {
        if (visto !== "1") router.push("/ministerio/novidades");
      })
      .catch(() => {});
  }, []);

  // Toast e "feito" daqui de dentro: os da raiz ficam acima da paleta e sairiam com as cores do Servir Mais.
  return (
    <ToastProvider>
      <ProvedorCelebracao>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <Fundo />
          {/* Telas transparentes e troca em fade: o fundo animado fica, só o conteúdo muda. */}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "transparent" },
              animation: "fade",
              animationDuration: LEVE,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="agenda" />
            <Stack.Screen name="contatos" />
            <Stack.Screen name="progresso" />
            <Stack.Screen name="contato" />
            <Stack.Screen name="quilometragem" />
            <Stack.Screen name="perfil" />
            <Stack.Screen name="ajuda" />
            <Stack.Screen name="notificacoes" />
            <Stack.Screen name="notificacoes-config" />
            <Stack.Screen
              name="novidades"
              options={{ animation: "fade_from_bottom", gestureEnabled: false }}
            />
          </Stack>
          <BarraMinisterio />
        </View>
      </ProvedorCelebracao>
    </ToastProvider>
  );
}
