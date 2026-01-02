import { createContext, useContext, useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));

  // Verificar token ao carregar
  useEffect(() => {
    const verificarToken = async () => {
      const storedToken = localStorage.getItem('auth_token');
      
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUsuario(data);
          setToken(storedToken);
          setIsAuthenticated(true);
        } else {
          // Token invalido, limpar
          localStorage.removeItem('auth_token');
          setToken(null);
        }
      } catch (error) {
        console.error('Erro ao verificar token:', error);
        localStorage.removeItem('auth_token');
        setToken(null);
      }

      setLoading(false);
    };

    verificarToken();
  }, []);

  // Login por nickname
  const login = async (nickname, senha) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nickname, senha })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('auth_token', data.token);
        setToken(data.token);
        setUsuario(data.usuario);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Erro no login:', error);
      return { success: false, error: 'Erro de conexao com o servidor' };
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUsuario(null);
    setIsAuthenticated(false);
  };

  const alterarSenha = async (senhaAtual, novaSenha) => {
    try {
      const response = await fetch(`${API_URL}/auth/senha`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ senhaAtual, novaSenha })
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      return { success: false, error: 'Erro de conexao com o servidor' };
    }
  };

  // Helper para fazer requests autenticados
  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(`${API_URL}${url}`, {
      ...options,
      headers
    });
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      usuario,
      loading,
      token,
      login, 
      logout,
      alterarSenha,
      authFetch
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
