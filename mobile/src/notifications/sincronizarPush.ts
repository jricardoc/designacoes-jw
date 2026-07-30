import { Platform } from "react-native";
import { registrarPushToken, removerPushToken } from "@/api/hooks/usePush";
import { registerForPushNotificationsAsync } from "./push";
import {
  getPushTokenAtual,
  lerPushTokenAtual,
  setPushTokenAtual,
} from "./tokenAtual";

/**
 * Reconcilia o cadastro do aparelho no backend com a preferência do irmão.
 *
 * Único lugar que registra/remove o token: o lembrete das 19h sai da tabela
 * PushToken, então desligar o switch sem apagar a linha faria o switch mentir —
 * o push continuaria chegando. Falha de rede nunca propaga: a preferência local
 * é a fonte da verdade e a próxima montagem reconcilia.
 */
export async function sincronizarPushToken(
  ativado: boolean,
): Promise<string | null> {
  if (!ativado) {
    const token = await lerPushTokenAtual();
    if (!token) return null;
    try {
      await removerPushToken(token);
    } catch (err) {
      console.warn("Falha ao remover o push token:", err);
    }
    setPushTokenAtual(null);
    return null;
  }

  const token = await registerForPushNotificationsAsync();
  if (!token) return null;
  console.log("Expo Push Token:", token);

  // O backend faz upsert por token, mas não há motivo de reenviar o mesmo token
  // a cada remontagem das abas. A comparação é com o valor em memória (nulo a
  // cada boot) de propósito: assim um cadastro que falhou por rede é refeito na
  // próxima abertura do app.
  if (getPushTokenAtual() === token) return token;
  setPushTokenAtual(token);
  try {
    await registrarPushToken(token, Platform.OS);
  } catch (err) {
    // Silencioso: quem acabou de logar não pode ser punido por uma falha de rede
    // num cadastro que é reenviado no próximo boot.
    console.warn("Falha ao registrar o push token:", err);
  }
  return token;
}
