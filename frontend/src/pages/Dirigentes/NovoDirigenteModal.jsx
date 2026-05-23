import { useState } from 'react';
import { X, Wand2, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' }
];

export default function NovoDirigenteModal({ isOpen, onClose, onSuccess, quadrosExistentes = [] }) {
  const { authFetch } = useAuth();
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [autoPreenchimento, setAutoPreenchimento] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Verificar se mes/ano ja existe
  const jaExiste = quadrosExistentes.some(q => q.mes === mes && q.ano === ano);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');

    if (jaExiste) {
      setErro('Já existe uma escala para esse mês/ano');
      return;
    }

    setLoading(true);

    try {
      const response = await authFetch('/dirigentes/quadros', {
        method: 'POST',
        body: JSON.stringify({
          mes,
          ano,
          autoPreenchimento
        })
      });

      if (response.ok) {
        onSuccess?.();
      } else {
        const data = await response.json();
        setErro(data.error || 'Erro ao criar escala');
      }
    } catch (error) {
      console.error('Erro:', error);
      setErro('Erro de conexão ao criar escala');
    }

    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#1e293b' }}>
            Nova Escala de Dirigentes
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '8px'
            }}
          >
            <X size={20} color="#64748b" />
          </button>
        </div>

        {/* Conteúdo */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Mes e Ano */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                Mês
              </label>
              <select
                value={mes}
                onChange={(e) => setMes(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '1rem'
                }}
              >
                {MESES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                Ano
              </label>
              <input
                type="number"
                value={ano}
                onChange={(e) => setAno(parseInt(e.target.value))}
                min={2024}
                max={2030}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '1rem'
                }}
              />
            </div>
          </div>

          {jaExiste && (
            <div style={{
              padding: '0.75rem',
              background: '#fef3c7',
              borderRadius: '8px',
              marginBottom: '1rem',
              color: '#92400e',
              fontSize: '0.9rem'
            }}>
              ⚠️ Já existe uma escala para esse mês/ano
            </div>
          )}

          {/* Toggle Auto-preenchimento */}
          <div style={{
            padding: '1rem',
            background: autoPreenchimento ? '#f0fdf4' : '#f8fafc',
            borderRadius: '12px',
            marginBottom: '1.5rem'
          }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem',
              cursor: 'pointer'
            }}>
              <div style={{
                width: '48px',
                height: '28px',
                borderRadius: '14px',
                background: autoPreenchimento ? '#10b981' : '#d1d5db',
                position: 'relative',
                transition: 'background 0.2s'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '12px',
                  background: 'white',
                  position: 'absolute',
                  top: '2px',
                  left: autoPreenchimento ? '22px' : '2px',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }} />
              </div>
              <input
                type="checkbox"
                checked={autoPreenchimento}
                onChange={(e) => setAutoPreenchimento(e.target.checked)}
                style={{ display: 'none' }}
              />
              <div>
                <div style={{ fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wand2 size={18} color={autoPreenchimento ? '#10b981' : '#64748b'} />
                  Preenchimento Automático
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Distribui os dirigentes automaticamente considerando disponibilidade
                </div>
              </div>
            </label>
          </div>

          {erro && (
            <div style={{
              padding: '0.75rem',
              background: '#fee2e2',
              borderRadius: '8px',
              marginBottom: '1rem',
              color: '#dc2626',
              fontSize: '0.9rem'
            }}>
              {erro}
            </div>
          )}

          {/* Botoes */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.875rem',
                borderRadius: '10px',
                border: '1px solid #d1d5db',
                background: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                color: '#374151'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || jaExiste}
              style={{
                flex: 1,
                padding: '0.875rem',
                borderRadius: '10px',
                border: 'none',
                background: loading || jaExiste ? '#d1d5db' : 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: 'white',
                fontWeight: '600',
                cursor: loading || jaExiste ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Criando...' : 'Criar Escala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
