import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProvedorCelebracao } from "@/components/celebracao/contextoCelebracao";
import { ServicosDoApp } from "@/components/layout/ServicosDoApp";
import { SplashAnimated } from "@/components/SplashAnimated";
import { Loading, ToastProvider } from "@/components/ui";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { queryClient } from "@/lib/queryClient";
import { TemaProvider, useTema } from "@/theme/TemaContext";
import { lerAmbiente, type Ambiente } from "@/utils/ambiente";

// Mantém a splash nativa (oliva + S+) até a JS saber o ambiente; aí entra a animada dele.
SplashScreen.preventAutoHideAsync().catch(() => {});
// A nativa sai em fade de 350 ms por cima da animada (no iOS ela sumia de uma vez).
SplashScreen.setOptions({ fade: true, duration: 350 });

/** Redirects between the login screen and the authenticated app. */
function AuthGate() {
  const { isAuthenticated, initializing } = useAuth();
  const { colors } = useTema();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const onLogin = segments[0] === "login";
    if (!isAuthenticated && !onLogin) {
      router.replace("/login");
    } else if (isAuthenticated && onLogin) {
      router.replace("/(tabs)/minhas");
    }
  }, [isAuthenticated, initializing, segments, router]);

  if (initializing) {
    return <Loading label="Carregando..." />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="quadro/[id]" />
        <Stack.Screen name="escala/[id]" />
        <Stack.Screen name="reuniao/meses" />
        <Stack.Screen name="cumprimento" />
        <Stack.Screen name="reuniao/semana/[id]" />
        <Stack.Screen name="territorio" />
        <Stack.Screen name="irmao" />
        <Stack.Screen name="notificacoes" />
        <Stack.Screen name="ministerio" />
        <Stack.Screen name="estudo" />
      </Stack>
      {isAuthenticated ? <ServicosDoApp /> : null}
    </>
  );
}

/** A barra de status acompanha o tema: texto claro no escuro e vice-versa. */
function BarraStatus() {
  const { esquema } = useTema();
  return <StatusBar style={esquema === "escuro" ? "light" : "dark"} />;
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);
  // A splash animada é a do ambiente em que o app vai abrir: o último usado (ver app/index).
  const [ambiente, setAmbiente] = useState<Ambiente | null>(null);

  useEffect(() => {
    lerAmbiente().then(setAmbiente);
  }, []);

  useEffect(() => {
    // A splash animada já está montada por cima; pode esconder a nativa.
    if (ambiente) SplashScreen.hideAsync().catch(() => {});
  }, [ambiente]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* A splash fica FORA do TemaProvider: ele segura a primeira pintura
                enquanto lê a preferência do AsyncStorage, e é ela que cobre esse
                instante. */}
            <TemaProvider>
              <ToastProvider>
                {/* Dentro do tema (o confete usa as cores dele) e por cima de tudo: a
                    comemoração cobre a tela inteira, e é disparada tanto pela lista de
                    tarefas quanto pelo botão de teste, em telas diferentes. */}
                <ProvedorCelebracao>
                  <BarraStatus />
                  <AuthGate />
                </ProvedorCelebracao>
              </ToastProvider>
            </TemaProvider>
            {!splashDone && ambiente ? <SplashAnimated ambiente={ambiente} onDone={() => setSplashDone(true)} /> : null}
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
