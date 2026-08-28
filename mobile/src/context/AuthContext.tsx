import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";
import { ApiError, apiRequest } from "@/api/client";
import { removerPushToken } from "@/api/hooks/usePush";
import { tokenStore } from "@/api/tokenStore";
import type { LoginResponse, Usuario } from "@/api/types";
import { queryClient } from "@/lib/queryClient";
import {
  lerPushTokenAtual,
  setPushTokenAtual,
} from "@/notifications/tokenAtual";

interface AuthContextValue {
  usuario: Usuario | null;
  isAuthenticated: boolean;
  initializing: boolean;
  login: (
    nickname: string,
    senha: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUsuario: () => Promise<void>;
  setUsuario: (u: Usuario) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuarioState] = useState<Usuario | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Validate any persisted token on boot.
  useEffect(() => {
    (async () => {
      const token = await tokenStore.get();
      if (!token) {
        setInitializing(false);
        return;
      }
      try {
        // COM teto de tempo. Sem ele, um backend no ar mas sem responder (é o que
        // acontece nos segundos de um redeploy) deixa esta chamada pendurada para
        // sempre — e como `initializing` só cai no `finally`, o app fica na tela
        // "Carregando..." indefinidamente, sem nem chegar na tela de login.
        const me = await apiRequest<Usuario>("/auth/me", { timeoutMs: 8000 });
        setUsuarioState(me);
      } catch (erro) {
        // Só apaga o token quando o SERVIDOR o recusou. Antes qualquer erro apagava,
        // incluindo "sem conexão" (status 0): um soluço de rede — ou um redeploy —
        // deslogava o irmão, que tinha de digitar a senha de novo sem nada de errado
        // com a sessão dele.
        if (erro instanceof ApiError && (erro.status === 401 || erro.status === 403)) {
          await tokenStore.clear();
        }
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const login = useCallback(async (nickname: string, senha: string) => {
    try {
      const data = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: { nickname, senha },
        skipAuth: true,
      });
      await tokenStore.set(data.token);
      setUsuarioState(data.usuario);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "Erro ao fazer login",
      };
    }
  }, []);

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
      await tokenStore.clear();
      // Descarta o cache do usuário que saiu: sem isto, quem logasse em seguida
      // no mesmo aparelho herdaria dados pessoais dele (notificações remotas,
      // minhas designações) até cada query revalidar.
      queryClient.clear();
      setUsuarioState(null);
    }
  }, []);

  const refreshUsuario = useCallback(async () => {
    try {
      const me = await apiRequest<Usuario>("/auth/me");
      setUsuarioState(me);
    } catch {
      // ignore
    }
  }, []);

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
      setUsuario: setUsuarioState,
    }),
    [usuario, initializing, login, logout, refreshUsuario],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
