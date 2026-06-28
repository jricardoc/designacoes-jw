import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { LogoMark } from '../../components/Logo';

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
      background: 'linear-gradient(135deg, #3A382C 0%, #29281D 50%, #1E1D14 100%)',
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
            margin: '0 auto 1.25rem',
            width: '84px',
            height: '84px',
            borderRadius: '22px',
            boxShadow: '0 12px 26px -6px rgba(64, 73, 48, 0.5)'
          }}>
            <LogoMark size={84} radius={22} />
          </div>
          <h1 style={{
            fontSize: '1.9rem',
            fontWeight: '700',
            color: '#2B2620',
            marginBottom: '0.4rem',
            letterSpacing: '-0.02em'
          }}>
            Servir Mais
          </h1>
          <p style={{ color: '#8A8071', fontSize: '0.95rem' }}>
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
              color: '#3A352D',
              fontSize: '0.9rem'
            }}>
              Nickname
            </label>
            <div style={{ position: 'relative' }}>
              <User 
                size={20} 
                color="#A2977F" 
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
                  border: '2px solid #E6DCC9',
                  fontSize: '1rem',
                  transition: 'all 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6E7B57'}
                onBlur={(e) => e.target.style.borderColor = '#E6DCC9'}
              />
            </div>
          </div>

          {/* Campo Senha */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem',
              fontWeight: '500',
              color: '#3A352D',
              fontSize: '0.9rem'
            }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={20} 
                color="#A2977F" 
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
                  border: '2px solid #E6DCC9',
                  fontSize: '1rem',
                  transition: 'all 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6E7B57'}
                onBlur={(e) => e.target.style.borderColor = '#E6DCC9'}
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
                {mostrarSenha ? <EyeOff size={20} color="#A2977F" /> : <Eye size={20} color="#A2977F" />}
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
              background: '#F8EDE8',
              borderRadius: '10px',
              marginBottom: '1.25rem',
              border: '1px solid #F0DED3'
            }}>
              <AlertCircle size={20} color="#A8503B" />
              <span style={{ color: '#9A4632', fontSize: '0.9rem' }}>{erro}</span>
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
                ? '#A2977F' 
                : 'linear-gradient(135deg, #6E7B57 0%, #566239 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: carregando ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: carregando ? 'none' : '0 4px 14px -3px rgba(94, 107, 72, 0.5)'
            }}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Footer */}
        <p style={{ 
          textAlign: 'center', 
          marginTop: '2rem',
          color: '#A2977F',
          fontSize: '0.85rem'
        }}>
          Congregação Norte de Itapuã
        </p>
      </div>
    </div>
  );
}
