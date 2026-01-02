import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [nickname, setNickname] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const resultado = await login(nickname, senha);

    if (resultado.success) {
      navigate('/designacoes');
    } else {
      setErro(resultado.error || 'Erro ao fazer login');
    }

    setCarregando(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #0a1929 100%)',
      padding: '1rem'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '24px',
        padding: '3rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Logo/Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)'
          }}>
            <Lock size={36} color="white" />
          </div>
          <h1 style={{ 
            fontSize: '1.75rem', 
            fontWeight: '700', 
            color: '#1e293b',
            marginBottom: '0.5rem'
          }}>
            Quadro de Designações
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Acesse sua conta para continuar
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          {/* Campo Nickname */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem',
              fontWeight: '500',
              color: '#374151',
              fontSize: '0.9rem'
            }}>
              Nickname
            </label>
            <div style={{ position: 'relative' }}>
              <User 
                size={20} 
                color="#9ca3af" 
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="admin"
                required
                autoComplete="username"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem 0.875rem 2.75rem',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  fontSize: '1rem',
                  transition: 'all 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
          </div>

          {/* Campo Senha */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem',
              fontWeight: '500',
              color: '#374151',
              fontSize: '0.9rem'
            }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={20} 
                color="#9ca3af" 
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '0.875rem 3rem 0.875rem 2.75rem',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  fontSize: '1rem',
                  transition: 'all 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {mostrarSenha ? <EyeOff size={20} color="#9ca3af" /> : <Eye size={20} color="#9ca3af" />}
              </button>
            </div>
          </div>

          {/* Mensagem de Erro */}
          {erro && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.875rem',
              background: '#fef2f2',
              borderRadius: '10px',
              marginBottom: '1.25rem',
              border: '1px solid #fecaca'
            }}>
              <AlertCircle size={20} color="#ef4444" />
              <span style={{ color: '#dc2626', fontSize: '0.9rem' }}>{erro}</span>
            </div>
          )}

          {/* Botao de Login */}
          <button
            type="submit"
            disabled={carregando}
            style={{
              width: '100%',
              padding: '1rem',
              background: carregando 
                ? '#94a3b8' 
                : 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: carregando ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: carregando ? 'none' : '0 4px 14px -3px rgba(59, 130, 246, 0.5)'
            }}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Footer */}
        <p style={{ 
          textAlign: 'center', 
          marginTop: '2rem',
          color: '#94a3b8',
          fontSize: '0.85rem'
        }}>
          Congregação Norte de Itapuã
        </p>
      </div>
    </div>
  );
}
