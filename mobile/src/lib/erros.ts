import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";
import { apiRequest } from "@/api/client";
import { tokenStore } from "@/api/tokenStore";

/**
 * Os erros do app (a tela que quebrou, a exceção do JS) vão para o servidor, e o admin vê em
 * Ajustes › Erros do app. Antes ficam guardados no celular: o erro fatal fecha o app antes de
 * qualquer envio, e sem login não há para onde mandar. Sobem na próxima vez que der.
 */
const CHAVE = "erros-app";
/** Tetos do que fica guardado e do que se registra por abertura: um erro em laço não enche nada. */
const MAX_GUARDADOS = 20;
const MAX_POR_ABERTURA = 10;

let tela: string | null = null;
let nestaAbertura = 0;
const vistos = new Set<string>();
let enviando = false;

/** A rota aberta, que vai junto com o erro (o AuthGate atualiza). */
export const definirTelaDoErro = (t: string) => {
  tela = t;
};

const lerGuardados = async (): Promise<object[]> => JSON.parse((await AsyncStorage.getItem(CHAVE)) ?? "[]");

export async function registrarErro(erro: unknown, fatal = false): Promise<void> {
  if (__DEV__) return;
  const e = erro instanceof Error ? erro : new Error(String(erro));
  const mensagem = e.message.startsWith(e.name) ? e.message : `${e.name}: ${e.message}`;
  const chave = `${mensagem}|${tela}`;
  if (vistos.has(chave) || nestaAbertura >= MAX_POR_ABERTURA) return;
  vistos.add(chave);
  nestaAbertura += 1;
  const novo = {
    mensagem: mensagem.slice(0, 500),
    pilha: e.stack?.slice(0, 4000) ?? null,
    tela,
    fatal,
    plataforma: Platform.OS,
    versaoApp: Constants.expoConfig?.version ?? null,
    updateId: Updates.updateId ?? null,
    canal: Updates.channel ?? null,
  };
  try {
    await AsyncStorage.setItem(CHAVE, JSON.stringify([...(await lerGuardados()), novo].slice(-MAX_GUARDADOS)));
  } catch {
    // Sem onde guardar, o erro se perde; o app segue.
  }
  if (!fatal) enviarErros();
}

/** Manda o que ficou guardado. Chamado ao entrar logado e depois de cada erro não fatal. */
export async function enviarErros() {
  if (enviando) return;
  enviando = true;
  try {
    if (!(await tokenStore.get())) return;
    const erros = await lerGuardados();
    if (!erros.length) return;
    await apiRequest("/erros-app", { method: "POST", body: { erros }, timeoutMs: 15000 });
    // Tira só o que foi: o que entrou durante o envio fica para a próxima.
    await AsyncStorage.setItem(CHAVE, JSON.stringify((await lerGuardados()).slice(erros.length)));
  } catch {
    // Sem rede ou servidor fora do ar: fica guardado.
  } finally {
    enviando = false;
  }
}

/** Liga a captura das exceções do JS. Uma vez, quando o app carrega. */
export function ligarRegistroDeErros() {
  const anterior = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((erro, fatal) => {
    if (!fatal) {
      registrarErro(erro);
      anterior(erro, fatal);
      return;
    }
    // O fatal fecha o app: espera o erro chegar ao disco (até 1 s) e só então segue.
    Promise.race([registrarErro(erro, true), new Promise((r) => setTimeout(r, 1000))]).finally(() => anterior(erro, fatal));
  });
}
