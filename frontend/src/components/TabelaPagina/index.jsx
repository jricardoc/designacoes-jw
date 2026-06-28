import { useState } from 'react';
import { useDesignacoes } from '../../context/DesignacoesContext';
import './styles.css';

// Cores das funcoes (tons de azul)
const CORES_FUNCAO = {
  'Microfone Volante': '#566239',
  'Indicador': '#6E7B57',
  'Audio e Video': '#8B9A6F'
};

// Mapeamento de nomes de funcao para IDs
const FUNCAO_MAP = {
  'Microfone Volante': 'microfone',
  'Indicador': 'indicador',
  'Audio e Video': 'audioVideo'
};

export default function TabelaPagina({ dados, id }) {
  const { 
    titulo, subtitulo, setTitulo, setSubtitulo, 
    mes, setMes, updateDesignacao, updateData, updateDia,
    getIrmaosPorFuncao, isIrmaoIndisponivel
  } = useDesignacoes();
  
  const [editingTitulo, setEditingTitulo] = useState(false);
  const [editingSubtitulo, setEditingSubtitulo] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const [editingMes, setEditingMes] = useState(null);
  const [editingDiaSemana, setEditingDiaSemana] = useState(null);

  // Fallback seguro para quando o context ainda nao carregou
  const getIrmaosDisponiveis = (funcao) => {
    if (!getIrmaosPorFuncao) return [];
    const funcaoId = FUNCAO_MAP[funcao] || 'microfone';
    return getIrmaosPorFuncao(funcaoId) || [];
  };

  const verificarIndisponivel = (irmao, data) => {
    if (!isIrmaoIndisponivel) return false;
    return isIrmaoIndisponivel(irmao, data);
  };

  const handleDataChange = (dataOriginal, novaData) => {
    updateData(dataOriginal, novaData);
    setEditingData(null);
  };

  return (
    <div id={id} className="tabela-pagina-container">
      {/* Header */}
      <div className="tabela-pagina-header">
        {editingTitulo ? (
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => setEditingTitulo(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingTitulo(false)}
            autoFocus
            className="edit-input titulo-input"
          />
        ) : (
          <h2 
            className="tabela-pagina-titulo" 
            onClick={() => setEditingTitulo(true)}
            title="Clique para editar"
          >
            {titulo}
          </h2>
        )}
        
        {editingSubtitulo ? (
          <input
            type="text"
            value={subtitulo}
            onChange={(e) => setSubtitulo(e.target.value)}
            onBlur={() => setEditingSubtitulo(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingSubtitulo(false)}
            autoFocus
            className="edit-input subtitulo-input"
          />
        ) : (
          <p 
            className="tabela-pagina-subtitulo"
            onClick={() => setEditingSubtitulo(true)}
            title="Clique para editar"
          >
            {subtitulo}
          </p>
        )}
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
      {dados.map((diaData, diaIndex) => (
        <div key={diaData.data} className={`tabela-pagina-row ${diaIndex % 2 === 0 ? 'row-even' : 'row-odd'}`}>
          {/* Coluna Data + Dia */}
          <div className="td-data-cell">
            <div className="data-info">
              {editingData?.dataOriginal === diaData.data ? (
                <input
                  type="text"
                  defaultValue={diaData.data.split('/')[0]}
                  onBlur={(e) => handleDataChange(diaData.data, `${e.target.value}/01`)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDataChange(diaData.data, `${e.target.value}/01`)}
                  autoFocus
                  className="edit-data-input"
                  style={{ width: '40px', textAlign: 'center', fontSize: '1.5rem', fontWeight: 800, background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '4px' }}
                />
              ) : (
                <span 
                  className="data-numero editable" 
                  onClick={() => setEditingData({ dataOriginal: diaData.data })}
                  title="Clique para editar"
                  style={{ cursor: 'pointer' }}
                >
                  {diaData.data.split('/')[0]}
                </span>
              )}
              {/* Mes editavel */}
              {editingMes?.data === diaData.data ? (
                <input
                  type="text"
                  defaultValue={mes}
                  onBlur={(e) => { setMes(e.target.value.toUpperCase()); setEditingMes(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setMes(e.target.value.toUpperCase()); setEditingMes(null); }}}
                  autoFocus
                  style={{ width: '35px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '4px' }}
                />
              ) : (
                <span 
                  className="data-mes" 
                  onClick={() => setEditingMes({ data: diaData.data })}
                  title="Clique para editar"
                  style={{ cursor: 'pointer' }}
                >
                  {mes}
                </span>
              )}
            </div>
            {/* Badge do dia - visivel no mobile */}
            <span className={`dia-badge-mobile ${diaData.dia.toLowerCase()}`}>
              {diaData.dia}
            </span>
          </div>

          {/* Coluna Dia */}
          <div className="td-dia-cell">
            {editingDiaSemana?.data === diaData.data ? (
              <select
                value={diaData.dia}
                onChange={(e) => { updateDia(diaData.data, e.target.value); setEditingDiaSemana(null); }}
                onBlur={() => setEditingDiaSemana(null)}
                autoFocus
                className="edit-select"
              >
                <option value="Domingo">Domingo</option>
                <option value="Quinta">Quinta</option>
                <option value="Sabado">Sabado</option>
                <option value="Terca">Terca</option>
              </select>
            ) : (
              <span 
                className={`dia-badge ${diaData.dia.toLowerCase()}`}
                onClick={() => setEditingDiaSemana({ data: diaData.data })}
                title="Clique para editar"
                style={{ cursor: 'pointer' }}
              >
                {diaData.dia}
              </span>
            )}
          </div>

          {/* Coluna Funcoes */}
          <div className="td-funcoes-cell">
            {diaData.funcoes.map((funcao, idx) => (
              <div key={funcao.funcao} className={`funcao-row ${idx < diaData.funcoes.length - 1 ? 'with-border' : ''}`}>
                <div className="funcao-cell">
                  <span 
                    className="funcao-badge"
                    style={{ background: CORES_FUNCAO[funcao.funcao] || '#6E7B57' }}
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
                      value={funcao.irmao1}
                      onChange={(e) => {
                        updateDesignacao(diaData.data, funcao.funcao, 'irmao1', e.target.value);
                        setEditingCell(null);
                      }}
                      onBlur={() => setEditingCell(null)}
                      autoFocus
                      className="edit-select"
                    >
                      {getIrmaosDisponiveis(funcao.funcao).map(irmao => {
                        const indisponivel = verificarIndisponivel(irmao, diaData.data);
                        return (
                          <option 
                            key={irmao} 
                            value={irmao}
                            style={{ 
                              color: indisponivel ? '#A8503B' : 'inherit', 
                              fontWeight: indisponivel ? 'bold' : 'normal',
                              background: indisponivel ? '#F8EDE8' : 'white'
                            }}
                          >
                            {irmao}{indisponivel ? ' (Indisponivel)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <span 
                      className={`irmao-nome editable ${verificarIndisponivel(funcao.irmao1, diaData.data) ? 'irmao-indisponivel' : ''}`}
                      onClick={() => setEditingCell({ data: diaData.data, funcao: funcao.funcao, campo: 'irmao1' })}
                      title={verificarIndisponivel(funcao.irmao1, diaData.data) ? 'Irmao indisponivel nesta data!' : 'Clique para editar'}
                      style={verificarIndisponivel(funcao.irmao1, diaData.data) ? { color: '#A8503B', textDecoration: 'line-through' } : {}}
                    >
                      {funcao.irmao1}
                    </span>
                  )}
                </div>
                
                {/* Irmao 2 */}
                <div className="irmao-cell">
                  {editingCell?.data === diaData.data && 
                   editingCell?.funcao === funcao.funcao && 
                   editingCell?.campo === 'irmao2' ? (
                    <select
                      value={funcao.irmao2}
                      onChange={(e) => {
                        updateDesignacao(diaData.data, funcao.funcao, 'irmao2', e.target.value);
                        setEditingCell(null);
                      }}
                      onBlur={() => setEditingCell(null)}
                      autoFocus
                      className="edit-select"
                    >
                      {getIrmaosDisponiveis(funcao.funcao).map(irmao => {
                        const indisponivel = verificarIndisponivel(irmao, diaData.data);
                        return (
                          <option 
                            key={irmao} 
                            value={irmao}
                            style={{ 
                              color: indisponivel ? '#A8503B' : 'inherit', 
                              fontWeight: indisponivel ? 'bold' : 'normal',
                              background: indisponivel ? '#F8EDE8' : 'white'
                            }}
                          >
                            {irmao}{indisponivel ? ' (Indisponivel)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <span 
                      className={`irmao-nome editable ${verificarIndisponivel(funcao.irmao2, diaData.data) ? 'irmao-indisponivel' : ''}`}
                      onClick={() => setEditingCell({ data: diaData.data, funcao: funcao.funcao, campo: 'irmao2' })}
                      title={verificarIndisponivel(funcao.irmao2, diaData.data) ? 'Irmao indisponivel nesta data!' : 'Clique para editar'}
                      style={verificarIndisponivel(funcao.irmao2, diaData.data) ? { color: '#A8503B', textDecoration: 'line-through' } : {}}
                    >
                      {funcao.irmao2}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
