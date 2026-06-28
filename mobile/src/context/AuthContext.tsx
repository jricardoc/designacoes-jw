import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest } from "@/api/client";
import { tokenStore } from "@/api/tokenStore";
import type { LoginResponse, Usuario } from "@/api/types";

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
        const me = await apiRequest<Usuario>("/auth/me");
        setUsuarioState(me);
      } catch {
        await tokenStore.clear();
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
    await tokenStore.clear();
    setUsuarioState(null);
  }, []);

  const refreshUsuario = useCallback(async () => {
    try {
      const me = await apiRequest<Usuario>("/auth/me");
      setUsuarioState(me);
    } catch {
      // ignore
    }
  }, []);

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
