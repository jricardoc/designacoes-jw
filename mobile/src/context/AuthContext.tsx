import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { ApiError, apiRequest } from "@/api/client";
import { removerPushToken } from "@/api/hooks/usePush";
import { tokenStore } from "@/api/tokenStore";
import type { LoginResponse, Usuario } from "@/api/types";
import { iniciarCacheOffline, limparCacheOffline, VERSAO } from "@/lib/cacheOffline";
import { queryClient } from "@/lib/queryClient";
import { registrarDesbloqueio } from "@/utils/biometria";
import {
  lerPushTokenAtual,
  setPushTokenAtual,
} from "@/notifications/tokenAtual";
import { definirDonoDaFila } from "@/territorios/fila";

interface AuthContextValue {
  usuario: Usuario | null;
  isAuthenticated: boolean;
  initializing: boolean;
  login: (
    nickname: string,
    senha: string,
  ) => Promise<{ success: boolean; error?: string; status?: number }>;
  logout: () => Promise<void>;
  refreshUsuario: () => Promise<void>;
  setUsuario: (u: Usuario) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * O último usuário que o servidor confirmou, guardado no celular: o app abre com ele sem esperar
 * a rede (no campo, sem sinal, abria na tela de login). O servidor continua conferindo cada
 * chamada, e o /auth/me confirma por trás.
 */
const CHAVE_USUARIO = "usuario-offline";

async function lerUsuarioSalvo(): Promise<{ versao: string; usuario: Usuario } | null> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_USUARIO);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuarioState] = useState<Usuario | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Todo usuário confirmado pelo servidor fica guardado, para a próxima abertura.
  const setUsuario = useCallback((u: Usuario | null) => {
    setUsuarioState(u);
    (u ? AsyncStorage.setItem(CHAVE_USUARIO, JSON.stringify({ versao: VERSAO, usuario: u })) : AsyncStorage.removeItem(CHAVE_USUARIO)).catch(
      () => {},
    );
  }, []);

  /** Fecha a sessão neste celular: o token, o usuário guardado e o cache de quem saiu. */
  const encerrarSessao = useCallback(async () => {
    await tokenStore.clear();
    // Descarta o cache do usuário que saiu: sem isto, quem logasse em seguida
    // no mesmo aparelho herdaria dados pessoais dele (notificações remotas,
    // minhas designações) até cada query revalidar.
    queryClient.clear();
    limparCacheOffline();
    setUsuario(null);
  }, [setUsuario]);

  // Validate any persisted token on boot.
  useEffect(() => {
    (async () => {
      const token = await tokenStore.get();
      if (!token) {
        setInitializing(false);
        return;
      }
      // Com o usuário guardado pelo mesmo código do app, abre na hora e confirma por trás (de
      // outra versão, o formato pode ter mudado: só serve se não houver rede).
      const salvo = await lerUsuarioSalvo();
      if (salvo?.versao === VERSAO) {
        setUsuarioState(salvo.usuario);
        setInitializing(false);
      }
      try {
        // COM teto de tempo. Sem ele, um backend no ar mas sem responder (é o que
        // acontece nos segundos de um redeploy) deixa esta chamada pendurada para
        // sempre — e como `initializing` só cai no `finally`, o app fica na tela
        // "Carregando..." indefinidamente, sem nem chegar na tela de login.
        const me = await apiRequest<Usuario>("/auth/me", { timeoutMs: 8000 });
        setUsuario(me);
      } catch (erro) {
        // Só encerra a sessão quando o SERVIDOR recusou o token. Antes qualquer erro
        // apagava, incluindo "sem conexão" (status 0): um soluço de rede — ou um
        // redeploy — deslogava o irmão, que tinha de digitar a senha de novo sem nada
        // de errado com a sessão dele. Sem rede, segue com o usuário guardado.
        if (erro instanceof ApiError && (erro.status === 401 || erro.status === 403)) {
          await encerrarSessao();
        } else if (salvo) {
          setUsuarioState((atual) => atual ?? salvo.usuario);
        }
      } finally {
        setInitializing(false);
      }
    })();
  }, [encerrarSessao, setUsuario]);

  // O que fica no celular para abrir e registrar sem internet (a fila e o cache) é de quem
  // está logado.
  const idUsuario = usuario?.id ?? null;
  useEffect(() => {
    definirDonoDaFila(idUsuario);
    if (idUsuario !== null) iniciarCacheOffline(idUsuario);
  }, [idUsuario]);

  const login = useCallback(async (nickname: string, senha: string) => {
    try {
      const data = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: { nickname, senha },
        skipAuth: true,
      });
      await tokenStore.set(data.token);
      registrarDesbloqueio();
      setUsuario(data.usuario);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "Erro ao fazer login",
        // 401 = a senha não confere. A tela de login usa para desligar a biometria, que
        // guardou uma senha que já não vale.
        status: err instanceof ApiError ? err.status : undefined,
      };
    }
  }, [setUsuario]);

  const logout = useCallback(async () => {
    try {
      // Antes de limpar o token de auth: depois disso a chamada não teria como se
      // autenticar e o aparelho continuaria recebendo os lembretes deste usuário.
      const pushToken = await lerPushTokenAtual();
      if (pushToken) {
        // Com teto de tempo: no Android o fetch do React Native não tem timeout
        // algum, então um backend no ar mas sem responder (container travado,
        // portal cativo do Wi-Fi) deixaria o botão "Sair" morto para sempre.
        await Promise.race([
          removerPushToken(pushToken).catch(() => {}),
          new Promise<void>((resolve) => setTimeout(resolve, 3000)),
        ]);
        setPushTokenAtual(null);
      }
    } catch {
      // Sair é mais importante do que descadastrar o aparelho.
    } finally {
      await encerrarSessao();
    }
  }, [encerrarSessao]);

  const refreshUsuario = useCallback(async () => {
    try {
      const me = await apiRequest<Usuario>("/auth/me");
      setUsuario(me);
    } catch (erro) {
      // O servidor recusou a sessão (venceu ou foi revogada), o que pode aparecer depois de
      // abrir sem internet com o usuário guardado: volta para o login. Sem rede, segue.
      if (erro instanceof ApiError && (erro.status === 401 || erro.status === 403)) await encerrarSessao();
    }
  }, [setUsuario, encerrarSessao]);

  /**
   * Relê o usuário ao voltar ao primeiro plano.
   *
   * O backend revalida a permissão a cada requisição, mas o APP só sabia dela
   * no login: quem recebia uma área nova continuava sem os botões até reiniciar
   * o app, e quem tinha uma área revogada continuava vendo botões que já davam
   * 403. Uma leitura de /auth/me na volta resolve os dois casos.
   */
  useEffect(() => {
    if (!usuario) return undefined;
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") refreshUsuario();
    });
    return () => sub.remove();
  }, [usuario, refreshUsuario]);

  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      isAuthenticated: !!usuario,
      initializing,
      login,
      logout,
      refreshUsuario,
      setUsuario,
    }),
    [usuario, initializing, login, logout, refreshUsuario, setUsuario],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
