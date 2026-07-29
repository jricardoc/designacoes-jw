import { useState } from 'react';
import { X, Check, Trash2, Phone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Cadastro de quem serve no carrinho.
 *
 * É um cadastro próprio, separado do de irmãos das Configurações: a maioria são
 * irmãs, o vínculo não tem relação com funções de reunião, e quem cuida do
 * carrinho mantém essa lista sozinho.
 *
 * O telefone é opcional aqui, mas é ele que a automação de lembretes vai usar —
 * por isso a tela sinaliza quem ainda está sem.
 */
export default function PublicadorModal({ publicador, pontos, onClose }) {
  const { authFetch } = useAuth();
  const editando = Boolean(publicador?.id);

  const [nome, setNome] = useState(publicador?.nome || '');
  const [telefone, setTelefone] = useState(publicador?.telefone || '');
  const [ativo, setAtivo] = useState(publicador?.ativo ?? true);
  const [turnoIds, setTurnoIds] = useState(() => {
    const ids = new Set();
    (pontos || []).forEach((p) =>
      p.turnos.forEach((t) => {
        if (t.publicadores.some((x) => x.id === publicador?.id)) ids.add(t.id);
      }),
    );
    return ids;
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const alternarTurno = (id) =>
    setTurnoIds((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const salvar = async () => {
    if (!nome.trim()) {
      setErro('O nome é obrigatório');
      return;
    }
    setSalvando(true);
    setErro('');

    try {
      const corpo = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        turnoIds: [...turnoIds],
        ...(editando ? { ativo } : {}),
      };
      const res = await authFetch(
        editando ? `/carrinho/publicadores/${publicador.id}` : '/carrinho/publicadores',
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
    if (!confirm(`Excluir ${publicador.nome} do carrinho? Ela sai de todos os turnos.`)) return;
    try {
      const res = await authFetch(`/carrinho/publicadores/${publicador.id}`, { method: 'DELETE' });
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
          <h2>{editando ? 'Editar pessoa' : 'Nova pessoa'}</h2>
          <button onClick={() => onClose(false)} className="crr-btn-fechar">
            <X size={20} />
          </button>
        </div>

        <div className="crr-modal-corpo">
          <label className="crr-label">Nome</label>
          <input
            className="crr-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome completo"
            autoFocus
          />

          <label className="crr-label" style={{ marginTop: '1rem' }}>
            <Phone size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Telefone
          </label>
          <input
            className="crr-input"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(71) 90000-0000"
          />
          <p className="crr-ajuda">
            Usado pelo lembrete automático de WhatsApp. Pode deixar em branco por enquanto.
          </p>

          {editando && (
            <label className="crr-check-linha" style={{ marginTop: '1rem' }}>
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
              <span>
                Ativa
                <em className="crr-ajuda-inline">
                  {' '}
                  — quem está inativa continua na grade, mas não recebe lembrete
                </em>
              </span>
            </label>
          )}

          <label className="crr-label" style={{ marginTop: '1.25rem' }}>
            Turnos ({turnoIds.size} selecionado{turnoIds.size === 1 ? '' : 's'})
          </label>
          <div className="crr-turnos-escolha">
            {(pontos || []).map((ponto) => (
              <div key={ponto.id} className="crr-turnos-ponto">
                <div className="crr-turnos-ponto-nome" style={{ borderLeftColor: ponto.cor }}>
                  {ponto.nome}
                </div>
                {ponto.turnos.length === 0 ? (
                  <span className="crr-ajuda">Sem turnos cadastrados.</span>
                ) : (
                  <div className="crr-turnos-chips">
                    {ponto.turnos.map((t) => {
                      const marcado = turnoIds.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => alternarTurno(t.id)}
                          className={`crr-chip ${marcado ? 'ativo' : ''}`}
                          style={marcado ? { background: ponto.cor, borderColor: ponto.cor } : undefined}
                        >
                          {DIAS_CURTOS[t.diaSemana]} {t.horaInicio}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
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
