import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { ApiError, apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { PainelPioneiro } from "@/api/types";
import { queryClient } from "@/lib/queryClient";

/**
 * Fila do que foi registrado no território (marcações do GPS e saídas), da leitura marcada no
 * Estudo pessoal e do cronômetro do Ministério.
 *
 * TUDO desses tipos passa por aqui, com ou sem internet: o registro entra na fila (gravada no celular) e a
 * fila tenta enviar na hora. Sem sinal, ele fica guardado e sobe sozinho quando a conexão
 * volta, quando o app volta ao primeiro plano, ou a cada 20 s enquanto houver pendência.
 *
 * Cada item leva um `clientKey` gerado aqui. O servidor trata o mesmo clientKey como o mesmo
 * registro, então reenviar depois de uma resposta que se perdeu no caminho não duplica nada. A
 * leitura e o cronômetro já são assim por natureza (marcar de novo, iniciar rodando), e levam
 * `em`, a hora em que foram feitos, que é a que conta no servidor.
 *
 * Item que o servidor RECUSOU (dado inválido, sem permissão) não é reenviado: o do território
 * fica com o erro, à vista, para o irmão ler e descartar; o do Estudo e do Ministério sai da
 * fila (não há lista para ele). Falta de rede, sessão vencida e servidor fora do ar não são
 * recusa (nem o limite de chamadas): o item espera a próxima tentativa.
 *
 * A leitura e o cronômetro são de uma pessoa: levam o `usuarioId` e só sobem com ela logada,
 * para nada cair na conta de outro no mesmo celular.
 */

export interface ItemFila {
  clientKey: string;
  tipo: "saida" | "marcacao" | "leitura" | "cronometro";
  /** Número do território, para mostrar o pendente no mapa certo (só nos do território). */
  numero?: string;
  /** De quem é (a leitura e o cronômetro). */
  usuarioId?: number;
  /** O corpo da chamada, já com o clientKey. */
  corpo: Record<string, unknown>;
  /** "Paramos aqui · Território 01" */
  titulo: string;
  criadoEm: string;
  erro?: string;
}

const CHAVE = "territorios:fila";
const DESTINO = {
  saida: { rota: "/territorios/saidas", metodo: "POST" },
  marcacao: { rota: "/territorios/marcacoes", metodo: "POST" },
  leitura: { rota: "/estudo/leituras", metodo: "PUT" },
  cronometro: { rota: "/pioneiro/cronometro", metodo: "POST" },
} as const;

const doTerritorio = (i: ItemFila) => i.tipo === "saida" || i.tipo === "marcacao";

let itens: ItemFila[] = [];
let enviando = false;
let rodada: Promise<void> | null = null;
let carregada: Promise<void> | null = null;
/** Quem está logado (o AuthContext avisa): só os itens dele (ou os sem dono) sobem. */
let dono: number | null = null;
let foto: { itens: ItemFila[]; enviando: boolean; dono: number | null } = { itens, enviando, dono };
const ouvintes = new Set<() => void>();
/** A resposta (ou a recusa) dos itens que um `enfileirar` está esperando. */
const esperados = new Map<string, { resposta?: unknown; erro?: string }>();

function avisar() {
  foto = { itens, enviando, dono };
  ouvintes.forEach((ouvir) => ouvir());
}

const podeEnviar = (i: ItemFila) => !i.erro && (i.usuarioId === undefined || i.usuarioId === dono);

export function definirDonoDaFila(id: number | null) {
  if (dono === id) return;
  dono = id;
  avisar();
  if (id !== null) enviarFila();
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

/**
 * Envia o que está na fila, na ordem. Para no primeiro sinal de rede ruim. Quem chama durante
 * uma rodada espera a mesma rodada, e ela leva junto o que entrou no meio.
 */
export function enviarFila(): Promise<void> {
  rodada ??= rodar().finally(() => {
    rodada = null;
  });
  return rodada;
}

async function rodar() {
  await carregar();
  if (!itens.some(podeEnviar)) return;
  enviando = true;
  avisar();
  const enviou = new Set<ItemFila["tipo"]>();
  try {
    let item: ItemFila | undefined;
    while ((item = itens.find(podeEnviar))) {
      const atual: ItemFila = item;
      const esperado = esperados.get(atual.clientKey);
      try {
        const { rota, metodo } = DESTINO[atual.tipo];
        const resposta = await apiRequest(rota, { method: metodo, body: atual.corpo, timeoutMs: 20000 });
        itens = itens.filter((i) => i.clientKey !== atual.clientKey);
        if (esperado) esperado.resposta = resposta;
        chegou(atual, resposta);
        enviou.add(atual.tipo);
      } catch (erro) {
        // Rede, sessão vencida, limite de chamadas (429) e servidor fora do ar: tenta depois.
        if (!(erro instanceof ApiError) || erro.status === 0 || erro.status === 401 || erro.status === 429 || erro.status >= 500) break;
        if (esperado) esperado.erro = erro.message;
        itens = doTerritorio(atual)
          ? itens.map((i) => (i.clientKey === atual.clientKey ? { ...i, erro: erro.message } : i))
          : itens.filter((i) => i.clientKey !== atual.clientKey);
      } finally {
        avisar();
        await gravar();
      }
    }
  } finally {
    enviando = false;
    avisar();
    if (enviou.has("saida") || enviou.has("marcacao")) queryClient.invalidateQueries({ queryKey: qk.territorios });
    if (enviou.has("leitura")) queryClient.invalidateQueries({ queryKey: qk.estudo });
    if (enviou.has("cronometro")) queryClient.invalidateQueries({ queryKey: ["pioneiro"] });
  }
}

/** O cronômetro que chegou já vale no painel: sem isso, o relógio voltaria um instante até a releitura. */
function chegou(item: ItemFila, resposta: unknown) {
  const { cronometro } = (resposta ?? {}) as Partial<PainelPioneiro>;
  if (item.tipo === "cronometro" && cronometro) {
    queryClient.setQueriesData<PainelPioneiro>({ queryKey: ["pioneiro", "painel"] }, (p) => (p ? { ...p, cronometro } : p));
  }
}

/**
 * Põe na fila e já tenta enviar. `enviado` diz se chegou ao servidor agora (com a `resposta`);
 * `erro`, se o servidor recusou — para a tela avisar na hora, e não só na lista da fila.
 */
export async function enfileirar(item: Omit<ItemFila, "criadoEm">): Promise<{ enviado: boolean; erro?: string; resposta?: unknown }> {
  await carregar();
  esperados.set(item.clientKey, {});
  const pessoal = item.tipo === "leitura" || item.tipo === "cronometro";
  itens = [...itens, { ...item, ...(pessoal && dono !== null ? { usuarioId: dono } : {}), criadoEm: new Date().toISOString() }];
  avisar();
  await gravar();
  await enviarFila();
  const { resposta, erro } = esperados.get(item.clientKey) ?? {};
  esperados.delete(item.clientKey);
  const ficou = itens.find((i) => i.clientKey === item.clientKey);
  return { enviado: !ficou && !erro, erro: ficou?.erro ?? erro, resposta };
}

export async function descartar(clientKey: string) {
  await carregar();
  itens = itens.filter((i) => i.clientKey !== clientKey);
  avisar();
  await gravar();
}

function useFoto() {
  useEffect(() => {
    carregar();
  }, []);
  return useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir);
      return () => ouvintes.delete(ouvir);
    },
    () => foto,
  );
}

/** O estado da fila do território para as telas: pendentes, recusados e se está enviando agora. */
export function useFilaTerritorios() {
  const atual = useFoto();
  const doMapa = atual.itens.filter(doTerritorio);
  return {
    itens: doMapa,
    pendentes: doMapa.filter((i) => !i.erro),
    recusados: doMapa.filter((i) => i.erro),
    enviando: atual.enviando,
  };
}

/** O que de um tipo (da pessoa logada) ainda espera a rede, na ordem: o cronômetro anda com isso. */
export function usePendentes(tipo: ItemFila["tipo"]) {
  const atual = useFoto();
  return atual.itens.filter((i) => i.tipo === tipo && !i.erro && i.usuarioId === (atual.dono ?? undefined));
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
      if (itens.some(podeEnviar)) enviarFila();
    }, 20000);
    return () => {
      rede.remove();
      app.remove();
      clearInterval(relogio);
    };
  }, []);
}
