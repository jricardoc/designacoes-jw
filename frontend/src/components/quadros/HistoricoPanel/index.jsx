import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Clock, Edit2, Plus, Archive, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

const ACAO_CONFIG = {
  criou: { label: 'Criou', icon: Plus, color: '#5E6B48' },
  editou: { label: 'Editou', icon: Edit2, color: '#6E7B57' },
  publicou: { label: 'Publicou', icon: FileText, color: '#6E7B57' },
  arquivou: { label: 'Arquivou', icon: Archive, color: '#8A8071' }
};

const HistoricoPanel = forwardRef(function HistoricoPanel({ quadroId }, ref) {
  const { authFetch } = useAuth();
  const [historicos, setHistoricos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(true);

  const carregarHistorico = async () => {
    try {
      const response = await authFetch(`/historico/quadro/${quadroId}`);
      const data = await response.json();
      setHistoricos(data);
    } catch (error) {
      console.error('Erro ao carregar historico:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarHistorico();
  }, [quadroId]);

  // Expor funcao de refresh via ref
  useImperativeHandle(ref, () => ({
    refresh: carregarHistorico
  }));

  // Agrupar por data
  const agruparPorData = () => {
    const grupos = {};
    
    historicos.forEach(h => {
      const data = new Date(h.createdAt);
      const hoje = new Date();
      const ontem = new Date(hoje);
      ontem.setDate(ontem.getDate() - 1);
      
      let chave;
      if (data.toDateString() === hoje.toDateString()) {
        chave = 'Hoje';
      } else if (data.toDateString() === ontem.toDateString()) {
        chave = 'Ontem';
      } else {
        chave = data.toLocaleDateString('pt-BR', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long' 
        });
      }
      
      if (!grupos[chave]) {
        grupos[chave] = [];
      }
      grupos[chave].push(h);
    });
    
    return grupos;
  };

  const grupos = agruparPorData();

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#8A8071' }}>
        Carregando historico...
      </div>
    );
  }

  return (
    <div style={{
      background: '#FBF7EF',
      borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div 
        onClick={() => setExpandido(!expandido)}
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          background: '#F3EDE2',
          borderBottom: expandido ? '1px solid #E6DCC9' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} color="#8A8071" />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#3A352D' }}>
            Historico
          </h3>
          <span style={{
            background: '#E6DCC9',
            padding: '0.15rem 0.5rem',
            borderRadius: '10px',
            fontSize: '0.75rem',
            color: '#8A8071'
          }}>
            {historicos.length}
          </span>
        </div>
        {expandido ? <ChevronUp size={18} color="#8A8071" /> : <ChevronDown size={18} color="#8A8071" />}
      </div>

      {/* Conteudo */}
      {expandido && (
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {historicos.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#8A8071' }}>
              Nenhuma modificacao registrada
            </div>
          ) : (
            Object.entries(grupos).map(([data, items]) => (
              <div key={data}>
                {/* Data Header */}
                <div style={{
                  padding: '0.5rem 1.25rem',
                  background: '#F3EDE2',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#8A8071',
                  textTransform: 'capitalize',
                  position: 'sticky',
                  top: 0
                }}>
                  {data}
                </div>

                {/* Items */}
                {items.map(h => {
                  const config = ACAO_CONFIG[h.acao] || ACAO_CONFIG.editou;
                  const Icon = config.icon;
                  const hora = new Date(h.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div 
                      key={h.id}
                      style={{
                        padding: '0.875rem 1.25rem',
                        borderBottom: '1px solid #F6F0E4',
                        display: 'flex',
                        gap: '0.75rem'
                      }}
                    >
                      {/* Icone */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: `${config.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Icon size={16} color={config.color} />
                      </div>

                      {/* Conteudo */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '0.5rem'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem',
                            flexWrap: 'wrap'
                          }}>
                            <span style={{ 
                              fontWeight: '600', 
                              fontSize: '0.85rem',
                              color: '#2B2620'
                            }}>
                              {h.usuario?.nome || 'Usuario'}
                            </span>
                            <span style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              background: `${config.color}15`,
                              color: config.color,
                              fontSize: '0.7rem',
                              fontWeight: '600'
                            }}>
                              {config.label}
                            </span>
                          </div>
                          <span style={{ 
                            color: '#A2977F', 
                            fontSize: '0.75rem',
                            flexShrink: 0
                          }}>
                            {hora}
                          </span>
                        </div>

                        <p style={{ 
                          margin: '0.25rem 0 0', 
                          fontSize: '0.85rem', 
                          color: '#5C5446',
                          lineHeight: 1.4
                        }}>
                          {h.descricao}
                        </p>

                        {h.designacaoInfo && (
                          <span style={{
                            display: 'inline-block',
                            marginTop: '0.35rem',
                            padding: '0.2rem 0.5rem',
                            background: '#F6F0E4',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: '#8A8071'
                          }}>
                            {h.designacaoInfo}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});

export default HistoricoPanel;
