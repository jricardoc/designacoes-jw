/**
 * Último Expo Push Token obtido neste ciclo de vida do app.
 *
 * Vive num módulo, e não no estado do hook, porque o logout acontece longe da
 * árvore de notificações e precisa saber qual token remover do backend enquanto
 * ainda há token de autenticação para assinar a chamada.
 */
let tokenAtual: string | null = null;

export function getPushTokenAtual(): string | null {
  return tokenAtual;
}

export function setPushTokenAtual(token: string | null): void {
  tokenAtual = token;
}
