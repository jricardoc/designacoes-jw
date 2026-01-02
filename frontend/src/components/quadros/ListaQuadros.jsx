import { useState, useEffect } from 'react';
import { Calendar, Plus, FileText, Archive, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NovoQuadroModal from './NovoQuadroModal';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
               'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const STATUS_CONFIG = {
  rascunho: { label: 'Rascunho', color: '#f59e0b', bg: '#fef3c7' },
  publicado: { label: 'Publicado', color: '#10b981', bg: '#d1fae5' },
  arquivado: { label: 'Arquivado', color: '#64748b', bg: '#f1f5f9' }
};

export default function ListaQuadros() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [quadros, setQuadros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  const carregarQuadros = async () => {
    try {
      const response = await authFetch('/quadros');
      const data = await response.json();
      setQuadros(data);
    } catch (error) {
      console.error('Erro ao carregar quadros:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarQuadros();
  }, []);

  const abrirQuadro = (quadro) => {
    navigate(`/quadro/${quadro.id}`);
  };

  const fecharModal = (atualizar = false) => {
    setModalAberto(false);
    if (atualizar) {
      carregarQuadros();
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        Carregando quadros...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
            Quadros de Designações
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            {quadros.length} quadros criados
          </p>
        </div>

        <button
          onClick={() => setModalAberto(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 14px -3px rgba(59, 130, 246, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px -3px rgba(59, 130, 246, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px -3px rgba(59, 130, 246, 0.4)';
          }}
        >
          <Plus size={20} />
          Novo Quadro
        </button>
      </div>

      {/* Grid de Quadros */}
      {quadros.length === 0 ? (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '4rem 2rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <Calendar size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: '#374151' }}>Nenhum quadro criado</h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            Clique em "Novo Quadro" para criar seu primeiro
          </p>
          <button
            onClick={() => setModalAberto(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Criar Primeiro Quadro
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem'
        }}>
          {quadros.map(quadro => {
            const statusConfig = STATUS_CONFIG[quadro.status] || STATUS_CONFIG.rascunho;
            const dataFormatada = new Date(quadro.createdAt).toLocaleDateString('pt-BR');
            
            return (
              <div
                key={quadro.id}
                onClick={() => abrirQuadro(quadro)}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: '2px solid transparent',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                }}
              >
                {/* Faixa colorida no topo */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: statusConfig.color
                }} />

                {/* Header do card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileText size={24} color="white" />
                  </div>

                  <span style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    background: statusConfig.bg,
                    color: statusConfig.color,
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {statusConfig.label}
                  </span>
                </div>

                {/* Titulo */}
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: '600' }}>
                  {MESES[quadro.mes]} {quadro.ano}
                </h3>

                {/* Info */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', color: '#64748b', fontSize: '0.8rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} />
                    {quadro._count?.designacoes || 0} designações
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} />
                    {quadro._count?.historicos || 0} alterações
                  </span>
                </div>

                {/* Footer */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '1rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    Criado em {dataFormatada}
                  </span>
                  <ChevronRight size={18} color="#94a3b8" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Novo Quadro */}
      {modalAberto && (
      <NovoQuadroModal 
        isOpen={modalAberto} 
        onClose={() => fecharModal(false)} 
        onSuccess={() => fecharModal(true)}
        quadrosExistentes={quadros} 
      />
      )}
    </div>
  );
}
