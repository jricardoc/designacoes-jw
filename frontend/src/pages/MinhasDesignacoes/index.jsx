import { useState, useEffect } from 'react';
import { CalendarCheck, Compass, FileText, Users, Link2Off, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import PrivilegioBadge from '../../components/PrivilegioBadge';

const TIPOS = {
  designacao: { label: 'Quadro de designações', icon: FileText, cor: '#6E7B57', fundo: '#E9EFDC' },
  dirigente: { label: 'Saída de campo', icon: Compass, cor: '#9A5A38', fundo: '#F1E1D2' },
  reuniao: { label: 'Reunião', icon: Users, cor: '#2F6F7E', fundo: '#E4EFF2' },
};

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** "2026-07-09" -> "Julho de 2026" (chave de agrupamento por mês). */
function rotuloDoMes(dataISO) {
  if (!dataISO) return 'Sem data definida';
  const [ano, mes] = dataISO.split('-').map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

export default function MinhasDesignacoes() {
  const { authFetch } = useAuth();
  const [dados, setDados] = useState(null);
  const [escopo, setEscopo] = useState('proximas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);

    (async () => {
      try {
        const res = await authFetch(`/minhas-designacoes?escopo=${escopo}`);
        if (res.ok && !cancelado) setDados(await res.json());
      } catch (error) {
        console.error('Erro ao carregar minhas designações:', error);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => { cancelado = true; };
  }, [escopo, authFetch]);

  const compromissos = dados?.compromissos || [];

  // Agrupa por mês preservando a ordem cronológica que o backend já devolveu.
  const grupos = compromissos.reduce((acc, c) => {
    const chave = rotuloDoMes(c.dataISO);
    if (!acc.length || acc[acc.length - 1].mes !== chave) acc.push({ mes: chave, itens: [] });
    acc[acc.length - 1].itens.push(c);
    return acc;
  }, []);

  return (
    <div>
      <PageHeader
        title="Minhas Designações"
        description={dados?.irmao ? `Compromissos de ${dados.irmao.nome}` : 'Seus compromissos'}
        icon={CalendarCheck}
        color="olive"
      >
        {dados?.vinculado && (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {[
              { id: 'proximas', label: 'Próximas' },
              { id: 'todas', label: 'Todas' },
            ].map((op) => (
              <button
                key={op.id}
                onClick={() => setEscopo(op.id)}
                className={`t-btn ${escopo === op.id ? 't-btn-primary' : 't-btn-secondary'}`}
              >
                {op.label}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      <div style={{ padding: '0 2.5rem 3rem' }}>
        {loading ? (
          <div className="t-loading">Carregando seus compromissos...</div>
        ) : !dados?.vinculado ? (
          <div className="t-empty">
            <Link2Off size={46} color="#C6BAA0" />
            <h3>Conta ainda não vinculada</h3>
            <p style={{ maxWidth: '30rem', margin: '0 auto' }}>{dados?.mensagem}</p>
          </div>
        ) : compromissos.length === 0 ? (
          <div className="t-empty">
            <CalendarCheck size={46} color="#C6BAA0" />
            <h3>{escopo === 'proximas' ? 'Nenhum compromisso à frente' : 'Nenhuma designação encontrada'}</h3>
            <p>
              {escopo === 'proximas'
                ? 'Você não tem designações a partir de hoje. Veja "Todas" para consultar o histórico.'
                : 'Seu nome ainda não aparece em nenhum quadro, escala ou programação.'}
            </p>
          </div>
        ) : (
          <>
            <div className="t-section-row">
              <div>
                <h2 className="t-section-title">
                  {escopo === 'proximas' ? 'Próximos compromissos' : 'Todos os compromissos'}
                </h2>
                <p className="t-section-sub">
                  {compromissos.length} compromisso(s)
                  {dados.irmao?.privilegio ? ' · ' : ''}
                </p>
              </div>
              {dados.irmao?.privilegio && <PrivilegioBadge privilegio={dados.irmao.privilegio} />}
            </div>

            {grupos.map((grupo) => (
              <div key={grupo.mes} style={{ marginBottom: '1.75rem' }}>
                <h3
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#A2977F',
                    margin: '0 0 0.7rem',
                  }}
                >
                  {grupo.mes}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {grupo.itens.map((c) => {
                    const tipo = TIPOS[c.tipo] || TIPOS.designacao;
                    const Icone = tipo.icon;
                    const rascunho = c.origem?.status === 'rascunho';

                    return (
                      <div
                        key={c.id}
                        className="t-card"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.9rem 1rem' }}
                      >
                        <div
                          style={{
                            width: '46px',
                            flexShrink: 0,
                            textAlign: 'center',
                            borderRight: '1px solid #ECE3D3',
                            paddingRight: '0.75rem',
                          }}
                        >
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2B2620', lineHeight: 1.1 }}>
                            {c.data ? c.data.split('/')[0] : '—'}
                          </div>
                          <div style={{ fontSize: '0.64rem', color: '#A2977F', textTransform: 'uppercase' }}>
                            {(c.diaSemana || '').slice(0, 3)}
                          </div>
                        </div>

                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            background: tipo.fundo,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icone size={16} color={tipo.cor} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: '#2B2620',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              flexWrap: 'wrap',
                            }}
                          >
                            {c.titulo}
                            {c.papel && (
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  color: tipo.cor,
                                  background: tipo.fundo,
                                  borderRadius: '999px',
                                  padding: '2px 8px',
                                }}
                              >
                                {c.papel}
                              </span>
                            )}
                            {rascunho && (
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  color: '#9A5A38',
                                  background: '#F1E1D2',
                                  borderRadius: '999px',
                                  padding: '2px 8px',
                                }}
                                title="Este quadro ainda não foi publicado e pode mudar"
                              >
                                Rascunho
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#8A8071', marginTop: '2px' }}>
                            {[tipo.label, c.detalhe, c.local, c.horario].filter(Boolean).join(' · ')}
                          </div>
                          {c.dataAproximada && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.72rem',
                                color: '#9A5A38',
                                marginTop: '3px',
                              }}
                            >
                              <AlertTriangle size={12} />
                              Data aproximada — confira na programação
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
