import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "push_token_atual";

/**
 * Último Expo Push Token obtido neste ciclo de vida do app.
 *
 * Vive num módulo, e não no estado do hook, porque o logout e o switch de
 * Configurações acontecem longe da árvore de notificações e precisam saber qual
 * token remover do backend enquanto ainda há token de autenticação para assinar
 * a chamada.
 */
let tokenAtual: string | null = null;

/** Leitura síncrona: só enxerga o que já foi obtido/hidratado neste boot. */
export function getPushTokenAtual(): string | null {
  return tokenAtual;
}

/**
 * Espelhado no AsyncStorage porque a memória do módulo zera a cada boot: sem
 * isso, desligar as notificações (ou sair) antes de o hook registrar de novo
 * deixaria o token órfão no banco, continuando a receber o lembrete das 19h.
 */
export async function lerPushTokenAtual(): Promise<string | null> {
  if (tokenAtual) return tokenAtual;
  try {
    tokenAtual = await AsyncStorage.getItem(KEY);
  } catch {
    // storage indisponível — resta o que houver em memória
  }
  return tokenAtual;
}

export function setPushTokenAtual(token: string | null): void {
  tokenAtual = token;
  const escrita = token
    ? AsyncStorage.setItem(KEY, token)
    : AsyncStorage.removeItem(KEY);
  escrita.catch(() => {
    // preferência local; falhar em persistir não pode derrubar nada
  });
}
