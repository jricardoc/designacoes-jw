import * as Notifications from "expo-notifications";
import { useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { getNotifEnabled } from "./notifPref";
import { sincronizarPushToken } from "./sincronizarPush";

// Identificador da última notificação já tratada. Fica no módulo, e não num ref,
// porque `getLastNotificationResponse()` devolve a resposta em cache toda vez —
// sem isso, uma remontagem das abas reabriria uma notificação antiga.
let ultimaRespostaTratada: string | null = null;

/**
 * Registra o dispositivo para push, envia o Expo Push Token para o backend
 * (`POST /push/token`) e leva o usuário à tela certa quando ele toca na
 * notificação.
 */
export function usePushNotifications() {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [telaPendente, setTelaPendente] = useState<"minhas" | null>(null);
  const router = useRouter();
  // Fica falso enquanto o router não montou: na abertura fria o toque na
  // notificação chega antes de existir para onde navegar.
  const navegacaoPronta = !!useRootNavigationState()?.key;
  const receivedRef = useRef<Notifications.EventSubscription | null>(null);
  const responseRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    let mounted = true;

    getNotifEnabled().then((enabled) => {
      if (!enabled || !mounted) return; // usuário desativou nas Configurações
      sincronizarPushToken(true).then((token) => {
        if (mounted && token) setPushToken(token);
      });
    });

    const tratarResposta = (resposta: Notifications.NotificationResponse) => {
      const { identifier } = resposta.notification.request;
      if (identifier === ultimaRespostaTratada) return;
      ultimaRespostaTratada = identifier;
      const data = resposta.notification.request.content.data as
        | { screen?: string }
        | undefined;
      if (data?.screen === "minhas") setTelaPendente("minhas");
    };

    // Abertura fria: o toque chega ao nativo antes de haver listener em JS.
    const inicial = Notifications.getLastNotificationResponse();
    if (inicial) tratarResposta(inicial);

    receivedRef.current = Notifications.addNotificationReceivedListener(() => {
      // Notificação recebida com o app aberto (já exibida pelo handler).
    });
    responseRef.current =
      Notifications.addNotificationResponseReceivedListener(tratarResposta);

    return () => {
      mounted = false;
      receivedRef.current?.remove();
      responseRef.current?.remove();
    };
  }, []);

  // Navega assim que houver rota pendente e o router estiver pronto — cobre
  // tanto o toque com o app aberto quanto a abertura fria.
  useEffect(() => {
    if (!telaPendente || !navegacaoPronta) return;
    setTelaPendente(null);
    router.push("/(tabs)/minhas");
  }, [telaPendente, navegacaoPronta, router]);

  return { pushToken };
}
