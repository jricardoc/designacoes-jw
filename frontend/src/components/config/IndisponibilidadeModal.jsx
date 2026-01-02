import { useState, useEffect } from 'react';
import { X, Calendar, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function IndisponibilidadeModal({ irmao, onClose }) {
  const { authFetch } = useAuth();
  const [indisponibilidades, setIndisponibilidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novaData, setNovaData] = useState('');
  const [novoMotivo, setNovoMotivo] = useState('');
  const [mes, setMes] = useState('01'); // Janeiro por padrao

  // Array de dias do mes
  const diasDoMes = [];
  for (let i = 1; i <= 31; i++) {
    diasDoMes.push(i.toString().padStart(2, '0'));
  }

  // Carregar indisponibilidades
  const carregar = async () => {
    try {
      const response = await authFetch(`/indisponibilidades/irmao/${irmao.id}`);
      const data = await response.json();
      setIndisponibilidades(data);
    } catch (error) {
      console.error('Erro ao carregar indisponibilidades:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [irmao.id]);

  // Verificar se dia esta marcado
  const isDiaIndisponivel = (dia) => {
    const dataFormatada = `${dia}/${mes}`;
    return indisponibilidades.some(i => i.data === dataFormatada);
  };

  // Toggle dia
  const toggleDia = async (dia) => {
    const dataFormatada = `${dia}/${mes}`;
    const indispExistente = indisponibilidades.find(i => i.data === dataFormatada);

    if (indispExistente) {
      // Remover
      try {
        await authFetch(`/indisponibilidades/${indispExistente.id}`, { method: 'DELETE' });
        setIndisponibilidades(prev => prev.filter(i => i.id !== indispExistente.id));
      } catch (error) {
        console.error('Erro ao remover:', error);
      }
    } else {
      // Adicionar
      try {
        const response = await authFetch('/indisponibilidades', {
          method: 'POST',
          body: JSON.stringify({
            irmaoId: irmao.id,
            data: dataFormatada,
            motivo: 'Compromisso pessoal'
          })
        });
        const nova = await response.json();
        setIndisponibilidades(prev => [...prev, nova]);
      } catch (error) {
        console.error('Erro ao adicionar:', error);
      }
    }
  };

  // Adicionar indisponibilidade manual
  const adicionarManual = async () => {
    if (!novaData) return;

    try {
      const response = await authFetch('/indisponibilidades', {
        method: 'POST',
        body: JSON.stringify({
          irmaoId: irmao.id,
          data: novaData,
          motivo: novoMotivo || 'Compromisso pessoal'
        })
      });
      
      if (response.ok) {
        const nova = await response.json();
        setIndisponibilidades(prev => [...prev, nova]);
        setNovaData('');
        setNovoMotivo('');
      } else {
        const erro = await response.json();
        alert(erro.error || 'Erro ao adicionar');
      }
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  // Remover indisponibilidade
  const remover = async (id) => {
    try {
      await authFetch(`/indisponibilidades/${id}`, { method: 'DELETE' });
      setIndisponibilidades(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Erro ao remover:', error);
    }
  };

  // Limpar todas
  const limparTodas = async () => {
    if (!confirm('Remover todas as indisponibilidades?')) return;
    
    try {
      await authFetch(`/indisponibilidades/irmao/${irmao.id}/clear`, { method: 'DELETE' });
      setIndisponibilidades([]);
    } catch (error) {
      console.error('Erro ao limpar:', error);
    }
  };

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
        borderRadius: '20px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 10
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Calendar size={24} color="#f97316" />
              Agenda de {irmao.nome}
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              Clique nos dias para marcar/desmarcar indisponibilidade
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '10px',
              padding: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <X size={24} color="#64748b" />
          </button>
        </div>

        <div style={{ padding: '1.5rem 2rem' }}>
          {/* Seletor de Mes */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: '500',
              color: '#374151'
            }}>
              Mes
            </label>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '2px solid #e5e7eb',
                fontSize: '1rem',
                width: '200px'
              }}
            >
              <option value="01">Janeiro</option>
              <option value="02">Fevereiro</option>
              <option value="03">Marco</option>
              <option value="04">Abril</option>
              <option value="05">Maio</option>
              <option value="06">Junho</option>
              <option value="07">Julho</option>
              <option value="08">Agosto</option>
              <option value="09">Setembro</option>
              <option value="10">Outubro</option>
              <option value="11">Novembro</option>
              <option value="12">Dezembro</option>
            </select>
          </div>

          {/* Calendario Visual */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '0.5rem'
            }}>
              {/* Dias da semana */}
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <div key={i} style={{
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#64748b',
                  fontSize: '0.8rem',
                  padding: '0.5rem'
                }}>
                  {d}
                </div>
              ))}
              
              {/* Dias do mes */}
              {diasDoMes.map(dia => {
                const indisponivel = isDiaIndisponivel(dia);
                return (
                  <button
                    key={dia}
                    onClick={() => toggleDia(dia)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '8px',
                      border: 'none',
                      background: indisponivel 
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                        : 'white',
                      color: indisponivel ? 'white' : '#374151',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: indisponivel 
                        ? '0 4px 14px -3px rgba(239, 68, 68, 0.4)' 
                        : '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                  >
                    {parseInt(dia)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legenda */}
          <div style={{ 
            display: 'flex', 
            gap: '1.5rem', 
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: 'white',
                border: '1px solid #e5e7eb'
              }} />
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Disponivel</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              }} />
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Indisponivel</span>
            </div>
          </div>

          {/* Lista de Indisponibilidades */}
          <div style={{
            background: '#fef2f2',
            borderRadius: '12px',
            padding: '1rem'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h4 style={{ 
                margin: 0, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                color: '#991b1b'
              }}>
                <AlertCircle size={18} />
                Dias Indisponiveis ({indisponibilidades.length})
              </h4>
              {indisponibilidades.length > 0 && (
                <button
                  onClick={limparTodas}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Limpar Tudo
                </button>
              )}
            </div>

            {indisponibilidades.length === 0 ? (
              <p style={{ color: '#991b1b', margin: 0, fontSize: '0.9rem' }}>
                Nenhuma indisponibilidade marcada
              </p>
            ) : (
              <div style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                flexWrap: 'wrap' 
              }}>
                {indisponibilidades
                  .sort((a, b) => {
                    const [diaA, mesA] = a.data.split('/');
                    const [diaB, mesB] = b.data.split('/');
                    return (parseInt(mesA) * 100 + parseInt(diaA)) - (parseInt(mesB) * 100 + parseInt(diaB));
                  })
                  .map(indisp => (
                  <div
                    key={indisp.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'white',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #fecaca'
                    }}
                  >
                    <span style={{ fontWeight: '500', color: '#dc2626' }}>
                      {indisp.data}
                    </span>
                    {indisp.motivo && (
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        ({indisp.motivo})
                      </span>
                    )}
                    <button
                      onClick={() => remover(indisp.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                    >
                      <X size={14} color="#dc2626" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adicionar Manual */}
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#f8fafc',
            borderRadius: '12px'
          }}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem' }}>
              Adicionar Data Especifica
            </h4>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="DD/MM (ex: 15/02)"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  width: '150px'
                }}
              />
              <input
                type="text"
                placeholder="Motivo (opcional)"
                value={novoMotivo}
                onChange={(e) => setNovoMotivo(e.target.value)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  flex: 1,
                  minWidth: '150px'
                }}
              />
              <button
                onClick={adicionarManual}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  background: '#f97316',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <Plus size={18} />
                Adicionar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
