import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen, MapPin, Users, Plus, Clock, Pencil, Phone, PhoneOff, AlertTriangle,
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import PublicadorModal from './PublicadorModal';
import TurnoModal from './TurnoModal';
import PontoModal from './PontoModal';
import './styles.css';

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Faixas que a planilha da congregação já usava; a grade sempre mostra todas,
 *  mesmo vazias, para dar a mesma leitura do papel. */
const FAIXAS_PADRAO = [
  ['06:00', '08:00'], ['08:00', '10:00'], ['10:00', '12:00'], ['12:00', '14:00'],
  ['14:00', '16:00'], ['16:00', '18:00'], ['18:00', '20:00'], ['20:00', '21:00'],
];

export default function Carrinho() {
  const { authFetch, usuario } = useAuth();
  // Sem o escopo do carrinho a tela é só consulta — o backend recusa as escritas
  // (ver backend/src/middleware/escopos.js). Espelha o gating do app mobile.
  const podeEditar = !!usuario?.isAdmin || !!usuario?.escopos?.includes('carrinho');
  const [dados, setDados] = useState({ pontos: [], publicadores: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [modalPublicador, setModalPublicador] = useState(null); // {} = novo
  const [modalTurno, setModalTurno] = useState(null); // { ponto, turno }
  const [modalPonto, setModalPonto] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const res = await authFetch('/carrinho');
      if (!res.ok) throw new Error('Não foi possível carregar o carrinho');
      setDados(await res.json());
      setErro('');
    } catch (e) {
      setErro(e.message);
    }
    setCarregando(false);
  }, [authFetch]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const fechar = (setter) => (recarregar) => {
    setter(null);
    if (recarregar) carregar();
  };

  /** Faixas padrão + qualquer horário fora do padrão que exista em algum turno. */
  const faixas = useMemo(() => {
    const mapa = new Map(FAIXAS_PADRAO.map(([i, f]) => [`${i}-${f}`, [i, f]]));
    dados.pontos.forEach((p) =>
      p.turnos.forEach((t) => mapa.set(`${t.horaInicio}-${t.horaFim}`, [t.horaInicio, t.horaFim])),
    );
    return [...mapa.values()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [dados.pontos]);

  const totais = useMemo(() => {
    const turnos = dados.pontos.reduce((s, p) => s + p.turnos.length, 0);
    const semTelefone = dados.publicadores.filter((p) => p.ativo && !p.telefone).length;
    return {
      pontos: dados.pontos.filter((p) => p.ativo).length,
      turnos,
      pessoas: dados.publicadores.filter((p) => p.ativo).length,
      semTelefone,
    };
  }, [dados]);

  return (
    <div className="carrinho-page">
      <PageHeader
        title="Carrinho"
        description="Turnos fixos semanais por ponto de testemunho público."
        icon={BookOpen}
      >
        <div className="crr-acoes-topo">
          {podeEditar && <button onClick={() => setModalPonto({})} className="crr-btn crr-btn-neutro">
            <MapPin size={16} /> Novo ponto
          </button>}
          {podeEditar && <button onClick={() => setModalPublicador({})} className="crr-btn crr-btn-primario">
            <Plus size={16} /> Nova pessoa
          </button>}
        </div>
      </PageHeader>

      <div className="crr-conteudo">
        {carregando ? (
          <div className="crr-vazio">Carregando o carrinho...</div>
        ) : erro ? (
          <div className="crr-erro">{erro}</div>
        ) : (
          <>
            <div className="crr-kpis">
              {[
                { icone: MapPin, rotulo: 'Pontos ativos', valor: totais.pontos, cor: 'var(--t-teal)' },
                { icone: Clock, rotulo: 'Turnos na semana', valor: totais.turnos, cor: 'var(--t-amber)' },
                { icone: Users, rotulo: 'Pessoas', valor: totais.pessoas, cor: 'var(--t-primary)' },
                { icone: PhoneOff, rotulo: 'Sem telefone', valor: totais.semTelefone, cor: 'var(--t-red)' },
              ].map((k) => (
                <div key={k.rotulo} className="crr-kpi">
                  <div className="crr-kpi-icone" style={{ background: `${k.cor}1a`, color: k.cor }}>
                    <k.icone size={20} />
                  </div>
                  <div>
                    <div className="crr-kpi-valor">{String(k.valor).padStart(2, '0')}</div>
                    <div className="crr-kpi-rotulo">{k.rotulo}</div>
                  </div>
                </div>
              ))}
            </div>

            {totais.semTelefone > 0 && (
              <div className="crr-aviso">
                <AlertTriangle size={17} />
                <span>
                  <strong>{totais.semTelefone}</strong> pessoa(s) ainda sem telefone. O lembrete
                  automático de WhatsApp só alcança quem tiver o número cadastrado.
                </span>
              </div>
            )}

            {/* ---- grade por ponto, no mesmo formato da planilha ---- */}
            {dados.pontos.length === 0 ? (
              <div className="crr-vazio">
                <MapPin size={40} color="var(--t-muted)" />
                <h3>Nenhum ponto cadastrado</h3>
                <p>Crie o primeiro ponto para montar a grade de turnos.</p>
              </div>
            ) : (
              dados.pontos.map((ponto) => (
                <section key={ponto.id} className={`crr-ponto ${ponto.ativo ? '' : 'inativo'}`}>
                  <header className="crr-ponto-topo" style={{ background: ponto.cor }}>
                    <div className="crr-ponto-nome">
                      <MapPin size={17} />
                      {ponto.nome}
                      {!ponto.ativo && <span className="crr-tag-inativo">inativo</span>}
                    </div>
                    {podeEditar && (
                      <div className="crr-ponto-acoes">
                        <button
                          onClick={() => setModalTurno({ ponto, turno: null })}
                          title="Adicionar turno"
                        >
                          <Plus size={16} /> Turno
                        </button>
                        <button onClick={() => setModalPonto(ponto)} title="Editar ponto">
                          <Pencil size={15} />
                        </button>
                      </div>
                    )}
                  </header>

                  <div className="crr-grade-rolagem">
                    <table className="crr-grade">
                      <thead>
                        <tr>
                          <th className="crr-col-hora">Horário</th>
                          {DIAS.map((d, i) => (
                            <th key={d}>
                              <span className="crr-dia-longo">{d}</span>
                              <span className="crr-dia-curto">{DIAS_CURTOS[i]}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {faixas.map(([inicio, fim]) => (
                          <tr key={`${inicio}-${fim}`}>
                            <th className="crr-col-hora">{inicio} - {fim}</th>
                            {DIAS.map((_, dia) => {
                              const turno = ponto.turnos.find(
                                (t) => t.diaSemana === dia && t.horaInicio === inicio && t.horaFim === fim,
                              );
                              return (
                                <td key={dia}>
                                  {turno ? (
                                    <button
                                      className="crr-celula"
                                      onClick={podeEditar ? () => setModalTurno({ ponto, turno }) : undefined}
                                      title={podeEditar ? 'Editar turno' : undefined}
                                    >
                                      {turno.publicadores.length === 0 ? (
                                        <span className="crr-celula-vazia-txt">definir</span>
                                      ) : (
                                        turno.publicadores.map((p) => (
                                          <span
                                            key={p.id}
                                            className={`crr-pessoa ${p.ativo ? '' : 'inativa'}`}
                                          >
                                            {p.nome}
                                          </span>
                                        ))
                                      )}
                                    </button>
                                  ) : podeEditar ? (
                                    <button
                                      className="crr-celula crr-celula-vazia"
                                      onClick={() =>
                                        setModalTurno({
                                          ponto,
                                          turno: { diaSemana: dia, horaInicio: inicio, horaFim: fim, publicadores: [] },
                                        })
                                      }
                                      title="Criar turno aqui"
                                    >
                                      <Plus size={13} />
                                    </button>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))
            )}

            {/* ---- cadastro de pessoas ---- */}
            <section className="crr-pessoas">
              <div className="crr-pessoas-topo">
                <h2>Pessoas do carrinho</h2>
                <span>{dados.publicadores.length} cadastrada(s)</span>
              </div>
              <div className="crr-pessoas-lista">
                {dados.publicadores.map((p) => (
                  <button
                    key={p.id}
                    className={`crr-pessoa-card ${p.ativo ? '' : 'inativa'}`}
                    onClick={podeEditar ? () => setModalPublicador(p) : undefined}
                  >
                    <div className="crr-pessoa-nome">{p.nome}</div>
                    <div className={`crr-pessoa-tel ${p.telefone ? '' : 'faltando'}`}>
                      {p.telefone ? (
                        <>
                          <Phone size={12} /> {p.telefone}
                        </>
                      ) : (
                        <>
                          <PhoneOff size={12} /> sem telefone
                        </>
                      )}
                    </div>
                    {!p.ativo && <span className="crr-tag-inativo escuro">inativa</span>}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {modalPublicador && (
        <PublicadorModal
          publicador={modalPublicador.id ? modalPublicador : null}
          pontos={dados.pontos}
          onClose={fechar(setModalPublicador)}
        />
      )}
      {modalTurno && (
        <TurnoModal
          ponto={modalTurno.ponto}
          turno={modalTurno.turno}
          publicadores={dados.publicadores}
          onClose={fechar(setModalTurno)}
        />
      )}
      {modalPonto && (
        <PontoModal ponto={modalPonto.id ? modalPonto : null} onClose={fechar(setModalPonto)} />
      )}
    </div>
  );
}
