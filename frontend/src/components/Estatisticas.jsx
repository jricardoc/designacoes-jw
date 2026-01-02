import { useDesignacoes } from '../context/DesignacoesContext';
import './Estatisticas.css';

export default function Estatisticas() {
  const { estatisticas, irmaos, loading } = useDesignacoes();

  if (loading) {
    return <div className="estatisticas-container">Carregando...</div>;
  }

  // Organizar estatisticas por funcao
  const porFuncao = {
    'Microfone Volante': {},
    'Indicador': {},
    'Audio e Video': {}
  };

  // Total de irmaos por funcao do banco
  const irmaosPorFuncao = {
    microfone: irmaos.filter(i => i.ativo && i.funcoes.includes('microfone')).map(i => i.nome),
    indicador: irmaos.filter(i => i.ativo && i.funcoes.includes('indicador')).map(i => i.nome),
    audioVideo: irmaos.filter(i => i.ativo && i.funcoes.includes('audioVideo')).map(i => i.nome)
  };

  return (
    <div className="estatisticas-container">
      <h2 className="estatisticas-titulo">Estatísticas de Designações</h2>
      
      <div className="resumo-geral">
        <h3>Resumo Geral de Aparições</h3>
        <div className="resumo-lista">
          {Object.entries(estatisticas || {})
            .sort((a, b) => b[1] - a[1])
            .map(([nome, count]) => (
              <span key={nome} className="resumo-item">
                {nome}: <strong>{count}x</strong>
              </span>
            ))}
        </div>
      </div>

      <div className="estatisticas-grid">
        <div className="estatistica-card">
          <h3 className="card-titulo">Microfone Volante</h3>
          <p className="card-info">{irmaosPorFuncao.microfone.length} irmaos ativos</p>
        </div>

        <div className="estatistica-card">
          <h3 className="card-titulo">Indicador</h3>
          <p className="card-info">{irmaosPorFuncao.indicador.length} irmaos ativos</p>
        </div>

        <div className="estatistica-card">
          <h3 className="card-titulo">Audio e Video</h3>
          <p className="card-info">{irmaosPorFuncao.audioVideo.length} irmaos ativos</p>
        </div>
      </div>
    </div>
  );
}
