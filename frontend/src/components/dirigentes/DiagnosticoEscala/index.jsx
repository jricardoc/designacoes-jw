import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

/**
 * Mostra o resultado da geracao automatica da Escala de Dirigentes.
 *
 * O objetivo aqui nao e so "deu certo/deu errado": quando a escala sai desequilibrada por
 * falta de dirigentes cadastrados em alguma saida, o painel diz exatamente qual saida e o
 * quanto ela forca de carga. Sem isso o usuario culpa o algoritmo por um problema de cadastro.
 */

const ESTILO_AVISO = {
  vaga_vazia: { cor: 'var(--t-red-dark)', fundo: 'var(--t-danger-bg)', Icone: AlertTriangle },
  irmao_sem_designacao: { cor: 'var(--t-red-dark)', fundo: 'var(--t-danger-bg)', Icone: AlertTriangle },
  reparo_impossivel: { cor: 'var(--t-red-dark)', fundo: 'var(--t-danger-bg)', Icone: AlertTriangle },
  duplicidade_no_dia: { cor: 'var(--t-warning-strong)', fundo: 'var(--t-warning-bg)', Icone: AlertTriangle },
  sem_disponibilidade: { cor: 'var(--t-warning-strong)', fundo: 'var(--t-warning-bg)', Icone: Info },
  saida_com_poucos_dirigentes: { cor: 'var(--t-warning-strong)', fundo: 'var(--t-warning-bg)', Icone: Info },
};

const PADRAO = { cor: 'var(--t-text)', fundo: 'var(--t-bg)', Icone: Info };

export default function DiagnosticoEscala({ diagnostico, onClose, titulo = 'Resultado da geração' }) {
  if (!diagnostico) return null;

  const {
    totalVagas = 0,
    vagasPreenchidas = 0,
    vagasVazias = 0,
    totalDirigentes = 0,
    semDesignacao = [],
    limitadosPelaDisponibilidade = [],
    porIrmao = [],
    avisos = [],
  } = diagnostico;

  const tudoOk = vagasVazias === 0 && semDesignacao.length === 0;
  const cargas = porIrmao.map((p) => p.designacoes);
  const menor = cargas.length ? Math.min(...cargas) : 0;
  const maior = cargas.length ? Math.max(...cargas) : 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--t-surface)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--t-border-strong)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '1.15rem',
              fontWeight: 600,
              color: 'var(--t-text)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {tudoOk ? (
              <CheckCircle2 size={20} color="var(--t-primary)" />
            ) : (
              <AlertTriangle size={20} color="var(--t-terracotta)" />
            )}
            {titulo}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
          >
            <X size={20} color="var(--t-text-2)" />
          </button>
        </div>

        <div style={{ padding: '1.5rem', overflow: 'auto' }}>
          {/* Resumo */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            {[
              { rotulo: 'Vagas preenchidas', valor: `${vagasPreenchidas}/${totalVagas}` },
              { rotulo: 'Dirigentes', valor: totalDirigentes },
              { rotulo: 'Designações', valor: cargas.length ? `${menor} a ${maior}` : '—' },
            ].map((c) => (
              <div
                key={c.rotulo}
                style={{ background: 'var(--t-bg)', borderRadius: '12px', padding: '0.85rem' }}
              >
                <div style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--t-text)' }}>{c.valor}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--t-text-2)' }}>{c.rotulo}</div>
              </div>
            ))}
          </div>

          {/* Avisos */}
          {avisos.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--t-text-2)', fontWeight: 600 }}>
                Pontos de atenção
              </h4>
              {avisos.map((a, i) => {
                const { cor, fundo, Icone } = ESTILO_AVISO[a.tipo] || PADRAO;
                return (
                  <div
                    key={`${a.tipo}-${i}`}
                    style={{
                      display: 'flex',
                      gap: '0.6rem',
                      alignItems: 'flex-start',
                      background: fundo,
                      color: cor,
                      borderRadius: '10px',
                      padding: '0.7rem 0.85rem',
                      marginBottom: '0.5rem',
                      fontSize: '0.86rem',
                      lineHeight: 1.45,
                    }}
                  >
                    <Icone size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{a.mensagem}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Carga por irmao */}
          {porIrmao.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--t-text-2)', fontWeight: 600 }}>
                Distribuição por dirigente
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {porIrmao.map((p) => {
                  const proporcao = p.cota ? Math.min(1.5, p.designacoes / p.cota) : 0;
                  return (
                    <div
                      key={p.nome}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.45rem 0.6rem',
                        borderRadius: '8px',
                        background: 'var(--t-surface-muted)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.88rem',
                            color: 'var(--t-text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.nome}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--t-text-2)' }}>
                          {p.oportunidades} oportunidades
                          {p.limitadoPelaDisponibilidade && ' · limitado pela disponibilidade'}
                        </div>
                      </div>
                      <div
                        style={{
                          width: '72px',
                          height: '6px',
                          borderRadius: '3px',
                          background: 'var(--t-border-strong)',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, proporcao * 66)}%`,
                            height: '100%',
                            background: proporcao > 1.25 ? 'var(--t-terracotta)' : 'var(--t-olive)',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          minWidth: '28px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: 'var(--t-text)',
                          fontSize: '0.9rem',
                        }}
                      >
                        {p.designacoes}
                      </div>
                    </div>
                  );
                })}
              </div>
              {limitadosPelaDisponibilidade.length > 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--t-text-2)', marginTop: '0.7rem', lineHeight: 1.5 }}>
                  Os irmãos marcados como <em>limitados pela disponibilidade</em> não podem chegar mais perto
                  da média: as saídas em que eles estão habilitados não comportam isso. Cadastrar mais
                  dirigentes nessas saídas é o que resolve.
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--t-border-strong)' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '0.8rem',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, var(--t-olive) 0%, var(--t-primary-dark) 100%)',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
