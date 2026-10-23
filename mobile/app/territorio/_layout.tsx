import { Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { preCarregarTerritorios, useTerritorios } from "@/api/hooks/useTerritorios";
import { ProvedorCelebracao } from "@/components/celebracao/contextoCelebracao";
import { LEVE } from "@/components/ministerio/kit";
import { BarraTerritorio } from "@/components/territorio/BarraTerritorio";
import { paletaTerritorio } from "@/components/territorio/tema";
import { ToastProvider } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { PaletaPropria, useTema } from "@/theme/TemaContext";
import { guardarAmbiente } from "@/utils/ambiente";
import { podeMarcarTerritorio } from "@/utils/permissoes";

/**
 * O ambiente Território: mapas, saídas e onde paramos, com paleta e barra próprias. É de todos
 * (ver o mapa é livre); o que cada um pode fazer continua com as permissões de sempre.
 */
export default function LayoutTerritorio() {
  return (
    <PaletaPropria paleta={paletaTerritorio}>
      <Ambiente />
    </PaletaPropria>
  );
}

function Ambiente() {
  const { colors } = useTema();
  const { usuario } = useAuth();
  const trabalha = podeMarcarTerritorio(usuario);
  const { data } = useTerritorios();

  // Só quem trabalha no território (dirigentes e quem cuida) reabre o app aqui. Quem só veio
  // olhar um mapa volta para o ambiente de antes.
  useEffect(() => {
    if (trabalha) guardarAmbiente("territorio");
  }, [trabalha]);

  // Guarda todos os territórios no celular para abrir no campo sem sinal (de 6 em 6 horas).
  useEffect(() => {
    if (data?.fonte === "banco" && !data.copiaLocalDe) preCarregarTerritorios(data.territorios.map((t) => t.numero));
  }, [data]);

  // Toast e "feito" daqui de dentro: os da raiz ficam acima da paleta e sairiam com as cores do Servir Mais.
  return (
    <ToastProvider>
      <ProvedorCelebracao>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* As abas trocam em fade; as telas empilhadas (o território, o histórico...) deslizam. */}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: "fade",
              animationDuration: LEVE,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="lista" />
            <Stack.Screen name="saidas" />
            <Stack.Screen name="painel" />
            <Stack.Screen name="[numero]" options={{ animation: "default" }} />
            <Stack.Screen name="historico" options={{ animation: "default" }} />
            <Stack.Screen name="nao-bater" options={{ animation: "default" }} />
            <Stack.Screen name="cartao" options={{ animation: "default" }} />
            <Stack.Screen name="importar" options={{ animation: "default" }} />
          </Stack>
          <BarraTerritorio />
        </View>
      </ProvedorCelebracao>
    </ToastProvider>
  );
}
