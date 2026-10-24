import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState } from "react-native";

export const queryClient = new QueryClient({
  defaultOptions: {
    // "always": a chamada sai mesmo sem sinal, como sempre saiu. Cada tela já sabe o que mostrar
    // sem internet (a cópia do celular, o aviso de erro), e o sinal só serve para recarregar.
    queries: { retry: 1, staleTime: 30_000, networkMode: "always" },
    mutations: { networkMode: "always" },
  },
});

// Voltou ao app (ou destravou o Face ID): o que está na tela e tem mais de 30 s recarrega. Sem
// isto, quem deixava o app aberto via os dados de horas atrás até puxar a tela.
focusManager.setEventListener((focar) => {
  const sub = AppState.addEventListener("change", (estado) => focar(estado === "active"));
  return () => sub.remove();
});

// O sinal voltou: recarrega o que está na tela. O estado de partida importa: se o app abriu sem
// rede e ninguém disser, a volta do sinal não parece volta.
onlineManager.setEventListener((online) => {
  const atualizar = (e: Network.NetworkState) => online(!!e.isConnected && e.isInternetReachable !== false);
  Network.getNetworkStateAsync().then(atualizar).catch(() => {});
  const sub = Network.addNetworkStateListener(atualizar);
  return () => sub.remove();
});
