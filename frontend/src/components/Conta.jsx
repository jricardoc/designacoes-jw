import { useState, useEffect } from 'react';
import { User, Shield, Users, Plus, Trash2, Key, Crown, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PageHeader from './PageHeader';
import { useToast, ToastContainer } from './Toast';
import './Conta.css';

export default function Conta() {
  const { usuario, authFetch, logout } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  
  const [nickname, setNickname] = useState(usuario?.nickname || '');
  const [nome, setNome] = useState(usuario?.nome || '');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [showNovoUsuario, setShowNovoUsuario] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoNickname, setNovoNickname] = useState('');

  // Carregar usuarios se for admin
  useEffect(() => {
    if (usuario?.isAdmin) {
      carregarUsuarios();
    }
  }, [usuario?.isAdmin]);

  const carregarUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const response = await authFetch('/usuarios');
      if (response.ok) {
        const data = await response.json();
        setUsuarios(data);
      }
    } catch (error) {
      console.error('Erro ao carregar usuarios:', error);
    }
    setLoadingUsuarios(false);
  };

  const handleAlterarNickname = async (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    try {
      const response = await authFetch('/usuarios/nickname', {
        method: 'PUT',
        body: JSON.stringify({ nickname: nickname.trim() })
      });

      if (response.ok) {
        addToast('Nickname alterado com sucesso!', 'success');
      } else {
        const data = await response.json();
        addToast(data.error || 'Erro ao alterar nickname', 'error');
      }
    } catch (error) {
      addToast('Erro de conexão', 'error');
    }
  };

  const handleAlterarNome = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return;

    try {
      const response = await authFetch('/auth/nome', {
        method: 'PUT',
        body: JSON.stringify({ nome: nome.trim() })
      });

      if (response.ok) {
        addToast('Nome alterado com sucesso!', 'success');
        // Atualizar o contexto do usuário
        window.location.reload();
      } else {
        const data = await response.json();
        addToast(data.error || 'Erro ao alterar nome', 'error');
      }
    } catch (error) {
      addToast('Erro de conexão', 'error');
    }
  };

  const handleAlterarSenha = async (e) => {
    e.preventDefault();
    if (!senhaAtual || !novaSenha) return;

    try {
      const response = await authFetch('/auth/senha', {
        method: 'PUT',
        body: JSON.stringify({ senhaAtual, novaSenha })
      });

      if (response.ok) {
        addToast('Senha alterada com sucesso!', 'success');
        setSenhaAtual('');
        setNovaSenha('');
      } else {
        const data = await response.json();
        addToast(data.error || 'Erro ao alterar senha', 'error');
      }
    } catch (error) {
      addToast('Erro de conexão', 'error');
    }
  };

  const handleCriarUsuario = async (e) => {
    e.preventDefault();
    if (!novoNome.trim() || !novoNickname.trim()) return;

    try {
      const response = await authFetch('/usuarios', {
        method: 'POST',
        body: JSON.stringify({ nome: novoNome.trim(), nickname: novoNickname.trim() })
      });

      if (response.ok) {
        addToast(`Usuário ${novoNome} criado! Senha: jw1010`, 'success');
        setNovoNome('');
        setNovoNickname('');
        setShowNovoUsuario(false);
        carregarUsuarios();
      } else {
        const data = await response.json();
        addToast(data.error || 'Erro ao criar usuário', 'error');
      }
    } catch (error) {
      addToast('Erro de conexão', 'error');
    }
  };

  const handleToggleAdmin = async (id) => {
    try {
      const response = await authFetch(`/usuarios/${id}/admin`, { method: 'PUT' });
      
      if (response.ok) {
        addToast('Permissões alteradas!', 'success');
        carregarUsuarios();
      } else {
        const data = await response.json();
        addToast(data.error || 'Erro ao alterar permissões', 'error');
      }
    } catch (error) {
      addToast('Erro de conexão', 'error');
    }
  };

  const handleResetSenha = async (id, nome) => {
    if (!confirm(`Resetar senha de ${nome} para "jw1010"?`)) return;

    try {
      const response = await authFetch(`/usuarios/${id}/reset-senha`, { method: 'PUT' });
      
      if (response.ok) {
        addToast(`Senha de ${nome} resetada para jw1010`, 'success');
      } else {
        const data = await response.json();
        addToast(data.error || 'Erro ao resetar senha', 'error');
      }
    } catch (error) {
      addToast('Erro de conexão', 'error');
    }
  };

  const handleDeletarUsuario = async (id, nome) => {
    if (!confirm(`Tem certeza que deseja excluir ${nome}?`)) return;

    try {
      const response = await authFetch(`/usuarios/${id}`, { method: 'DELETE' });
      
      if (response.ok) {
        addToast(`Usuário ${nome} excluído`, 'success');
        carregarUsuarios();
      } else {
        const data = await response.json();
        addToast(data.error || 'Erro ao excluir usuário', 'error');
      }
    } catch (error) {
      addToast('Erro de conexão', 'error');
    }
  };

  return (
    <div className="conta-container">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <PageHeader
        title="Minha Conta"
        description="Gerencie suas informações"
        icon={User}
        color="purple"
      />

      <div className="conta-content">
        <div className={`conta-grid ${usuario?.isAdmin ? 'admin-view' : ''}`}>
          
          {/* Card de Perfil */}
          <div className="conta-card">
            <h3 className="conta-title">
              <User size={20} /> Perfil
            </h3>

            {/* Info */}
            <div className="conta-info-box">
              <div className="conta-info-nome">{usuario?.nome}</div>
              <div className="conta-info-nick">@{usuario?.nickname}</div>
              {usuario?.isAdmin && (
                <span className="conta-badge-admin">
                  <Crown size={12} /> Admin
                </span>
              )}
            </div>

            {/* Alterar Nome */}
            <form onSubmit={handleAlterarNome} style={{ marginBottom: '1.5rem' }}>
              <label className="conta-form-label">
                Alterar Nome
              </label>
              <div className="conta-input-group">
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className="conta-input"
                />
                <button type="submit" className="conta-btn-purple">
                  Salvar
                </button>
              </div>
            </form>

            {/* Alterar Nome de usuário */}
            <form onSubmit={handleAlterarNickname} style={{ marginBottom: '1.5rem' }}>
              <label className="conta-form-label">
                Alterar Nome de usuário
              </label>
              <div className="conta-input-group">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Nome para login"
                  className="conta-input"
                />
                <button type="submit" className="conta-btn-blue">
                  Salvar
                </button>
              </div>
            </form>

            {/* Alterar Senha */}
            <form onSubmit={handleAlterarSenha}>
              <label className="conta-form-label">
                Alterar Senha
              </label>
              <input
                type="password"
                placeholder="Senha atual"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                className="conta-input-block"
              />
              <input
                type="password"
                placeholder="Nova senha"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="conta-input-block"
                style={{ marginBottom: '0.75rem' }}
              />
              <button type="submit" className="conta-btn-green">
                Alterar Senha
              </button>
            </form>
          </div>

            {/* Card de Gerenciamento de Usuários (Admin) */}
          {usuario?.isAdmin && (
            <div className="conta-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="conta-title" style={{ margin: 0 }}>
                  <Users size={20} /> Usuários
                </h3>
                <button
                  onClick={() => setShowNovoUsuario(!showNovoUsuario)}
                  className="novo-usuario-btn"
                  style={{ background: showNovoUsuario ? '#ef4444' : '#3b82f6' }}
                >
                  {showNovoUsuario ? <X size={16} /> : <Plus size={16} />}
                  {showNovoUsuario ? 'Cancelar' : 'Novo'}
                </button>
              </div>

              {/* Form novo usuario */}
              {showNovoUsuario && (
                <form onSubmit={handleCriarUsuario} style={{
                  padding: '1rem',
                  background: '#f0fdf4',
                  borderRadius: '10px',
                  marginBottom: '1rem'
                }}>
                  <input
                    type="text"
                    placeholder="Nome completo"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    className="conta-input-block"
                  />
                  <input
                    type="text"
                    placeholder="Nome de usuário (para login)"
                    value={novoNickname}
                    onChange={(e) => setNovoNickname(e.target.value)}
                    className="conta-input-block"
                    style={{ marginBottom: '0.75rem' }}
                  />
                  <button type="submit" className="conta-btn-green">
                    Criar (senha: jw1010)
                  </button>
                </form>
              )}

              {/* Lista de usuarios */}
              <div style={{ maxHeight: '350px', overflow: 'auto' }}>
                {loadingUsuarios ? (
                  <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Carregando...</div>
                ) : (
                  usuarios.map(u => (
                    <div key={u.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      borderBottom: '1px solid #f1f5f9'
                    }}>
                      <div>
                        <div style={{ fontWeight: '500', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {u.nome}
                          {u.isAdmin && <Crown size={14} color="#f59e0b" />}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>@{u.nickname}</div>
                      </div>
                      
                      {u.id !== usuario?.id && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            onClick={() => handleToggleAdmin(u.id)}
                            title={u.isAdmin ? 'Remover admin' : 'Promover a admin'}
                            className={u.isAdmin ? 'icon-btn icon-btn-shield-active' : 'icon-btn icon-btn-shield'}
                          >
                            <Shield size={16} color={u.isAdmin ? '#f59e0b' : '#64748b'} />
                          </button>
                          <button
                            onClick={() => handleResetSenha(u.id, u.nome)}
                            title="Resetar senha"
                            className="icon-btn icon-btn-key"
                          >
                            <Key size={16} color="#64748b" />
                          </button>
                          <button
                            onClick={() => handleDeletarUsuario(u.id, u.nome)}
                            title="Excluir usuário"
                            className="icon-btn icon-btn-delete"
                          >
                            <Trash2 size={16} color="#dc2626" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Botao Logout */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            onClick={logout}
            className="conta-btn-red"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}

