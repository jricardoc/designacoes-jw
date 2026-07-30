import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "notif_historico";

/**
 * Teto de registros guardados. Sem limite a lista cresceria para sempre no
 * aparelho de quem nunca limpa — e ela vive inteira na memória do AsyncStorage.
 */
const MAX_REGISTROS = 50;

export interface NotificacaoRegistrada {
  id: string;
  titulo: string;
  corpo: string;
  recebidaEm: string;
  lida: boolean;
  data?: Record<string, unknown>;
}

/**
 * Ouvintes avisados a cada mudança do histórico. O sino fica na barra global e a
 * central é outra tela — árvores diferentes, sem provedor em comum — então a
 * notícia de "mudou" viaja por este publisher de módulo, não por contexto.
 */
const ouvintes = new Set<() => void>();

function avisarOuvintes() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

/** Assina as mudanças do histórico. Devolve a função que cancela a assinatura. */
export function assinarNotificacoes(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

// Desempata ids gerados no mesmo milissegundo: duas notificações que chegam
// juntas não podem virar a mesma key na lista.
let sequencia = 0;

// Toda escrita é ler-alterar-gravar. Enfileirar evita que duas notificações
// chegando ao mesmo tempo leiam a mesma lista e uma sobrescreva a outra.
let fila: Promise<void> = Promise.resolve();

function enfileirar(tarefa: () => Promise<void>): Promise<void> {
  const proxima = fila.then(tarefa, tarefa);
  fila = proxima.catch(() => {});
  return proxima;
}

async function ler(): Promise<NotificacaoRegistrada[]> {
  try {
    const bruto = await AsyncStorage.getItem(KEY);
    if (!bruto) return [];
    const lista: unknown = JSON.parse(bruto);
    return Array.isArray(lista) ? (lista as NotificacaoRegistrada[]) : [];
  } catch {
    return [];
  }
}

async function gravar(itens: NotificacaoRegistrada[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(itens));
  } catch {
    // ignora — histórico é local e descartável
  }
}

/**
 * Guarda uma notificação recebida. O `identifier` do sistema, quando existe,
 * vira o id: assim a mesma notificação entregue duas vezes (recebida e depois
 * tocada) não aparece duplicada na lista.
 */
export async function registrarNotificacao(
  n: Omit<NotificacaoRegistrada, "id" | "lida">,
  identifier?: string,
): Promise<void> {
  const id = identifier?.trim() || `${Date.now()}-${++sequencia}`;
  return enfileirar(async () => {
    const itens = await ler();
    if (itens.some((item) => item.id === id)) return;
    const atualizados = [{ ...n, id, lida: false }, ...itens].slice(0, MAX_REGISTROS);
    await gravar(atualizados);
    avisarOuvintes();
  });
}

/** Histórico da mais recente para a mais antiga. */
export async function listarNotificacoes(): Promise<NotificacaoRegistrada[]> {
  return ler();
}

export async function marcarTodasComoLidas(): Promise<void> {
  return enfileirar(async () => {
    const itens = await ler();
    if (!itens.some((item) => !item.lida)) return;
    await gravar(itens.map((item) => ({ ...item, lida: true })));
    avisarOuvintes();
  });
}

export async function limparNotificacoes(): Promise<void> {
  return enfileirar(async () => {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      // ignora — histórico é local e descartável
    }
    avisarOuvintes();
  });
}

/** Estado reativo do histórico, para o sino e para a central. */
export function useNotificacoes() {
  const [itens, setItens] = useState<NotificacaoRegistrada[]>([]);
  // A leitura do AsyncStorage é assíncrona: sem isto a central pintaria "Nenhuma
  // notificação" no primeiro frame e trocaria pela lista logo em seguida.
  const [carregando, setCarregando] = useState(true);
  const montado = useRef(true);

  const recarregar = useCallback(async () => {
    const lista = await listarNotificacoes();
    if (montado.current) {
      setItens(lista);
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    recarregar();
    const cancelar = assinarNotificacoes(() => {
      recarregar();
    });
    return () => {
      montado.current = false;
      cancelar();
    };
  }, [recarregar]);

  const naoLidas = itens.reduce((total, item) => (item.lida ? total : total + 1), 0);

  return {
    itens,
    carregando,
    naoLidas,
    recarregar,
    marcarLidas: marcarTodasComoLidas,
    limpar: limparNotificacoes,
  };
}
