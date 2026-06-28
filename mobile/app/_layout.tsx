import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SplashAnimated } from "@/components/SplashAnimated";
import { Loading, ToastProvider } from "@/components/ui";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { queryClient } from "@/lib/queryClient";
import { colors } from "@/theme";

// Mantém a splash nativa (oliva + S+) até a JS estar pronta; aí entra a animada.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Redirects between the login screen and the authenticated app. */
function AuthGate() {
  const { isAuthenticated, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const onLogin = segments[0] === "login";
    if (!isAuthenticated && !onLogin) {
      router.replace("/login");
    } else if (isAuthenticated && onLogin) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, initializing, segments, router]);

  if (initializing) {
    return <Loading label="Carregando..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="quadro/[id]" />
      <Stack.Screen name="escala/[id]" />
      <Stack.Screen name="config" />
      <Stack.Screen name="irmao" />
    </Stack>
  );
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // A splash animada já está montada por cima; pode esconder a nativa.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <AuthGate />
              {!splashDone ? <SplashAnimated onDone={() => setSplashDone(true)} /> : null}
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
