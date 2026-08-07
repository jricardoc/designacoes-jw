import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "notif_historico";

/**
 * Momento do último "Limpar tudo". Sem esta marca a sincronização com o servidor
 * ressuscitaria tudo o que o irmão acabou de apagar — o servidor continua com a
 * cópia, e limpar é uma decisão do aparelho.
 */
const KEY_LIMPO_ATE = "notif_limpo_ate";

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

/** Uma linha de GET /push/historico — a cópia servidor de um push enviado. */
export interface NotificacaoRemota {
  id: number;
  titulo: string;
  corpo: string;
  data?: Record<string, unknown> | null;
  enviadaEm: string;
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
 * O id que o backend embutiu no payload (`data.notifId`) — é a ponte entre o
 * registro local (capturado do push) e a cópia do servidor.
 */
function notifIdDe(data?: Record<string, unknown> | null): string | null {
  const v = data?.notifId;
  return typeof v === "number" || typeof v === "string" ? String(v) : null;
}

/**
 * Guarda uma notificação recebida. O `identifier` do sistema, quando existe,
 * vira o id: assim a mesma notificação entregue duas vezes (recebida e depois
 * tocada) não aparece duplicada na lista. O `notifId` do payload desduplica
 * contra a cópia do servidor, que chega por outro caminho.
 */
export async function registrarNotificacao(
  n: Omit<NotificacaoRegistrada, "id" | "lida">,
  identifier?: string,
): Promise<void> {
  const id = identifier?.trim() || `${Date.now()}-${++sequencia}`;
  return enfileirar(async () => {
    // Mesmo guarda da sincronização remota: a varredura da bandeja não pode
    // ressuscitar (como NÃO lida!) uma notificação que o irmão acabou de limpar.
    try {
      const limpoAte = await AsyncStorage.getItem(KEY_LIMPO_ATE);
      if (limpoAte && n.recebidaEm <= limpoAte) return;
    } catch {
      // sem a marca, registra normalmente
    }
    const itens = await ler();
    if (itens.some((item) => item.id === id)) return;
    const notifId = notifIdDe(n.data);
    if (notifId && itens.some((item) => notifIdDe(item.data) === notifId)) return;
    const atualizados = [{ ...n, id, lida: false }, ...itens].slice(0, MAX_REGISTROS);
    await gravar(atualizados);
    avisarOuvintes();
  });
}

/**
 * Chave frouxa para pushes de backend antigo, enviados sem `notifId`: mesmo
 * título e corpo no mesmo dia é o mesmo aviso. Melhor engolir um duplicado
 * legítimo raríssimo do que mostrar cada lembrete duas vezes.
 */
function chaveFrouxa(titulo: string, corpo: string, quando: string): string {
  return `${titulo}|${corpo}|${quando.slice(0, 10)}`;
}

/**
 * Junta a cópia do servidor ao histórico local. Itens que o aparelho não
 * capturou entram JÁ LIDOS: o servidor não sabe se o irmão viu o push, e acender
 * o sino para avisos antigos na primeira sincronização seria alarme falso — o
 * não-lido continua sendo só o que o aparelho capturou de fato.
 */
export async function sincronizarRemotas(
  remotas: NotificacaoRemota[],
): Promise<void> {
  return enfileirar(async () => {
    let limpoAte: string | null = null;
    try {
      limpoAte = await AsyncStorage.getItem(KEY_LIMPO_ATE);
    } catch {
      // sem a marca, sincroniza tudo
    }

    const itens = await ler();
    const idsLocais = new Set(itens.map((i) => i.id));
    const notifIds = new Set(
      itens.map((i) => notifIdDe(i.data)).filter((v): v is string => !!v),
    );
    const chaves = new Set(
      itens.map((i) => chaveFrouxa(i.titulo, i.corpo, i.recebidaEm)),
    );

    const novas: NotificacaoRegistrada[] = [];
    for (const r of remotas) {
      if (limpoAte && r.enviadaEm <= limpoAte) continue; // apagado de propósito
      const id = `srv-${r.id}`;
      if (idsLocais.has(id) || notifIds.has(String(r.id))) continue;
      if (chaves.has(chaveFrouxa(r.titulo, r.corpo ?? "", r.enviadaEm))) continue;
      novas.push({
        id,
        titulo: r.titulo,
        corpo: r.corpo ?? "",
        recebidaEm: r.enviadaEm,
        lida: true,
        data: { ...(r.data ?? {}), notifId: r.id },
      });
    }
    if (novas.length === 0) return;

    const atualizados = [...novas, ...itens]
      .sort((a, b) => (a.recebidaEm < b.recebidaEm ? 1 : -1))
      .slice(0, MAX_REGISTROS);
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
      // A marca impede a sincronização de trazer de volta o que foi apagado.
      await AsyncStorage.setItem(KEY_LIMPO_ATE, new Date().toISOString());
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
