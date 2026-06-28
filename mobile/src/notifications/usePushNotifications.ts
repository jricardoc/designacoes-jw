import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { getNotifEnabled } from "./notifPref";
import { registerForPushNotificationsAsync } from "./push";

/**
 * Registra o dispositivo para push e expõe o Expo Push Token.
 *
 * Use o token impresso no console para enviar uma notificação de teste em
 * https://expo.dev/notifications. Para enviar notificações pelo backend, salve
 * este token (via um endpoint dedicado) e dispare pela API de push do Expo.
 */
export function usePushNotifications() {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const receivedRef = useRef<Notifications.EventSubscription | null>(null);
  const responseRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    let mounted = true;

    getNotifEnabled().then((enabled) => {
      if (!enabled || !mounted) return; // usuário desativou nas Configurações
      registerForPushNotificationsAsync().then((token) => {
        if (mounted && token) {
          setPushToken(token);
          console.log("Expo Push Token:", token);
        }
      });
    });

    receivedRef.current = Notifications.addNotificationReceivedListener(() => {
      // Notificação recebida com o app aberto (já exibida pelo handler).
    });
    responseRef.current = Notifications.addNotificationResponseReceivedListener(
      () => {
        // Usuário tocou na notificação — navegue aqui se necessário.
      },
    );

    return () => {
      mounted = false;
      receivedRef.current?.remove();
      responseRef.current?.remove();
    };
  }, []);

  return { pushToken };
}
