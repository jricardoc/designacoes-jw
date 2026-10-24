import { Ionicons } from "@expo/vector-icons";
import { QueryClientProvider } from "@tanstack/react-query";
import { router as roteador, Stack, usePathname, useRouter, useSegments, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProvedorCelebracao } from "@/components/celebracao/contextoCelebracao";
import { ServicosDoApp } from "@/components/layout/ServicosDoApp";
import { SplashAnimated } from "@/components/SplashAnimated";
import { Loading, ToastProvider } from "@/components/ui";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { definirTelaDoErro, ligarRegistroDeErros, registrarErro } from "@/lib/erros";
import { queryClient } from "@/lib/queryClient";
import { paletaDe } from "@/theme";
import { TemaProvider, useTema } from "@/theme/TemaContext";
import { marcarAberturaPronta } from "@/utils/abertura";
import { lerAmbiente, type Ambiente } from "@/utils/ambiente";

// Mantém a splash nativa (oliva + S+) até a JS saber o ambiente; aí entra a animada dele.
SplashScreen.preventAutoHideAsync().catch(() => {});
// A nativa sai em fade de 350 ms por cima da animada (no iOS ela sumia de uma vez).
SplashScreen.setOptions({ fade: true, duration: 350 });
// As exceções do JS vão para Ajustes › Erros do app (ver src/lib/erros).
ligarRegistroDeErros();

/**
 * Uma tela que quebrou não fecha o app: aparece esta, o erro vai para Ajustes › Erros do app e
 * dá para tentar de novo ou voltar ao começo. Ela entra no lugar dos provedores (tema, conta),
 * então pinta com a paleta direto.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = paletaDe(useColorScheme() === "dark" ? "escuro" : "claro", false);
  useEffect(() => {
    registrarErro(error);
  }, [error]);
  const voltar = () => {
    roteador.replace("/");
    retry();
  };
  return (
    <View style={[erroEstilos.tela, { backgroundColor: c.background }]}>
      <Ionicons name="bandage-outline" size={44} color={c.primary} />
      <Text style={[erroEstilos.titulo, { color: c.text }]}>Algo deu errado nesta tela</Text>
      <Text style={[erroEstilos.texto, { color: c.textSecondary }]}>
        O erro já foi anotado para quem cuida do app. Tente de novo ou volte ao começo.
      </Text>
      <Pressable onPress={retry} style={[erroEstilos.botao, { backgroundColor: c.primary }]} accessibilityRole="button">
        <Text style={[erroEstilos.botaoTexto, { color: c.textOnPrimary }]}>Tentar de novo</Text>
      </Pressable>
      <Pressable onPress={voltar} style={erroEstilos.secundario} accessibilityRole="button" hitSlop={8}>
        <Text style={[erroEstilos.botaoTexto, { color: c.primary }]}>Voltar ao começo</Text>
      </Pressable>
    </View>
  );
}

const erroEstilos = StyleSheet.create({
  tela: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  titulo: { fontSize: 21, fontWeight: "800", textAlign: "center", marginTop: 6 },
  texto: { fontSize: 15, lineHeight: 21, textAlign: "center", marginBottom: 8 },
  botao: { alignSelf: "stretch", alignItems: "center", paddingVertical: 14, borderRadius: 14 },
  secundario: { paddingVertical: 10 },
  botaoTexto: { fontSize: 16, fontWeight: "700" },
});

/** Redirects between the login screen and the authenticated app. */
function AuthGate() {
  const { isAuthenticated, initializing } = useAuth();
  const { colors } = useTema();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => definirTelaDoErro(pathname), [pathname]);

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
        <Stack.Screen name="erros" />
        <Stack.Screen name="novidades" options={{ animation: "fade_from_bottom" }} />
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
    // Rede de segurança: se a splash não avisar o fim, as novidades e o tutorial não ficam presos.
    const t = setTimeout(marcarAberturaPronta, 8000);
    return () => clearTimeout(t);
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
            {!splashDone && ambiente ? (
              <SplashAnimated
                ambiente={ambiente}
                onDone={() => {
                  setSplashDone(true);
                  marcarAberturaPronta();
                }}
              />
            ) : null}
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
