import { useState, useEffect } from 'react';
import { Users, Plus, Search, Edit2, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EditarIrmaoModal from './EditarIrmaoModal';

export default function GerenciarIrmaos() {
  const { authFetch } = useAuth();
  const [irmaos, setIrmaos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [irmaoSelecionado, setIrmaoSelecionado] = useState(null);

  // Carregar irmaos
  const carregarIrmaos = async () => {
    try {
      const response = await authFetch('/irmaos');
      const data = await response.json();
      setIrmaos(data);
    } catch (error) {
      console.error('Erro ao carregar irmaos:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarIrmaos();
  }, []);

  // Filtrar irmaos
  const irmaosFiltrados = irmaos.filter(i => 
    i.nome.toLowerCase().includes(busca.toLowerCase())
  );

  // Abrir modal para novo irmao
  const novoIrmao = () => {
    setIrmaoSelecionado(null);
    setModalAberto(true);
  };

  // Abrir modal para editar
  const editarIrmao = (irmao) => {
    setIrmaoSelecionado(irmao);
    setModalAberto(true);
  };

  // Fechar modal e recarregar
  const fecharModal = (atualizar = false) => {
    setModalAberto(false);
    setIrmaoSelecionado(null);
    if (atualizar) {
      carregarIrmaos();
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h2 style={{ 
              fontSize: '1.1rem', 
              fontWeight: '600', 
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Users size={22} color="#f97316" />
              Gerenciar Irmãos
            </h2>
            <p style={{ color: '#64748b', margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              {irmaos.length} irmãos cadastrados
            </p>
          </div>

          <button
            onClick={novoIrmao}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 14px -3px rgba(249, 115, 22, 0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px -3px rgba(249, 115, 22, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 14px -3px rgba(249, 115, 22, 0.4)';
            }}
          >
            <Plus size={18} />
            Novo Irmão
          </button>
        </div>

        {/* Busca */}
        <div style={{ position: 'relative', marginTop: '1rem' }}>
          <Search 
            size={18} 
            color="#9ca3af" 
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Buscar irmão..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '350px',
              padding: '0.6rem 1rem 0.6rem 2.5rem',
              borderRadius: '10px',
              border: '2px solid #e5e7eb',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#f97316'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>
      </div>

      {/* Lista de Irmaos - Compacta */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '0.75rem'
      }}>
        {irmaosFiltrados.map(irmao => (
          <div
            key={irmao.id}
            onClick={() => editarIrmao(irmao)}
            style={{
              background: 'white',
              borderRadius: '10px',
              padding: '0.875rem 1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              opacity: irmao.ativo ? 1 : 0.5,
              transition: 'all 0.2s',
              border: '2px solid transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f97316';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
            }}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: irmao.ativo 
                ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
                : '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <User size={18} color="white" />
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontWeight: '600', 
                fontSize: '0.9rem',
                color: irmao.ativo ? '#1e293b' : '#94a3b8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {irmao.nome}
              </div>
              {!irmao.ativo && (
                <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>Inativo</div>
              )}
            </div>

            <Edit2 
              size={16} 
              color="#94a3b8" 
              style={{ flexShrink: 0 }}
            />
          </div>
        ))}
      </div>

      {irmaosFiltrados.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#64748b'
        }}>
          {busca ? 'Nenhum irmão encontrado' : 'Nenhum irmão cadastrado'}
        </div>
      )}

      {/* Modal Unificado de Edicao */}
      {modalAberto && (
        <EditarIrmaoModal
          irmao={irmaoSelecionado}
          onClose={fecharModal}
        />
      )}
    </div>
  );
}
