import { X, Calendar, User, Shield, Video, Car } from "lucide-react";
import './styles.css';

// Mapeamento de icones por funcao
const FUNCAO_ICONES = {
  "Microfone Volante": <Shield size={16} />,
  Indicador: <User size={16} />,
  "Audio e Video": <Video size={16} />,
  Estacionamento: <Car size={16} />,
};

export default function EstatisticasIrmaoModal({
  isOpen,
  onClose,
  irmaoNome,
  quadro,
}) {
  if (!isOpen || !irmaoNome || !quadro) return null;

  // Filtrar e organizar designacoes do irmao
  const designacoesDoIrmao = [];

  quadro.designacoes.forEach((d) => {
    if (d.irmao1 === irmaoNome || d.irmao2 === irmaoNome) {
      // Formatar dia para comparacao/ordenacao
      const [diaStr] = d.data.split("/");
      const diaNum = parseInt(diaStr, 10);

      designacoesDoIrmao.push({
        ...d,
        diaNum,
      });
    }
  });

  // Ordenar cronologicamente pelo dia
  designacoesDoIrmao.sort((a, b) => a.diaNum - b.diaNum);

  return (
    <div className="estatisticas-modal-overlay" onClick={onClose}>
      <div
        className="estatisticas-modal-content"
        onClick={(e) => e.stopPropagation()} // Impede fechar ao clicar dentro
      >
        <div className="estatisticas-modal-header">
          <div>
            <h2 className="estatisticas-modal-title">Detalhes da Designação</h2>
            <p className="estatisticas-modal-subtitle">
              Histórico no Quadro: {quadro.titulo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="estatisticas-modal-close"
            title="Fechar"
          >
            <X size={24} />
          </button>
        </div>

        <div className="estatisticas-modal-body">
          <div className="estatisticas-perfil">
            <div className="perfil-avatar">
              {irmaoNome.charAt(0).toUpperCase()}
            </div>
            <div className="perfil-info">
              <h3>{irmaoNome}</h3>
              <span className="perfil-badge">
                {designacoesDoIrmao.length} Designações neste mês
              </span>
            </div>
          </div>

          <div className="estatisticas-lista-title">
            <Calendar size={18} />
            Cronograma do Mês
          </div>

          {designacoesDoIrmao.length > 0 ? (
            <div className="estatisticas-lista-designacoes">
              {designacoesDoIrmao.map((d, index) => (
                <div
                  key={`${d.data}-${d.funcao}-${index}`}
                  className="designacao-item-card"
                >
                  <div className="designacao-item-data">
                    <span className="data-numero">{d.data.split("/")[0]}</span>
                  </div>
                  <div className="designacao-item-detalhes">
                    <span className={`designacao-dia ${d.dia.toLowerCase()}`}>
                      {d.dia}
                    </span>
                    <div className="designacao-funcao-wrap">
                      <div className="funcao-icone">
                        {FUNCAO_ICONES[d.funcao] || <Shield size={16} />}
                      </div>
                      <span className="funcao-texto">{d.funcao}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="estatisticas-vazio">
              Nenhuma designação encontrada para este irmão neste quadro.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
