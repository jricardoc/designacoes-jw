import { useState } from 'react';
import { X, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/**
 * Cria ou edita um turno — um horário fixo semanal de um ponto — e define quem serve nele.
 *
 * Os turnos do carrinho se repetem toda semana, então aqui não existe data: só
 * dia da semana e faixa de horário.
 */
export default function TurnoModal({ ponto, turno, publicadores, onClose }) {
  const { authFetch } = useAuth();
  const editando = Boolean(turno?.id);

  const [diaSemana, setDiaSemana] = useState(turno?.diaSemana ?? 2);
  const [horaInicio, setHoraInicio] = useState(turno?.horaInicio || '06:00');
  const [horaFim, setHoraFim] = useState(turno?.horaFim || '08:00');
  const [selecionados, setSelecionados] = useState(
    () => new Set((turno?.publicadores || []).map((p) => p.id)),
  );
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const alternar = (id) =>
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const lista = (publicadores || []).filter((p) =>
    p.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try {
      const corpo = {
        diaSemana,
        horaInicio,
        horaFim,
        publicadorIds: [...selecionados],
        ...(editando ? {} : { pontoId: ponto.id }),
      };
      const res = await authFetch(
        editando ? `/carrinho/turnos/${turno.id}` : '/carrinho/turnos',
        { method: editando ? 'PUT' : 'POST', body: JSON.stringify(corpo) },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      onClose(true);
    } catch (e) {
      setErro(e.message);
    }
    setSalvando(false);
  };

  const excluir = async () => {
    if (!confirm('Excluir este turno? As pessoas continuam cadastradas.')) return;
    try {
      const res = await authFetch(`/carrinho/turnos/${turno.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao excluir');
      }
      onClose(true);
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <div className="crr-modal-fundo">
      <div className="crr-modal">
        <div className="crr-modal-topo">
          <div>
            <h2>{editando ? 'Editar turno' : 'Novo turno'}</h2>
            <span className="crr-modal-sub" style={{ color: ponto.cor }}>{ponto.nome}</span>
          </div>
          <button onClick={() => onClose(false)} className="crr-btn-fechar">
            <X size={20} />
          </button>
        </div>

        <div className="crr-modal-corpo">
          <label className="crr-label">Dia da semana</label>
          <select
            className="crr-input"
            value={diaSemana}
            onChange={(e) => setDiaSemana(Number(e.target.value))}
          >
            {DIAS.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
            <div>
              <label className="crr-label">Início</label>
              <input
                type="time"
                className="crr-input"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="crr-label">Término</label>
              <input
                type="time"
                className="crr-input"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
              />
            </div>
          </div>

          <label className="crr-label" style={{ marginTop: '1.25rem' }}>
            Quem serve ({selecionados.size})
          </label>
          <input
            className="crr-input"
            placeholder="Buscar pessoa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <div className="crr-pessoas-escolha">
            {lista.length === 0 ? (
              <span className="crr-ajuda">Ninguém encontrado.</span>
            ) : (
              lista.map((p) => {
                const marcado = selecionados.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => alternar(p.id)}
                    className={`crr-chip ${marcado ? 'ativo' : ''}`}
                    style={marcado ? { background: ponto.cor, borderColor: ponto.cor } : undefined}
                  >
                    {p.nome}
                  </button>
                );
              })
            )}
          </div>

          {erro && <div className="crr-erro">{erro}</div>}
        </div>

        <div className="crr-modal-acoes">
          {editando && (
            <button onClick={excluir} className="crr-btn crr-btn-perigo">
              <Trash2 size={16} /> Excluir
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={() => onClose(false)} className="crr-btn crr-btn-neutro">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando} className="crr-btn crr-btn-primario">
            <Check size={16} /> {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
