import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';
import './TabelaPagina.css';

const CORES_FUNCAO = {
  'Microfone Volante': '#1e40af',
  'Indicador': '#3b82f6',
  'Audio e Video': '#60a5fa'
};

// Ordem correta das funcoes
const ORDEM_FUNCAO = ['Microfone Volante', 'Indicador', 'Audio e Video'];

const FUNCAO_MAP = {
  'Microfone Volante': 'microfone',
  'Indicador': 'indicador',
  'Audio e Video': 'audioVideo'
};

const MESES_CURTO = ['', 'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 
                     'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const MESES_LONGO = ['', 'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
                     'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

export default function TabelaQuadro({ dados, quadro, updateDesignacao, onHistoricoUpdate, onDeleteDia, id }) {
  const { authFetch } = useAuth();
  const [editingCell, setEditingCell] = useState(null);
  const [irmaos, setIrmaos] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, irmaoNome: '', pendingChange: null });
  
  const mes = MESES_CURTO[quadro?.mes] || 'JAN';
  const mesLongo = MESES_LONGO[quadro?.mes] || 'JANEIRO';

  // Titulo e subtitulo padrao
  const titulo = `Quadro de Designações ${mesLongo} ${quadro?.ano || 2026}`;
  const subtitulo = 'Congregação Norte de Itapuã';

  // Carregar irmaos do backend
  useEffect(() => {
    const carregarIrmaos = async () => {
      try {
        const response = await authFetch('/irmaos');
        const data = await response.json();
        setIrmaos(data);
      } catch (error) {
        console.error('Erro ao carregar irmaos:', error);
      }
    };
    carregarIrmaos();
  }, []);

  // Ordenar funcoes na ordem correta
  const ordenarFuncoes = (funcoes) => {
    return [...funcoes].sort((a, b) => {
      const idxA = ORDEM_FUNCAO.indexOf(a.funcao);
      const idxB = ORDEM_FUNCAO.indexOf(b.funcao);
      return idxA - idxB;
    });
  };

  // Verificar se irmao esta indisponivel na data
  const isIndisponivel = (nomeIrmao, data) => {
    const irmao = irmaos.find(i => i.nome === nomeIrmao);
    if (!irmao) return false;
    return irmao.indisponibilidades?.some(ind => ind.data === data) || false;
  };

  // Verificar se irmao esta em designacao seguida (na data anterior ou posterior)
  const isDesignacaoSeguida = (nomeIrmao, dataAtual) => {
    if (!nomeIrmao || !dados) return false;
    
    // Encontrar indice do dia atual
    const indiceAtual = dados.findIndex(d => d.data === dataAtual);
    if (indiceAtual === -1) return false;
    
    // Verificar dia anterior
    if (indiceAtual > 0) {
      const diaAnterior = dados[indiceAtual - 1];
      const temNoAnterior = diaAnterior.funcoes.some(f => 
        f.irmao1 === nomeIrmao || f.irmao2 === nomeIrmao
      );
      if (temNoAnterior) return true;
    }
    
    // Verificar dia posterior
    if (indiceAtual < dados.length - 1) {
      const diaPosterior = dados[indiceAtual + 1];
      const temNoPosterior = diaPosterior.funcoes.some(f => 
        f.irmao1 === nomeIrmao || f.irmao2 === nomeIrmao
      );
      if (temNoPosterior) return true;
    }
    
    return false;
  };

  // Obter irmaos disponiveis para uma funcao
  const getIrmaosParaFuncao = (funcao) => {
    const funcaoId = FUNCAO_MAP[funcao] || 'microfone';
    return irmaos
      .filter(i => i.ativo && i.funcoes.includes(funcaoId))
      .map(i => i.nome)
      .sort();
  };

  // Handler de selecao - SEM onBlur para evitar conflito
  const handleSelectChange = async (e, data, funcao, campo, valorAtual) => {
    const novoValor = e.target.value;
    
    if (novoValor === valorAtual) {
      setEditingCell(null);
      return;
    }

    // Verificar se eh designacao seguida
    if (novoValor && isDesignacaoSeguida(novoValor, data)) {
      // Armazenar a mudanca pendente e abrir modal
      setConfirmModal({
        isOpen: true,
        irmaoNome: novoValor,
        pendingChange: { data, funcao, campo, novoValor }
      });
      return;
    }

    // Fechar o select primeiro
    setEditingCell(null);
    
    // Salvar a alteracao
    await updateDesignacao(data, funcao, campo, novoValor);
    
    // Notificar para atualizar historico
    if (onHistoricoUpdate) {
      onHistoricoUpdate();
    }
  };

  // Confirmar atribuicao de irmao seguido
  const handleConfirmSeguida = async () => {
    const { pendingChange } = confirmModal;
    if (pendingChange) {
      setEditingCell(null);
      await updateDesignacao(pendingChange.data, pendingChange.funcao, pendingChange.campo, pendingChange.novoValor);
      if (onHistoricoUpdate) onHistoricoUpdate();
    }
    setConfirmModal({ isOpen: false, irmaoNome: '', pendingChange: null });
  };

  // Cancelar atribuicao
  const handleCancelSeguida = () => {
    setEditingCell(null);
    setConfirmModal({ isOpen: false, irmaoNome: '', pendingChange: null });
  };

  // Estilo do nome exibido
  const getNomeStyle = (nomeIrmao, data) => {
    if (!nomeIrmao || nomeIrmao === '-') return {};
    
    const indisponivel = isIndisponivel(nomeIrmao, data);
    const seguida = isDesignacaoSeguida(nomeIrmao, data);
    
    if (indisponivel) {
      return { color: '#dc2626', textDecoration: 'line-through' };
    }
    if (seguida) {
      return { color: '#b45309', background: '#fef3c7', borderRadius: '4px', padding: '2px 6px' };
    }
    return {};
  };

  return (
    <>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={handleCancelSeguida}
        onConfirm={handleConfirmSeguida}
        title="Designação Seguida"
        message={`${confirmModal.irmaoNome} já está em uma designação próxima a esta data. Deseja continuar mesmo assim?`}
        type="warning"
        confirmText="Continuar"
        cancelText="Cancelar"
      />
      
      <div id={id} className="tabela-pagina-container">
        {/* Header */}
        <div className="tabela-pagina-header">
          <h2 className="tabela-pagina-titulo">{titulo}</h2>
          <p className="tabela-pagina-subtitulo">{subtitulo}</p>
        </div>
      
      {/* Header da tabela */}
      <div className="tabela-pagina-thead">
        <div className="th-cell th-data">Data</div>
        <div className="th-cell th-dia">Dia</div>
        <div className="th-cell th-funcao">Função</div>
        <div className="th-cell th-irmao">Irmão 01</div>
        <div className="th-cell th-irmao">Irmão 02</div>
      </div>

      {/* Conteudo */}
      {dados.map((diaData, diaIndex) => {
        const funcoesOrdenadas = ordenarFuncoes(diaData.funcoes);
        
        return (
          <div key={diaData.data} className={`tabela-pagina-row ${diaIndex % 2 === 0 ? 'row-even' : 'row-odd'}`}>
            {/* Coluna Data */}
            <div className="td-data-cell">
              <div className="data-info">
                <span className="data-numero">{diaData.data.split('/')[0]}</span>
                <span className="data-mes">{mes}</span>
                
                {onDeleteDia && (
                  <button
                    onClick={() => onDeleteDia(diaData.data)}
                    className="btn-delete-dia"
                    title="Excluir dia"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <span className={`dia-badge-mobile ${diaData.dia.toLowerCase()}`}>
                {diaData.dia}
              </span>
            </div>

            {/* Coluna Dia */}
            <div className="td-dia-cell">
              <span className={`dia-badge ${diaData.dia.toLowerCase()}`}>
                {diaData.dia}
              </span>
            </div>

            {/* Coluna Funcoes */}
            <div className="td-funcoes-cell">
              {funcoesOrdenadas.map((funcao, idx) => {
                const irmaosDisponiveis = getIrmaosParaFuncao(funcao.funcao);
                
                return (
                  <div key={funcao.funcao} className={`funcao-row ${idx < funcoesOrdenadas.length - 1 ? 'with-border' : ''}`}>
                    <div className="funcao-cell">
                      <span 
                        className="funcao-badge"
                        style={{ background: CORES_FUNCAO[funcao.funcao] || '#3b82f6' }}
                      >
                        {funcao.funcao}
                      </span>
                    </div>
                    
                    {/* Irmao 1 */}
                    <div className="irmao-cell">
                      {editingCell?.data === diaData.data && 
                       editingCell?.funcao === funcao.funcao && 
                       editingCell?.campo === 'irmao1' ? (
                        <select
                          autoFocus
                          defaultValue={funcao.irmao1}
                          onChange={(e) => handleSelectChange(e, diaData.data, funcao.funcao, 'irmao1', funcao.irmao1)}
                          className="edit-select"
                        >
                          <option value="">Selecione...</option>
                          {irmaosDisponiveis.map(nome => {
                            const indisponivel = isIndisponivel(nome, diaData.data);
                            const seguida = isDesignacaoSeguida(nome, diaData.data);
                            return (
                              <option 
                                key={nome} 
                                value={nome}
                                style={{
                                  color: indisponivel ? '#dc2626' : seguida ? '#b45309' : 'inherit',
                                  fontWeight: (indisponivel || seguida) ? 'bold' : 'normal',
                                  background: indisponivel ? '#fee2e2' : seguida ? '#fef3c7' : 'white'
                                }}
                              >
                                {nome}
                                {indisponivel ? ' (Indisponivel)' : ''}
                                {seguida && !indisponivel ? ' (Seguida)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <span 
                          className="irmao-nome editable"
                          onClick={() => setEditingCell({ data: diaData.data, funcao: funcao.funcao, campo: 'irmao1' })}
                          title="Clique para editar"
                          style={getNomeStyle(funcao.irmao1, diaData.data)}
                        >
                          {funcao.irmao1 || '-'}
                        </span>
                      )}
                    </div>
                    
                    {/* Irmao 2 */}
                    <div className="irmao-cell">
                      {editingCell?.data === diaData.data && 
                       editingCell?.funcao === funcao.funcao && 
                       editingCell?.campo === 'irmao2' ? (
                        <select
                          autoFocus
                          defaultValue={funcao.irmao2}
                          onChange={(e) => handleSelectChange(e, diaData.data, funcao.funcao, 'irmao2', funcao.irmao2)}
                          className="edit-select"
                        >
                          <option value="">Selecione...</option>
                          {irmaosDisponiveis.map(nome => {
                            const indisponivel = isIndisponivel(nome, diaData.data);
                            const seguida = isDesignacaoSeguida(nome, diaData.data);
                            return (
                              <option 
                                key={nome} 
                                value={nome}
                                style={{
                                  color: indisponivel ? '#dc2626' : seguida ? '#b45309' : 'inherit',
                                  fontWeight: (indisponivel || seguida) ? 'bold' : 'normal',
                                  background: indisponivel ? '#fee2e2' : seguida ? '#fef3c7' : 'white'
                                }}
                              >
                                {nome}
                                {indisponivel ? ' (Indisponivel)' : ''}
                                {seguida && !indisponivel ? ' (Seguida)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <span 
                          className="irmao-nome editable"
                          onClick={() => setEditingCell({ data: diaData.data, funcao: funcao.funcao, campo: 'irmao2' })}
                          title="Clique para editar"
                          style={getNomeStyle(funcao.irmao2, diaData.data)}
                        >
                          {funcao.irmao2 || '-'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>
    </>
  );
}
