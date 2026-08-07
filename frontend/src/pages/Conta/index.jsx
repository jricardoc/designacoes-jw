import { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Users,
  Plus,
  Lock,
  KeyRound,
  LogOut,
  MoreVertical,
  Link as LinkIcon,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import AparenciaPanel from '../../components/AparenciaPanel';
import PrivilegioBadge from '../../components/PrivilegioBadge';
import { useToast, ToastContainer } from '../../components/Toast';

function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

const adminBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '5px 11px',
  borderRadius: '999px',
  background: 'var(--t-success-bg)',
  color: 'var(--t-green-dark)',
  fontSize: '0.72rem',
  fontWeight: 700,
  flexShrink: 0,
};
const menuItem = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '11px 14px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--t-border)',
  cursor: 'pointer',
  fontSize: '0.9rem',
  color: 'var(--t-text)',
  textAlign: 'left',
};

export default function Conta() {
  const { usuario, authFetch, logout } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const [nome, setNome] = useState(usuario?.nome || '');
  const [nickname, setNickname] = useState(usuario?.nickname || '');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [showNovo, setShowNovo] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoNickname, setNovoNickname] = useState('');
  const [novoIrmaoId, setNovoIrmaoId] = useState('');
  const [irmaosDisponiveis, setIrmaosDisponiveis] = useState([]);
  const [vinculandoId, setVinculandoId] = useState(null);
  const [menuId, setMenuId] = useState(null);

  useEffect(() => {
    setNome(usuario?.nome || '');
    setNickname(usuario?.nickname || '');
  }, [usuario]);

  const carregarUsuarios = async () => {
    try {
      const res = await authFetch('/usuarios');
      if (res.ok) setUsuarios(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const carregarIrmaosDisponiveis = async (usuarioId = null) => {
    try {
      const qs = usuarioId ? `?usuarioId=${usuarioId}` : '';
      const res = await authFetch(`/usuarios/irmaos-disponiveis${qs}`);
      if (res.ok) setIrmaosDisponiveis(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (usuario?.isAdmin) {
      carregarUsuarios();
      carregarIrmaosDisponiveis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.isAdmin]);

  /** Vincula (irmaoId) ou desvincula (null) a conta ao cadastro de um irmão. */
  const handleVincular = async (usuarioId, irmaoId) => {
    try {
      const res = await authFetch(`/usuarios/${usuarioId}/irmao`, {
        method: 'PUT',
        body: JSON.stringify({ irmaoId: irmaoId === '' ? null : Number(irmaoId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao vincular');

      addToast(irmaoId ? `Vinculado a ${data.irmao?.nome}` : 'Vínculo removido', 'success');
      setVinculandoId(null);
      await carregarUsuarios();
      await carregarIrmaosDisponiveis();
    } catch (e) {
      addToast(e.message || 'Erro ao vincular', 'error');
    }
  };

  const profileDirty =
    nome.trim() !== (usuario?.nome || '') || nickname.trim() !== (usuario?.nickname || '');

  const salvarPerfil = async () => {
    try {
      let changed = false;
      if (nome.trim() !== (usuario?.nome || '')) {
        const r = await authFetch('/auth/nome', { method: 'PUT', body: JSON.stringify({ nome: nome.trim() }) });
        if (!r.ok) throw new Error();
        changed = true;
      }
      if (nickname.trim() !== (usuario?.nickname || '')) {
        const r = await authFetch('/usuarios/nickname', { method: 'PUT', body: JSON.stringify({ nickname: nickname.trim() }) });
        if (!r.ok) throw new Error();
        changed = true;
      }
      if (changed) {
        addToast('Perfil atualizado!', 'success');
        window.location.reload();
      }
    } catch {
      addToast('Erro ao salvar perfil', 'error');
    }
  };

  const handleAlterarSenha = async () => {
    if (!senhaAtual || !novaSenha) return;
    try {
      const res = await authFetch('/auth/senha', { method: 'PUT', body: JSON.stringify({ senhaAtual, novaSenha }) });
      if (res.ok) {
        addToast('Senha alterada com sucesso!', 'success');
        setSenhaAtual('');
        setNovaSenha('');
      } else {
        const d = await res.json();
        addToast(d.error || 'Erro ao alterar senha', 'error');
      }
    } catch {
      addToast('Erro de conexão', 'error');
    }
  };

  const handleCriarUsuario = async () => {
    if (!novoNome.trim() || !novoNickname.trim()) return;
    try {
      const res = await authFetch('/usuarios', {
        method: 'POST',
        body: JSON.stringify({
          nome: novoNome.trim(),
          nickname: novoNickname.trim(),
          irmaoId: novoIrmaoId ? Number(novoIrmaoId) : null,
        }),
      });
      if (res.ok) {
        addToast(`Usuário ${novoNome} criado! Senha: jw1010`, 'success');
        setNovoNome('');
        setNovoNickname('');
        setNovoIrmaoId('');
        setShowNovo(false);
        carregarUsuarios();
        carregarIrmaosDisponiveis();
      } else {
        const d = await res.json();
        addToast(d.error || 'Erro ao criar usuário', 'error');
      }
    } catch {
      addToast('Erro de conexão', 'error');
    }
  };

  const handleToggleAdmin = async (id) => {
    setMenuId(null);
    const res = await authFetch(`/usuarios/${id}/admin`, { method: 'PUT' });
    if (res.ok) {
      addToast('Permissões alteradas!', 'success');
      carregarUsuarios();
    }
  };
  const handleResetSenha = async (id, nm) => {
    setMenuId(null);
    if (!confirm(`Redefinir senha de ${nm} para "jw1010"?`)) return;
    const res = await authFetch(`/usuarios/${id}/reset-senha`, { method: 'PUT' });
    if (res.ok) addToast(`Senha de ${nm} redefinida para jw1010`, 'success');
  };
  const handleDeletar = async (id, nm) => {
    setMenuId(null);
    if (!confirm(`Excluir ${nm}?`)) return;
    const res = await authFetch(`/usuarios/${id}`, { method: 'DELETE' });
    if (res.ok) {
      addToast(`Usuário ${nm} excluído`, 'success');
      carregarUsuarios();
    }
  };

  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <PageHeader title="Conta" description="Perfil e usuários" icon={User} color="olive">
        <button onClick={logout} className="t-btn t-btn-danger"><LogOut size={17} /> Sair</button>
      </PageHeader>

      <div className="t-page">
        <div className="t-two-col">
          {/* Coluna esquerda: perfil + senha */}
          <div className="t-stack">
            <div className="t-card" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '999px', background: 'var(--t-olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 700, color: 'var(--t-surface)', flexShrink: 0 }}>{initials(usuario?.nome)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--t-text)' }}>{usuario?.nome}</span>
                    <PrivilegioBadge privilegio={usuario?.privilegio} />
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--t-muted)', marginTop: '2px' }}>@{usuario?.nickname}</div>
                </div>
                {usuario?.isAdmin && <span style={adminBadge}><Shield size={12} fill="var(--t-green-dark)" /> Admin</span>}
              </div>

              <div className="t-divider" />

              <label className="t-label">Nome</label>
              <div className="t-field">
                <User size={17} className="t-field-icon" color="var(--t-muted)" />
                <input value={nome} onChange={(e) => setNome(e.target.value)} className="t-input" />
              </div>

              <label className="t-label" style={{ marginTop: '1rem' }}>Nickname</label>
              <div className="t-field">
                <span className="t-field-icon" style={{ fontSize: '1rem', fontWeight: 600, color: '#9DA882' }}>@</span>
                <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="t-input" style={{ paddingLeft: '40px' }} />
              </div>

              {profileDirty && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '1.1rem' }}>
                  <button onClick={() => { setNome(usuario?.nome || ''); setNickname(usuario?.nickname || ''); }} className="t-btn t-btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                  <button onClick={salvarPerfil} className="t-btn t-btn-primary" style={{ flex: 1.4 }}>Salvar alterações</button>
                </div>
              )}
            </div>

            <AparenciaPanel />

            <div className="t-card" style={{ padding: '1.4rem' }}>
              <div className="t-panel-title" style={{ marginBottom: '1rem' }}><Lock size={18} color="var(--t-olive)" /> Alterar Senha</div>
              <label className="t-label">Senha atual</label>
              <div className="t-field">
                <Lock size={16} className="t-field-icon" color="var(--t-muted)" />
                <input type={showCur ? 'text' : 'password'} value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} placeholder="••••••••" className="t-input" style={{ paddingRight: '46px' }} />
                <button onClick={() => setShowCur((s) => !s)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>{showCur ? <EyeOff size={18} color="var(--t-muted)" /> : <Eye size={18} color="var(--t-muted)" />}</button>
              </div>
              <label className="t-label" style={{ marginTop: '1rem' }}>Nova senha</label>
              <div className="t-field">
                <KeyRound size={16} className="t-field-icon" color="var(--t-muted)" />
                <input type={showNew ? 'text' : 'password'} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo de 6 caracteres" className="t-input" style={{ paddingRight: '46px' }} />
                <button onClick={() => setShowNew((s) => !s)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>{showNew ? <EyeOff size={18} color="var(--t-muted)" /> : <Eye size={18} color="var(--t-muted)" />}</button>
              </div>
              <button onClick={handleAlterarSenha} className="t-btn t-btn-primary" style={{ width: '100%', height: '50px', marginTop: '1.1rem' }}>Alterar Senha</button>
            </div>
          </div>

          {/* Coluna direita: usuários */}
          {usuario?.isAdmin ? (
            <div className="t-card" style={{ padding: '1.4rem 1.2rem 0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="t-panel-title"><Users size={19} color="var(--t-olive)" /> Usuários</div>
                <button onClick={() => setShowNovo((s) => !s)} className="t-btn t-btn-primary" style={{ height: '36px', padding: '0 14px', fontSize: '0.82rem' }}>
                  {showNovo ? <X size={14} /> : <Plus size={14} />} {showNovo ? 'Fechar' : 'Novo'}
                </button>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--t-muted)', marginTop: '5px' }}>{usuarios.length} usuário(s)</div>

              {showNovo && (
                <div style={{ background: 'var(--t-surface-muted)', borderRadius: '14px', padding: '14px', marginTop: '12px' }}>
                  <input placeholder="Nome completo" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="t-input" style={{ marginBottom: '10px' }} />
                  <input placeholder="Nickname (para login)" value={novoNickname} onChange={(e) => setNovoNickname(e.target.value)} className="t-input" />

                  <label className="t-label" style={{ marginTop: '12px', display: 'block' }}>
                    Sincronizar com um irmão cadastrado
                  </label>
                  <select
                    value={novoIrmaoId}
                    onChange={(e) => setNovoIrmaoId(e.target.value)}
                    className="t-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">Não vincular por enquanto</option>
                    {irmaosDisponiveis.filter((i) => i.disponivel).map((i) => (
                      <option key={i.id} value={i.id}>{i.nome}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.75rem', color: 'var(--t-muted)', margin: '6px 0 0', lineHeight: 1.45 }}>
                    O vínculo é o que faz as designações do irmão aparecerem em "Minhas Designações".
                  </p>

                  <button onClick={handleCriarUsuario} className="t-btn t-btn-primary" style={{ width: '100%', marginTop: '12px' }}>Criar Usuário</button>
                </div>
              )}

              <div style={{ marginTop: '6px' }}>
                {usuarios.map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 2px', borderTop: '1px solid var(--t-border)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '999px', background: 'var(--t-sand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--t-brown)', flexShrink: 0 }}>{initials(u.nome)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.93rem', fontWeight: 600, color: 'var(--t-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nome}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--t-muted)' }}>@{u.nickname}</span>
                        <PrivilegioBadge privilegio={u.privilegio} tamanho="sm" abreviado />
                        {!u.irmaoId && (
                          <span
                            title="Sem vínculo, este irmão não consegue ver as próprias designações"
                            style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--t-amber)', background: 'var(--t-warning-bg)', borderRadius: '999px', padding: '3px 8px' }}
                          >
                            Sem irmão vinculado
                          </span>
                        )}
                      </div>
                    </div>
                    {u.isAdmin && <span style={{ ...adminBadge, padding: '4px 9px', fontSize: '0.66rem' }}><Shield size={10} fill="var(--t-green-dark)" /> Admin</span>}
                    {u.id === usuario?.id ? (
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--t-muted)', paddingRight: '2px' }}>Você</span>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setMenuId(menuId === u.id ? null : u.id)} style={{ width: '34px', height: '34px', borderRadius: '11px', border: '1px solid var(--t-border)', background: 'var(--t-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <MoreVertical size={16} color="var(--t-muted)" />
                        </button>
                        {menuId === u.id && (
                          <div style={{ position: 'absolute', right: 0, top: '40px', background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: '12px', boxShadow: '0 10px 24px rgba(43,38,32,0.12)', zIndex: 20, overflow: 'hidden', minWidth: '170px' }}>
                            <button
                              onClick={() => { setMenuId(null); setVinculandoId(u.id); carregarIrmaosDisponiveis(u.id); }}
                              style={menuItem}
                            >
                              <LinkIcon size={15} /> {u.irmaoId ? 'Alterar irmão' : 'Vincular a irmão'}
                            </button>
                            <button onClick={() => handleToggleAdmin(u.id)} style={menuItem}><Shield size={15} /> {u.isAdmin ? 'Remover admin' : 'Tornar admin'}</button>
                            <button onClick={() => handleResetSenha(u.id, u.nome)} style={menuItem}><KeyRound size={15} /> Redefinir senha</button>
                            <button onClick={() => handleDeletar(u.id, u.nome)} style={{ ...menuItem, color: 'var(--t-red-dark)', borderBottom: 'none' }}><X size={15} /> Excluir</button>
                          </div>
                        )}
                      </div>
                    )}

                    {vinculandoId === u.id && (
                      <div style={{ position: 'absolute', right: 0, top: '40px', background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: '12px', boxShadow: '0 10px 24px rgba(43,38,32,0.12)', zIndex: 30, padding: '12px', minWidth: '260px' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--t-text-2)', marginBottom: '8px' }}>
                          Vincular {u.nome} a:
                        </div>
                        <select
                          defaultValue={u.irmaoId || ''}
                          onChange={(e) => handleVincular(u.id, e.target.value)}
                          className="t-input"
                          style={{ width: '100%' }}
                        >
                          <option value="">— sem vínculo —</option>
                          {irmaosDisponiveis.map((i) => (
                            <option key={i.id} value={i.id} disabled={!i.disponivel}>
                              {i.nome}{!i.disponivel ? ` (já é ${i.vinculadoA?.nickname})` : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setVinculandoId(null)}
                          className="t-btn t-btn-secondary"
                          style={{ width: '100%', marginTop: '8px' }}
                        >
                          Fechar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
