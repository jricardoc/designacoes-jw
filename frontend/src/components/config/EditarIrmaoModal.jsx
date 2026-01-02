import { useState, useEffect } from 'react';
import { X, User, Check, Trash2, Calendar, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const FUNCOES = [
  { id: 'microfone', label: 'Microfone', color: '#3b82f6' },
  { id: 'indicador', label: 'Indicador', color: '#10b981' },
  { id: 'audioVideo', label: 'Áudio e Vídeo', color: '#8b5cf6' }
];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function EditarIrmaoModal({ irmao, onClose }) {
  const { authFetch } = useAuth();
  const [nome, setNome] = useState(irmao?.nome || '');
  const [funcoes, setFuncoes] = useState(irmao?.funcoes || []);
  const [ativo, setAtivo] = useState(irmao?.ativo ?? true);
  const [indisponibilidades, setIndisponibilidades] = useState([]);
  const [salvando, setSalvando] = useState(false);
  
  // Estado do calendario
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  // Carregar indisponibilidades se editando
  useEffect(() => {
    if (irmao?.id) {
      carregarIndisponibilidades();
    }
  }, [irmao?.id]);

  const carregarIndisponibilidades = async () => {
    try {
      const response = await authFetch(`/indisponibilidades/irmao/${irmao.id}`);
      const data = await response.json();
      setIndisponibilidades(data);
    } catch (error) {
      console.error('Erro ao carregar indisponibilidades:', error);
    }
  };

  // Gerar dias do mes corretamente
  const getDiasDoMes = () => {
    const primeiroDia = new Date(anoAtual, mesAtual, 1);
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const diaDaSemanaInicio = primeiroDia.getDay(); // 0 = Domingo

    const dias = [];
    
    // Adicionar espacos vazios para alinhar com dia da semana
    for (let i = 0; i < diaDaSemanaInicio; i++) {
      dias.push(null);
    }
    
    // Adicionar dias do mes
    for (let i = 1; i <= diasNoMes; i++) {
      dias.push(i);
    }
    
    return dias;
  };

  // Verificar se dia esta marcado como indisponivel
  const isDiaIndisponivel = (dia) => {
    if (!dia) return false;
    const mesStr = String(mesAtual + 1).padStart(2, '0');
    const diaStr = String(dia).padStart(2, '0');
    const dataFormatada = `${diaStr}/${mesStr}`;
    return indisponibilidades.some(i => i.data === dataFormatada);
  };

  // Toggle dia indisponivel
  const toggleDia = async (dia) => {
    if (!dia || !irmao?.id) return;
    
    const mesStr = String(mesAtual + 1).padStart(2, '0');
    const diaStr = String(dia).padStart(2, '0');
    const dataFormatada = `${diaStr}/${mesStr}`;
    
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

  // Navegar entre meses
  const mesAnterior = () => {
    if (mesAtual === 0) {
      setMesAtual(11);
      setAnoAtual(anoAtual - 1);
    } else {
      setMesAtual(mesAtual - 1);
    }
  };

  const proximoMes = () => {
    if (mesAtual === 11) {
      setMesAtual(0);
      setAnoAtual(anoAtual + 1);
    } else {
      setMesAtual(mesAtual + 1);
    }
  };

  // Toggle funcao
  const toggleFuncao = (funcaoId) => {
    setFuncoes(prev => 
      prev.includes(funcaoId)
        ? prev.filter(f => f !== funcaoId)
        : [...prev, funcaoId]
    );
  };

  // Salvar irmao
  const salvar = async () => {
    if (!nome.trim()) {
      alert('Nome é obrigatório');
      return;
    }

    setSalvando(true);

    try {
      if (irmao?.id) {
        // Atualizar
        await authFetch(`/irmaos/${irmao.id}`, {
          method: 'PUT',
          body: JSON.stringify({ nome, funcoes, ativo })
        });
      } else {
        // Criar novo
        await authFetch('/irmaos', {
          method: 'POST',
          body: JSON.stringify({ nome, funcoes })
        });
      }
      onClose(true);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar');
    }

    setSalvando(false);
  };

  // Deletar irmao
  const deletar = async () => {
    if (!irmao?.id) return;
    if (!confirm(`Excluir ${irmao.nome}? Essa ação não pode ser desfeita.`)) return;

    try {
      await authFetch(`/irmaos/${irmao.id}`, { method: 'DELETE' });
      onClose(true);
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };

  const dias = getDiasDoMes();

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
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 10,
          borderRadius: '20px 20px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <User size={22} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                {irmao ? 'Editar Irmão' : 'Novo Irmão'}
              </h2>
              {irmao && (
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  {indisponibilidades.length} indisponibilidades
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '10px',
              padding: '0.5rem',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
            onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
          >
            <X size={22} color="#64748b" />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Nome */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: '600',
              fontSize: '0.9rem',
              color: '#374151'
            }}>
              Nome
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: '2px solid #e5e7eb',
                fontSize: '1rem',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#f97316'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Funcoes */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: '600',
              fontSize: '0.9rem',
              color: '#374151'
            }}>
              Funções
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {FUNCOES.map(funcao => (
                <button
                  key={funcao.id}
                  onClick={() => toggleFuncao(funcao.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '20px',
                    border: `2px solid ${funcao.color}`,
                    background: funcoes.includes(funcao.id) ? funcao.color : 'white',
                    color: funcoes.includes(funcao.id) ? 'white' : funcao.color,
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '0.85rem',
                    boxShadow: funcoes.includes(funcao.id) ? `0 4px 12px ${funcao.color}40` : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                    e.currentTarget.style.boxShadow = `0 6px 16px ${funcao.color}50`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = funcoes.includes(funcao.id) ? `0 4px 12px ${funcao.color}40` : 'none';
                  }}
                >
                  {funcao.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          {irmao && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer'
              }}>
                <div
                  onClick={() => setAtivo(!ativo)}
                  style={{
                    width: '48px',
                    height: '26px',
                    borderRadius: '13px',
                    background: ativo ? '#10b981' : '#cbd5e1',
                    position: 'relative',
                    transition: 'background 0.2s',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '11px',
                    background: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: ativo ? '24px' : '2px',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </div>
                <span style={{ fontWeight: '500', color: '#374151' }}>
                  {ativo ? 'Ativo' : 'Inativo'}
                </span>
              </label>
            </div>
          )}

          {/* Calendario de Indisponibilidades (apenas se editando) */}
          {irmao && (
            <div style={{
              background: '#f8fafc',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <h4 style={{ 
                  margin: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  color: '#374151'
                }}>
                  <Calendar size={18} color="#f97316" />
                  Indisponibilidades
                </h4>

                {/* Navegacao do mes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={mesAnterior}
                    style={{
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      padding: '4px',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ 
                    fontWeight: '600', 
                    fontSize: '0.85rem',
                    minWidth: '100px',
                    textAlign: 'center'
                  }}>
                    {MESES[mesAtual]} {anoAtual}
                  </span>
                  <button
                    onClick={proximoMes}
                    style={{
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      padding: '4px',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Grid do calendario */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px'
              }}>
                {/* Dias da semana */}
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                  <div key={i} style={{
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#94a3b8',
                    fontSize: '0.7rem',
                    padding: '4px'
                  }}>
                    {d}
                  </div>
                ))}

                {/* Dias do mes */}
                {dias.map((dia, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleDia(dia)}
                    disabled={!dia}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '6px',
                      border: 'none',
                      background: !dia 
                        ? 'transparent' 
                        : isDiaIndisponivel(dia)
                          ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                          : 'white',
                      color: isDiaIndisponivel(dia) ? 'white' : '#374151',
                      fontWeight: '600',
                      fontSize: '0.8rem',
                      cursor: dia ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      boxShadow: dia && !isDiaIndisponivel(dia) ? '0 1px 2px rgba(0,0,0,0.05)' : 
                                 dia && isDiaIndisponivel(dia) ? '0 2px 8px rgba(239, 68, 68, 0.3)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (dia) {
                        e.currentTarget.style.transform = 'scale(1.15)';
                        e.currentTarget.style.boxShadow = isDiaIndisponivel(dia) 
                          ? '0 4px 12px rgba(239, 68, 68, 0.5)' 
                          : '0 4px 12px rgba(249, 115, 22, 0.3)';
                        if (!isDiaIndisponivel(dia)) {
                          e.currentTarget.style.borderColor = '#f97316';
                          e.currentTarget.style.border = '2px solid #f97316';
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (dia) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.border = 'none';
                        e.currentTarget.style.boxShadow = isDiaIndisponivel(dia) 
                          ? '0 2px 8px rgba(239, 68, 68, 0.3)' 
                          : '0 1px 2px rgba(0,0,0,0.05)';
                      }
                    }}
                  >
                    {dia}
                  </button>
                ))}
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                marginTop: '0.75rem',
                fontSize: '0.75rem',
                color: '#64748b'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'white', border: '1px solid #e5e7eb' }} />
                  Disponível
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }} />
                  Indisponível
                </div>
              </div>
            </div>
          )}

          {/* Acoes */}
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem',
            justifyContent: 'space-between',
            flexWrap: 'wrap'
          }}>
            {irmao && (
              <button
                onClick={deletar}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#fecaca'}
                onMouseLeave={(e) => e.target.style.background = '#fee2e2'}
              >
                <Trash2 size={18} />
                Excluir
              </button>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
              <button
                onClick={() => onClose(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f1f5f9',
                  color: '#64748b',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  background: salvando ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '600',
                  cursor: salvando ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px -3px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Check size={18} />
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
