import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/layout/AppHeader";
import { BarraGlobalProvider } from "@/components/layout/contextoBarra";
import { usePushNotifications } from "@/notifications/usePushNotifications";
import { colors } from "@/theme";

export default function LayoutDoMenu() {
  const insets = useSafeAreaInsets();

  // Registra o dispositivo para notificações push após o login.
  usePushNotifications();

  // A pasta continua "(tabs)" de propósito: o nome entre parênteses não entra na
  // URL, então trocar a tab bar pelo menu lateral não mexeu em nenhuma rota.
  // O recuo de baixo é o que a tab bar reservava: sem ele o fim das listas fica
  // debaixo da barra de navegação do sistema.
  return (
    <View style={[styles.raiz, { paddingBottom: insets.bottom }]}>
      <AppHeader />
      <BarraGlobalProvider value>
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
          <Stack.Screen name="carrinho" />
          <Stack.Screen name="conta" />
          <Stack.Screen name="config" />
        </Stack>
      </BarraGlobalProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.background },
});
