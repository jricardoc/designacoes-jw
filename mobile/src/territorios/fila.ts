import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { ApiError, apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import { queryClient } from "@/lib/queryClient";

/**
 * Fila do que foi registrado no território: marcações do GPS e saídas.
 *
 * TUDO passa por aqui, com ou sem internet: o registro entra na fila (gravada no celular) e a
 * fila tenta enviar na hora. Sem sinal, ele fica guardado e sobe sozinho quando a conexão
 * volta, quando o app volta ao primeiro plano, ou a cada 20 s enquanto houver pendência.
 *
 * Cada item leva um `clientKey` gerado aqui. O servidor trata o mesmo clientKey como o mesmo
 * registro, então reenviar depois de uma resposta que se perdeu no caminho não duplica nada.
 *
 * Item que o servidor RECUSOU (dado inválido, sem permissão) não é reenviado: fica com o erro,
 * à vista, para o irmão ler e descartar. Falta de rede, sessão vencida e servidor fora do ar
 * não são recusa: o item espera a próxima tentativa.
 */

export interface ItemFila {
  clientKey: string;
  tipo: "saida" | "marcacao";
  /** Número do território, para mostrar o pendente no mapa certo. */
  numero: string;
  /** O corpo do POST, já com o clientKey. */
  corpo: Record<string, unknown>;
  /** "Paramos aqui · Território 01" */
  titulo: string;
  criadoEm: string;
  erro?: string;
}

const CHAVE = "territorios:fila";
const ROTA = { saida: "/territorios/saidas", marcacao: "/territorios/marcacoes" } as const;

let itens: ItemFila[] = [];
let enviando = false;
let carregada: Promise<void> | null = null;
let foto = { itens, enviando };
const ouvintes = new Set<() => void>();

function avisar() {
  foto = { itens, enviando };
  ouvintes.forEach((ouvir) => ouvir());
}

const gravar = () => AsyncStorage.setItem(CHAVE, JSON.stringify(itens)).catch(() => {});

function carregar() {
  carregada ??= AsyncStorage.getItem(CHAVE)
    .then((bruto) => {
      itens = bruto ? (JSON.parse(bruto) as ItemFila[]) : [];
      avisar();
    })
    .catch(() => {});
  return carregada;
}

export const novaChave = () => Crypto.randomUUID();

/** Envia o que está na fila, na ordem. Para no primeiro sinal de rede ruim. */
export async function enviarFila(): Promise<void> {
  await carregar();
  if (enviando || !itens.some((i) => !i.erro)) return;
  enviando = true;
  avisar();
  let enviou = false;
  try {
    for (const item of itens.filter((i) => !i.erro)) {
      try {
        await apiRequest(ROTA[item.tipo], { method: "POST", body: item.corpo, timeoutMs: 20000 });
        itens = itens.filter((i) => i.clientKey !== item.clientKey);
        enviou = true;
      } catch (erro) {
        if (!(erro instanceof ApiError) || erro.status === 0 || erro.status === 401 || erro.status >= 500) break;
        itens = itens.map((i) => (i.clientKey === item.clientKey ? { ...i, erro: erro.message } : i));
      } finally {
        avisar();
        await gravar();
      }
    }
  } finally {
    enviando = false;
    avisar();
    if (enviou) queryClient.invalidateQueries({ queryKey: qk.territorios });
  }
}

/**
 * Põe na fila e já tenta enviar. `enviado` diz se chegou ao servidor agora; `erro`, se o
 * servidor recusou — para a tela avisar na hora, e não só na lista da fila.
 */
export async function enfileirar(item: Omit<ItemFila, "criadoEm">): Promise<{ enviado: boolean; erro?: string }> {
  await carregar();
  itens = [...itens, { ...item, criadoEm: new Date().toISOString() }];
  avisar();
  await gravar();
  await enviarFila();
  const ficou = itens.find((i) => i.clientKey === item.clientKey);
  return { enviado: !ficou, erro: ficou?.erro };
}

export async function descartar(clientKey: string) {
  await carregar();
  itens = itens.filter((i) => i.clientKey !== clientKey);
  avisar();
  await gravar();
}

/** O estado da fila para as telas: pendentes, recusados e se está enviando agora. */
export function useFilaTerritorios() {
  useEffect(() => {
    carregar();
  }, []);
  const atual = useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir);
      return () => ouvintes.delete(ouvir);
    },
    () => foto,
  );
  return {
    itens: atual.itens,
    pendentes: atual.itens.filter((i) => !i.erro),
    recusados: atual.itens.filter((i) => i.erro),
    enviando: atual.enviando,
  };
}

/**
 * Liga o envio automático. Montar UMA vez, na área logada do app.
 */
export function useSincronizarFila() {
  useEffect(() => {
    enviarFila();
    const rede = Network.addNetworkStateListener((estado) => {
      if (estado.isConnected && estado.isInternetReachable !== false) enviarFila();
    });
    const app = AppState.addEventListener("change", (estado) => {
      if (estado === "active") enviarFila();
    });
    const relogio = setInterval(() => {
      if (itens.some((i) => !i.erro)) enviarFila();
    }, 20000);
    return () => {
      rede.remove();
      app.remove();
      clearInterval(relogio);
    };
  }, []);
}
