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
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
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
  background: '#E2E7D2',
  color: '#54622F',
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
  borderBottom: '1px solid #F1EAD9',
  cursor: 'pointer',
  fontSize: '0.9rem',
  color: '#2B2620',
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

  useEffect(() => {
    if (usuario?.isAdmin) carregarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.isAdmin]);

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
      const res = await authFetch('/usuarios', { method: 'POST', body: JSON.stringify({ nome: novoNome.trim(), nickname: novoNickname.trim() }) });
      if (res.ok) {
        addToast(`Usuário ${novoNome} criado! Senha: jw1010`, 'success');
        setNovoNome('');
        setNovoNickname('');
        setShowNovo(false);
        carregarUsuarios();
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
                <div style={{ width: '60px', height: '60px', borderRadius: '999px', background: '#6E7B57', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 700, color: '#FBF7EF', flexShrink: 0 }}>{initials(usuario?.nome)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#2B2620' }}>{usuario?.nome}</div>
                  <div style={{ fontSize: '0.85rem', color: '#A2977F', marginTop: '2px' }}>@{usuario?.nickname}</div>
                </div>
                {usuario?.isAdmin && <span style={adminBadge}><Shield size={12} fill="#54622F" /> Admin</span>}
              </div>

              <div className="t-divider" />

              <label className="t-label">Nome</label>
              <div className="t-field">
                <User size={17} className="t-field-icon" color="#B0A488" />
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

            <div className="t-card" style={{ padding: '1.4rem' }}>
              <div className="t-panel-title" style={{ marginBottom: '1rem' }}><Lock size={18} color="#6E7B57" /> Alterar Senha</div>
              <label className="t-label">Senha atual</label>
              <div className="t-field">
                <Lock size={16} className="t-field-icon" color="#B0A488" />
                <input type={showCur ? 'text' : 'password'} value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} placeholder="••••••••" className="t-input" style={{ paddingRight: '46px' }} />
                <button onClick={() => setShowCur((s) => !s)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>{showCur ? <EyeOff size={18} color="#9C927E" /> : <Eye size={18} color="#9C927E" />}</button>
              </div>
              <label className="t-label" style={{ marginTop: '1rem' }}>Nova senha</label>
              <div className="t-field">
                <KeyRound size={16} className="t-field-icon" color="#B0A488" />
                <input type={showNew ? 'text' : 'password'} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo de 6 caracteres" className="t-input" style={{ paddingRight: '46px' }} />
                <button onClick={() => setShowNew((s) => !s)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>{showNew ? <EyeOff size={18} color="#9C927E" /> : <Eye size={18} color="#9C927E" />}</button>
              </div>
              <button onClick={handleAlterarSenha} className="t-btn t-btn-primary" style={{ width: '100%', height: '50px', marginTop: '1.1rem' }}>Alterar Senha</button>
            </div>
          </div>

          {/* Coluna direita: usuários */}
          {usuario?.isAdmin ? (
            <div className="t-card" style={{ padding: '1.4rem 1.2rem 0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="t-panel-title"><Users size={19} color="#6E7B57" /> Usuários</div>
                <button onClick={() => setShowNovo((s) => !s)} className="t-btn t-btn-primary" style={{ height: '36px', padding: '0 14px', fontSize: '0.82rem' }}>
                  {showNovo ? <X size={14} /> : <Plus size={14} />} {showNovo ? 'Fechar' : 'Novo'}
                </button>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#A2977F', marginTop: '5px' }}>{usuarios.length} usuário(s)</div>

              {showNovo && (
                <div style={{ background: '#F6F0E4', borderRadius: '14px', padding: '14px', marginTop: '12px' }}>
                  <input placeholder="Nome completo" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="t-input" style={{ marginBottom: '10px' }} />
                  <input placeholder="Nickname (para login)" value={novoNickname} onChange={(e) => setNovoNickname(e.target.value)} className="t-input" />
                  <button onClick={handleCriarUsuario} className="t-btn t-btn-primary" style={{ width: '100%', marginTop: '12px' }}>Criar Usuário</button>
                </div>
              )}

              <div style={{ marginTop: '6px' }}>
                {usuarios.map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 2px', borderTop: '1px solid #F1EAD9' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '999px', background: '#EDE6D5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#9A7E55', flexShrink: 0 }}>{initials(u.nome)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.93rem', fontWeight: 600, color: '#2B2620', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nome}</div>
                      <div style={{ fontSize: '0.78rem', color: '#A2977F' }}>@{u.nickname}</div>
                    </div>
                    {u.isAdmin && <span style={{ ...adminBadge, padding: '4px 9px', fontSize: '0.66rem' }}><Shield size={10} fill="#54622F" /> Admin</span>}
                    {u.id === usuario?.id ? (
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#B0A488', paddingRight: '2px' }}>Você</span>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setMenuId(menuId === u.id ? null : u.id)} style={{ width: '34px', height: '34px', borderRadius: '11px', border: '1px solid #ECE3D3', background: '#FBF7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <MoreVertical size={16} color="#9A8F7D" />
                        </button>
                        {menuId === u.id && (
                          <div style={{ position: 'absolute', right: 0, top: '40px', background: '#FBF7EF', border: '1px solid #ECE3D3', borderRadius: '12px', boxShadow: '0 10px 24px rgba(43,38,32,0.12)', zIndex: 20, overflow: 'hidden', minWidth: '170px' }}>
                            <button onClick={() => handleToggleAdmin(u.id)} style={menuItem}><Shield size={15} /> {u.isAdmin ? 'Remover admin' : 'Tornar admin'}</button>
                            <button onClick={() => handleResetSenha(u.id, u.nome)} style={menuItem}><KeyRound size={15} /> Redefinir senha</button>
                            <button onClick={() => handleDeletar(u.id, u.nome)} style={{ ...menuItem, color: '#9A4632', borderBottom: 'none' }}><X size={15} /> Excluir</button>
                          </div>
                        )}
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
