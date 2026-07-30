import { useState } from 'react';
import { X, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { REGRAS_PADRAO, REGRAS_ESSENCIAIS } from '../../../pages/Dirigentes/regras';

/**
 * Refaz o preenchimento automatico de uma escala ja criada.
 * Preserva os dias que o usuario removeu; sobrescreve o dirigente de todo o resto.
 */
export default function RegerarEscalaModal({ isOpen, quadroId, onClose, onConcluido }) {
  const { authFetch } = useAuth();
  const [regras, setRegras] = useState(REGRAS_PADRAO);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  if (!isOpen) return null;

  const toggleRegra = (chave) => setRegras((prev) => ({ ...prev, [chave]: !prev[chave] }));

  const handleRegerar = async () => {
    setErro('');
    setLoading(true);
    try {
      const response = await authFetch(`/dirigentes/quadros/${quadroId}/regerar`, {
        method: 'POST',
        body: JSON.stringify({ regras }),
      });
      const data = await response.json();
      if (response.ok) {
        onConcluido?.(data.diagnostico);
      } else {
        setErro(data.error || 'Erro ao regerar a escala');
      }
    } catch {
      setErro('Erro de conexão');
    }
    setLoading(false);
  };

  const Regra = ({ chave, label, desc }) => (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.7rem',
        cursor: 'pointer',
        borderRadius: '8px',
        marginBottom: '0.45rem',
        background: regras[chave] ? '#E9EFDC' : 'white',
      }}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          border: regras[chave] ? '2px solid #5E6B48' : '2px solid #DCD0B9',
          background: regras[chave] ? '#5E6B48' : 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '2px',
        }}
      >
        {regras[chave] && <Check size={14} color="white" />}
      </div>
      <input
        type="checkbox"
        checked={regras[chave]}
        onChange={() => toggleRegra(chave)}
        style={{ display: 'none' }}
      />
      <div>
        <div style={{ fontWeight: 500, color: '#2B2620' }}>{label}</div>
        <div style={{ fontSize: '0.8rem', color: '#8A8071', lineHeight: 1.4 }}>{desc}</div>
      </div>
    </label>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#FBF7EF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #E6DCC9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#2B2620' }}>
            Regerar Escala
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
          >
            <X size={20} color="#8A8071" />
          </button>
        </div>

        <div style={{ padding: '1.25rem 1.5rem', overflow: 'auto' }}>
          <div
            style={{
              background: '#F1E1D2',
              color: '#92400e',
              borderRadius: '10px',
              padding: '0.75rem',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              lineHeight: 1.45,
            }}
          >
            Isso substitui o dirigente de todas as saídas desta escala. Os dias
            que você removeu continuam removidos.
          </div>

          {REGRAS_ESSENCIAIS.map((r) => (
            <Regra key={r.chave} chave={r.chave} label={r.label} desc={r.desc} />
          ))}

          {erro && (
            <div
              style={{
                padding: '0.75rem',
                background: '#F6E7E0',
                borderRadius: '8px',
                marginTop: '1rem',
                color: '#9A4632',
                fontSize: '0.9rem',
              }}
            >
              {erro}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid #E6DCC9' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '0.85rem',
              borderRadius: '10px',
              border: '1px solid #DCD0B9',
              background: '#FBF7EF',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#3A352D',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleRegerar}
            disabled={loading}
            style={{
              flex: 1.3,
              padding: '0.85rem',
              borderRadius: '10px',
              border: 'none',
              background: loading ? '#DCD0B9' : 'linear-gradient(135deg, #6E7B57 0%, #566239 100%)',
              color: 'white',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <RefreshCw size={17} />
            {loading ? 'Gerando...' : 'Regerar'}
          </button>
        </div>
      </div>
    </div>
  );
}
