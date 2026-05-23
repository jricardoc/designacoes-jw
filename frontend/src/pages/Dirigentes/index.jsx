import { useState, useEffect } from 'react';
import { Compass, Plus, FileText, Archive, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import NovoDirigenteModal from './NovoDirigenteModal';
import './styles.css';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
               'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const STATUS_CONFIG = {
  rascunho: { label: 'Rascunho', color: '#f59e0b', bg: '#fef3c7' },
  publicado: { label: 'Publicado', color: '#10b981', bg: '#d1fae5' },
  arquivado: { label: 'Arquivado', color: '#64748b', bg: '#f1f5f9' }
};

export default function Dirigentes() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [quadros, setQuadros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  const carregarQuadros = async () => {
    try {
      const response = await authFetch('/dirigentes/quadros');
      if (response.ok) {
        const data = await response.json();
        setQuadros(data);
      }
    } catch (error) {
      console.error('Erro ao carregar quadros de dirigentes:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarQuadros();
  }, []);

  const abrirQuadro = (quadro) => {
    navigate(`/dirigentes/quadro/${quadro.id}`);
  };

  const fecharModal = (atualizar = false) => {
    setModalAberto(false);
    if (atualizar) {
      setLoading(true);
      carregarQuadros();
    }
  };

  return (
    <div>
      <PageHeader
        title="Escala de Dirigentes"
        description="Gerencie os dirigentes de saída de campo mensais"
        icon={Compass}
        color="blue"
      >
        <button
          onClick={() => setModalAberto(true)}
          className="btn-novo-quadro"
        >
          <Plus size={20} />
          Nova Escala
        </button>
      </PageHeader>

      <div style={{ padding: '0 2.5rem 2.5rem' }}>
        {loading ? (
          <div className="loading-state">Carregando quadros...</div>
        ) : quadros.length === 0 ? (
          <div className="empty-state">
            <Compass size={48} className="empty-icon" />
            <h3>Nenhuma escala criada</h3>
            <p>Clique em "Nova Escala" para criar o primeiro quadro do mês.</p>
            <button
              onClick={() => setModalAberto(true)}
              className="btn-primary"
            >
              Criar Primeira Escala
            </button>
          </div>
        ) : (
          <div className="quadros-grid">
            {quadros.map(quadro => {
              const statusConfig = STATUS_CONFIG[quadro.status] || STATUS_CONFIG.rascunho;
              const dataFormatada = new Date(quadro.createdAt).toLocaleDateString('pt-BR');
              
              return (
                <div
                  key={quadro.id}
                  onClick={() => abrirQuadro(quadro)}
                  className="quadro-card"
                >
                  <div className="quadro-card-indicator" style={{ background: statusConfig.color }} />

                  <div className="quadro-card-header">
                    <div className="quadro-card-icon">
                      <FileText size={24} color="white" />
                    </div>

                    <span className="quadro-status-badge" style={{
                      background: statusConfig.bg,
                      color: statusConfig.color
                    }}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <h3 className="quadro-card-title">
                    {MESES[quadro.mes]} {quadro.ano}
                  </h3>

                  <div className="quadro-card-info">
                    <span>
                      <Compass size={14} />
                      {quadro._count?.escalas || 0} designações
                    </span>
                  </div>

                  <div className="quadro-card-footer">
                    <span>Criado em {dataFormatada}</span>
                    <ChevronRight size={18} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalAberto && (
        <NovoDirigenteModal 
          isOpen={modalAberto} 
          onClose={() => fecharModal(false)} 
          onSuccess={() => fecharModal(true)}
          quadrosExistentes={quadros} 
        />
      )}
    </div>
  );
}
