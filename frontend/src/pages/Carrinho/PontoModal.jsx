import { useState } from 'react';
import { X, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/** Cores das planilhas de origem, mais algumas para pontos novos. */
const CORES = ['#D9822B', '#8064A2', '#C0504D', '#77933C', 'var(--t-teal)', 'var(--t-amber)', 'var(--t-primary)', 'var(--t-terracotta)'];

export default function PontoModal({ ponto, onClose }) {
  const { authFetch } = useAuth();
  const editando = Boolean(ponto?.id);

  const [nome, setNome] = useState(ponto?.nome || '');
  const [cor, setCor] = useState(ponto?.cor || CORES[0]);
  const [ativo, setAtivo] = useState(ponto?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const salvar = async () => {
    if (!nome.trim()) {
      setErro('O nome do ponto é obrigatório');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const res = await authFetch(
        editando ? `/carrinho/pontos/${ponto.id}` : '/carrinho/pontos',
        {
          method: editando ? 'PUT' : 'POST',
          body: JSON.stringify({ nome: nome.trim(), cor, ...(editando ? { ativo } : {}) }),
        },
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
    if (
      !confirm(
        `Excluir o ponto "${ponto.nome}"? Os turnos dele somem junto. As pessoas continuam cadastradas.`,
      )
    )
      return;
    try {
      const res = await authFetch(`/carrinho/pontos/${ponto.id}`, { method: 'DELETE' });
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
      <div className="crr-modal" style={{ maxWidth: '440px' }}>
        <div className="crr-modal-topo">
          <h2>{editando ? 'Editar ponto' : 'Novo ponto'}</h2>
          <button onClick={() => onClose(false)} className="crr-btn-fechar">
            <X size={20} />
          </button>
        </div>

        <div className="crr-modal-corpo">
          <label className="crr-label">Nome do ponto</label>
          <input
            className="crr-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Mussurunga - Miguel"
            autoFocus
          />

          <label className="crr-label" style={{ marginTop: '1rem' }}>Cor</label>
          <div className="crr-cores">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                className={`crr-cor ${cor === c ? 'ativa' : ''}`}
                style={{ background: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>

          {editando && (
            <label className="crr-check-linha" style={{ marginTop: '1.25rem' }}>
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
              <span>
                Ativo
                <em className="crr-ajuda-inline"> — pontos inativos saem da agenda de lembretes</em>
              </span>
            </label>
          )}

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
