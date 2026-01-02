import { useState } from 'react';
import { Settings, Users, RefreshCw, ChevronRight } from 'lucide-react';
import PageHeader from './PageHeader';
import GerenciarIrmaos from './config/GerenciarIrmaos';
import ConfirmModal from './ConfirmModal';
import { useDesignacoes } from '../context/DesignacoesContext';
import { useAuth } from '../context/AuthContext';
import './Configuracoes.css';

export default function Configuracoes() {
  const [secaoAtiva, setSecaoAtiva] = useState('irmaos');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { authFetch } = useAuth();

  const handleResetConfirm = async () => {
    setResetting(true);
    try {
      const response = await authFetch('/config/reset', { method: 'POST' });
      if (response.ok) {
        setShowResetModal(false);
        window.location.reload();
      }
    } catch (error) {
      console.error('Erro ao resetar:', error);
    }
    setResetting(false);
  };

  const secoes = [
    { id: 'irmaos', label: 'Gerenciar Irmãos', icon: Users, desc: 'Adicionar, editar e configurar' },
    { id: 'sistema', label: 'Sistema', icon: Settings, desc: 'Backup e reset' }
  ];

  return (
    <>
      <PageHeader 
        title="Configurações" 
        description="Gerencie irmãos, funções e sistema"
        icon={Settings}
        color="orange"
      />

      <div className="config-container">
        {/* Menu Lateral */}
        <div className="config-menu">
          {secoes.map(secao => {
            const isActive = secaoAtiva === secao.id;
            return (
              <button
                key={secao.id}
                onClick={() => setSecaoAtiva(secao.id)}
                className={`config-menu-btn ${isActive ? 'active' : ''}`}
              >
                <secao.icon size={18} />
                <div className="config-menu-text">
                  <div className="config-menu-label">{secao.label}</div>
                  <div className="config-menu-desc" style={{ opacity: isActive ? 0.9 : 0.6 }}>
                    {secao.desc}
                  </div>
                </div>
                {window.innerWidth > 768 && <ChevronRight size={16} style={{ opacity: 0.5 }} />}
              </button>
            );
          })}
        </div>

        {/* Conteúdo Principal */}
        <div className="config-content">
          {secaoAtiva === 'irmaos' && <GerenciarIrmaos />}

          {secaoAtiva === 'sistema' && (
            <div className="sistema-panel">
              <h2 className="sistema-title">
                <Settings size={22} color="#f97316" />
                Sistema
              </h2>

              <div className="sistema-danger-zone">
                <h3 className="sistema-danger-title">
                  <RefreshCw size={18} />
                  Resetar Banco de Dados
                </h3>
                <p className="sistema-danger-text">
                  Apaga TODAS as designações e restaura dados padrão.
                </p>
                <button
                  onClick={() => setShowResetModal(true)}
                  disabled={resetting}
                  className="sistema-btn-danger"
                >
                  {resetting ? 'Resetando...' : 'Resetar Tudo'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetConfirm}
        title="Resetar Banco de Dados"
        message="Tem certeza? Isso apagará TODAS as designações, quadros e restaurará os dados para o padrão inicial. Esta ação não pode ser desfeita."
        type="danger"
        confirmText="Resetar Tudo"
        cancelText="Cancelar"
      />
    </>
  );
}
