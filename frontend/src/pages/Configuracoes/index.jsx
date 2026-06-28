import { useState } from 'react';
import { Settings, Users, Wrench } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import GerenciarIrmaos from '../../components/config/GerenciarIrmaos';
import SistemaPanel from '../../components/config/SistemaPanel';
import './styles.css';

export default function Configuracoes() {
  const [secaoAtiva, setSecaoAtiva] = useState('irmaos');

  const tabs = [
    { id: 'irmaos', label: 'Irmãos', icon: Users },
    { id: 'sistema', label: 'Sistema', icon: Wrench },
  ];

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Irmãos, funções e sistema"
        icon={Settings}
        color="orange"
      />

      <div style={{ padding: '0 2.5rem 2.5rem' }}>
        {/* Segmented tabs (terroso) */}
        <div
          style={{
            display: 'flex',
            gap: '5px',
            background: '#EBE1CF',
            borderRadius: '14px',
            padding: '5px',
            maxWidth: '360px',
            marginBottom: '22px',
          }}
        >
          {tabs.map((t) => {
            const active = secaoAtiva === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSecaoAtiva(t.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  height: '40px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14.5px',
                  background: active ? '#FBF7EF' : 'transparent',
                  color: active ? '#566239' : '#8A8071',
                  boxShadow: active ? '0 1px 2px rgba(43,38,32,0.06)' : 'none',
                }}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {secaoAtiva === 'irmaos' && <GerenciarIrmaos />}
        {secaoAtiva === 'sistema' && <SistemaPanel />}
      </div>
    </>
  );
}
