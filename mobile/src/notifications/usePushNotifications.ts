import * as Notifications from "expo-notifications";
import { useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { registrarNotificacao } from "./historicoNotificacoes";
import { getNotifEnabled } from "./notifPref";
import { sincronizarPushToken } from "./sincronizarPush";

// Identificador da última notificação já tratada. Fica no módulo, e não num ref,
// porque `getLastNotificationResponse()` devolve a resposta em cache toda vez —
// sem isso, uma remontagem das abas reabriria uma notificação antiga.
let ultimaRespostaTratada: string | null = null;

/**
 * Carimbo real de chegada da notificação. Com o app fechado o registro só
 * acontece quando o usuário toca — usar a hora do JS marcaria "Agora" num aviso
 * de horas atrás. O iOS serializa `date` em segundos e o Android em
 * milissegundos; abaixo de 1e12 (set/2001 em ms) só pode ser segundos.
 */
function carimboDeChegada(date: number | undefined): string {
  if (typeof date === "number" && Number.isFinite(date) && date > 0) {
    const ms = date < 1e12 ? date * 1000 : date;
    const quando = new Date(ms);
    if (!Number.isNaN(quando.getTime())) return quando.toISOString();
  }
  return new Date().toISOString();
}

/** Copia a notificação para a central local. Falha aqui não pode atrapalhar o push. */
function guardarNoHistorico(notificacao: Notifications.Notification) {
  const { request } = notificacao;
  const { title, body, data } = request.content;
  registrarNotificacao(
    {
      titulo: title ?? "Notificação",
      corpo: body ?? "",
      recebidaEm: carimboDeChegada(notificacao.date),
      data: (data ?? undefined) as Record<string, unknown> | undefined,
    },
    request.identifier,
  ).catch(() => {});
}

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
      // Com o app fechado o listener de recebimento não roda: só o toque conta
      // que a notificação existiu. O histórico ignora id repetido, então
      // registrar aqui não duplica o que já entrou pelo recebimento.
      guardarNoHistorico(resposta.notification);
      const data = resposta.notification.request.content.data as
        | { screen?: string }
        | undefined;
      if (data?.screen === "minhas") setTelaPendente("minhas");
    };

    // Abertura fria: o toque chega ao nativo antes de haver listener em JS.
    const inicial = Notifications.getLastNotificationResponse();
    if (inicial) tratarResposta(inicial);

    receivedRef.current = Notifications.addNotificationReceivedListener(
      (notificacao) => {
        // Notificação recebida com o app aberto (já exibida pelo handler): fica
        // no histórico local, a única memória do que chegou — o backend não
        // guarda o que enviou.
        guardarNoHistorico(notificacao);
      },
    );
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
    // Se o usuário estava numa tela da pilha raiz (central de notificações,
    // Configurações, irmão, quadro, escala), navegar direto empilharia um
    // SEGUNDO grupo (tabs) — o layout inteiro montaria de novo, com outra
    // rodada de listeners de push. `dismissTo` volta para a instância que já
    // existe e o `navigate` seguinte resolve a tela de dentro.
    router.dismissTo("/(tabs)/minhas");
    router.navigate("/(tabs)/minhas");
  }, [telaPendente, navegacaoPronta, router]);

  return { pushToken };
}
