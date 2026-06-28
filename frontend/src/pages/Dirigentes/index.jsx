import { useState, useEffect } from 'react';
import { Compass, Plus, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import NovoDirigenteModal from './NovoDirigenteModal';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const STATUS = {
  rascunho: { label: 'Rascunho', color: '#9A5A38', bg: '#F1E1D2' },
  publicado: { label: 'Publicado', color: '#54622F', bg: '#E2E7D2' },
  arquivado: { label: 'Arquivado', color: '#8A8071', bg: '#EAE3D6' },
};

export default function Dirigentes() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [quadros, setQuadros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  const carregar = async () => {
    try {
      const res = await authFetch('/dirigentes/quadros');
      if (res.ok) setQuadros(await res.json());
    } catch (e) {
      console.error('Erro ao carregar quadros de dirigentes:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => { await carregar(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fecharModal = (atualizar = false) => {
    setModalAberto(false);
    if (atualizar) {
      setLoading(true);
      carregar();
    }
  };

  return (
    <div>
      <PageHeader
        title="Escala de Dirigentes"
        description="Saídas de campo mensais"
        icon={Compass}
        color="olive"
      >
        <button onClick={() => setModalAberto(true)} className="t-btn t-btn-primary">
          <Plus size={18} /> Nova Escala
        </button>
      </PageHeader>

      <div style={{ padding: '0 2.5rem 3rem' }}>
        <div className="t-section-row">
          <div>
            <h2 className="t-section-title">Escalas</h2>
            <p className="t-section-sub">{quadros.length} escala(s) criada(s)</p>
          </div>
        </div>

        {loading ? (
          <div className="t-loading">Carregando escalas...</div>
        ) : quadros.length === 0 ? (
          <div className="t-empty">
            <Compass size={46} color="#C6BAA0" />
            <h3>Nenhuma escala criada</h3>
            <p>Clique em "Nova Escala" para criar a primeira.</p>
            <button onClick={() => setModalAberto(true)} className="t-btn t-btn-primary" style={{ marginTop: '1rem' }}>
              <Plus size={18} /> Criar Primeira Escala
            </button>
          </div>
        ) : (
          <div className="t-grid">
            {quadros.map((q) => {
              const sc = STATUS[q.status] || STATUS.rascunho;
              const data = new Date(q.createdAt).toLocaleDateString('pt-BR');
              return (
                <button key={q.id} onClick={() => navigate(`/dirigentes/quadro/${q.id}`)} className="t-card t-card-btn">
                  <div className="t-card-top">
                    <div className="t-icon-box">
                      <Compass size={22} color="#9A7E55" />
                    </div>
                    <span className="t-chip" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <div className="t-card-title">{MESES[q.mes]} {q.ano}</div>
                  <div className="t-card-meta">{q._count?.escalas || 0} saídas</div>
                  <div className="t-card-foot">
                    <span>Criado em {data}</span>
                    <ChevronRight size={16} color="#C6BAA0" />
                  </div>
                </button>
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
