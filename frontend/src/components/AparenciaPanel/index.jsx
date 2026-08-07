import { Sun, Moon, Monitor, Palette, Check } from 'lucide-react';
import { useTema } from '../../context/TemaContext';

/**
 * Aparência — tema claro/escuro/sistema e modo daltônico.
 *
 * Espelha a tela de Ajustes do app mobile. É preferência do NAVEGADOR (fica no
 * localStorage), não do usuário no servidor: não há chamada de API aqui.
 */

const OPCOES = [
  { id: 'claro', rotulo: 'Claro', descricao: 'Creme e oliva, como sempre foi', Icone: Sun },
  { id: 'escuro', rotulo: 'Escuro', descricao: 'Os mesmos tons terrosos, à noite', Icone: Moon },
  { id: 'sistema', rotulo: 'Padrão do sistema', descricao: 'Acompanha o tema do computador', Icone: Monitor },
];

/** As mesmas amostras do mobile: sem elas o irmão liga a chave e fica na dúvida. */
const AMOSTRAS = [
  { nome: 'Marca', var: 'var(--t-primary)' },
  { nome: 'Publicado', var: 'var(--t-green-dark)' },
  { nome: 'Atenção', var: 'var(--t-amber)' },
  { nome: 'Excluir', var: 'var(--t-red)' },
  { nome: 'Destaque', var: 'var(--t-terracotta)' },
];

export default function AparenciaPanel() {
  const { tema, daltonico, setTema, setDaltonico } = useTema();

  return (
    <div className="t-card" style={{ padding: '1.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <Palette size={19} color="var(--t-olive)" />
        <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--t-text)' }}>Aparência</span>
      </div>

      <div style={{ display: 'grid', gap: '8px' }}>
        {OPCOES.map(({ id, rotulo, descricao, Icone }) => {
          const ativa = tema === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTema(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                textAlign: 'left',
                padding: '11px 12px',
                borderRadius: '12px',
                cursor: 'pointer',
                background: ativa ? 'var(--t-info-bg)' : 'transparent',
                border: `1px solid ${ativa ? 'var(--t-primary)' : 'var(--t-border)'}`,
              }}
            >
              <span
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: ativa ? 'var(--t-primary)' : 'var(--t-surface-muted)',
                }}
              >
                <Icone size={17} color={ativa ? 'var(--t-text-on-primary)' : 'var(--t-text-2)'} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 600, color: 'var(--t-text)' }}>
                  {rotulo}
                </span>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--t-text-2)' }}>
                  {descricao}
                </span>
              </span>
              {ativa && <Check size={18} color="var(--t-primary)" />}
            </button>
          );
        })}
      </div>

      <div className="t-divider" />

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={daltonico}
          onChange={(e) => setDaltonico(e.target.checked)}
          style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: 'var(--t-primary)' }}
        />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 600, color: 'var(--t-text)' }}>
            Modo daltônico
          </span>
          <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--t-text-2)', lineHeight: 1.45 }}>
            O tema muda do eixo verde-oliva/terracota para azul/laranja, que continua
            distinguível em protanopia e deuteranopia.
          </span>
        </span>
      </label>

      <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
        {AMOSTRAS.map((a) => (
          <div key={a.nome} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: '26px', borderRadius: '9px', background: a.var }} />
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--t-muted)', marginTop: '5px' }}>
              {a.nome}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
