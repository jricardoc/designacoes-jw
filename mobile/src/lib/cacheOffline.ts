import AsyncStorage from "@react-native-async-storage/async-storage";
import { dehydrate, hydrate, type Query } from "@tanstack/react-query";
import * as Updates from "expo-updates";
import { queryClient } from "./queryClient";

/**
 * O último painel do pioneiro, os contatos dele e o estudo pessoal ficam guardados no celular:
 * aberto sem internet, o app mostra o que viu por último (e o cronômetro, os contatos novos e as
 * visitas andam com a fila). Os territórios têm a cópia própria (src/territorios).
 *
 * É de quem está logado (o AuthContext liga e desliga) e só vale para o mesmo código do app:
 * depois de uma atualização o formato pode ter mudado, e ele recomeça vazio.
 */
const CHAVE = "cache-offline";

/** O código do app que está rodando: o que foi guardado por outro não serve. */
export const VERSAO = Updates.updateId ?? "embutido";

const DO_PIONEIRO = new Set(["painel", "revisitas", "revisita"]);
const guardar = (q: Query) =>
  q.state.status === "success" && (q.queryKey[0] === "estudo" || (q.queryKey[0] === "pioneiro" && DO_PIONEIRO.has(String(q.queryKey[1]))));

let dono: number | null = null;
let assinado = false;
let espera: ReturnType<typeof setTimeout> | undefined;

/** Restaura o que esta pessoa deixou guardado e passa a guardar cada mudança. */
export function iniciarCacheOffline(usuarioId: number) {
  dono = usuarioId;
  AsyncStorage.getItem(CHAVE)
    .then((bruto) => {
      const salvo = bruto ? JSON.parse(bruto) : null;
      // `hydrate` não passa por cima do que já chegou da rede (só do que é mais antigo).
      if (salvo?.versao === VERSAO && salvo.usuarioId === usuarioId && dono === usuarioId) hydrate(queryClient, salvo.estado);
    })
    .catch(() => {});
  if (assinado) return;
  assinado = true;
  queryClient.getQueryCache().subscribe((evento) => {
    if (dono === null || evento.type !== "updated" || !guardar(evento.query)) return;
    clearTimeout(espera);
    espera = setTimeout(() => {
      if (dono === null) return;
      const estado = dehydrate(queryClient, { shouldDehydrateQuery: guardar });
      AsyncStorage.setItem(CHAVE, JSON.stringify({ versao: VERSAO, usuarioId: dono, estado })).catch(() => {});
    }, 1500);
  });
}

/** Ao sair da conta (ou a sessão cair): nada do que era dela fica no celular. */
export function limparCacheOffline() {
  dono = null;
  clearTimeout(espera);
  AsyncStorage.removeItem(CHAVE).catch(() => {});
}
