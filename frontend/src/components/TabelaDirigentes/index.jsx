import React from 'react';
import { Trash2 } from 'lucide-react';
import EditableField from '../EditableField';
import './styles.css';

/**
 * Agrupa dias em semanas (Segunda a Sábado).
 */
function agruparPorSemana(dados) {
  const semanas = [];
  let semanaAtual = [];

  for (const diaGrupo of dados) {
    if (diaGrupo.escalas[0]?.dia === 'Segunda-Feira' && semanaAtual.length > 0) {
      semanas.push(semanaAtual);
      semanaAtual = [];
    }
    semanaAtual.push(diaGrupo);
  }

  if (semanaAtual.length > 0) {
    semanas.push(semanaAtual);
  }

  return semanas;
}

export default function TabelaDirigentes({ dados, quadro, updateEscala, onDeleteDia, id, semanaInicial = 1 }) {
  const status = quadro.status;
  const semanas = agruparPorSemana(dados);

  const handleChange = (escalaId, campo, valor) => {
    updateEscala(escalaId, campo, valor);
  };

  return (
    <div className="tabela-container" id={id}>
      <table className="tabela-dirigentes">
        <thead>
          <tr>
            <th className="col-data">Data</th>
            <th className="col-dia">Dia</th>
            <th className="col-local">Local</th>
            <th className="col-horario">Horário</th>
            <th className="col-principal">Dirigente Principal</th>
            <th className="col-substituto">Substituto</th>
            {status === 'rascunho' && <th className="col-acoes"></th>}
          </tr>
        </thead>
        <tbody>
          {semanas.map((semana, semanaIdx) => (
            <React.Fragment key={semanaIdx}>
              <tr>
                <td colSpan={status === 'rascunho' ? 7 : 6} className="semana-title-row">
                  Semana {semanaInicial + semanaIdx}
                </td>
              </tr>
              {semana.map((diaGrupo, diaIdx) => {
              return diaGrupo.escalas.map((escala, index) => {
                const isFirstOfGroup = index === 0;
                const isLastOfGroup = index === diaGrupo.escalas.length - 1;
                const rowSpan = diaGrupo.escalas.length;

                const podeEditar = status === 'rascunho';

                // Separador de semana
                const isUltimoDiaDaSemana = diaIdx === semana.length - 1;
                const isUltimaSemana = semanaIdx === semanas.length - 1;
                const separadorSemana = isLastOfGroup && isUltimoDiaDaSemana && !isUltimaSemana;

                let className = '';
                if (separadorSemana) {
                  className = 'border-bottom-semana';
                } else if (isLastOfGroup) {
                  className = 'border-bottom-thick';
                }

                return (
                  <tr key={escala.id} className={className}>
                    {isFirstOfGroup && (
                      <>
                        <td rowSpan={rowSpan} className="cell-data">
                          {escala.data}
                        </td>
                        <td rowSpan={rowSpan} className="cell-dia">
                          {escala.dia}
                        </td>
                      </>
                    )}

                    <td className="cell-local">{escala.saidaCampo.local}</td>
                    <td className="cell-horario">
                      <span className="badge-horario">{escala.saidaCampo.horario}</span>
                    </td>

                    <td className="cell-select">
                      {podeEditar ? (
                        <select
                          value={escala.principal || ''}
                          onChange={(e) => handleChange(escala.id, 'principal', e.target.value)}
                          className={`select-irmao ${escala.principal ? 'filled' : 'empty'}`}
                        >
                          <option value="">Selecione...</option>
                          {diaGrupo.candidatosDisponiveis.map(nome => (
                            <option key={nome} value={nome}>{nome}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="view-only-name">
                          <EditableField 
                            value={escala.principal} 
                            fieldName="principal" 
                            onSave={(f, v) => handleChange(escala.id, f, v)} 
                            fallback="-" 
                            options={diaGrupo.candidatosDisponiveis}
                          />
                        </div>
                      )}
                    </td>

                    <td className="cell-select">
                      {podeEditar ? (
                        <select
                          value={escala.substituto || ''}
                          onChange={(e) => handleChange(escala.id, 'substituto', e.target.value)}
                          className={`select-irmao ${escala.substituto ? 'filled' : 'empty'}`}
                        >
                          <option value="">Selecione...</option>
                          {diaGrupo.candidatosDisponiveis.map(nome => (
                            <option key={nome} value={nome}>{nome}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="view-only-name">
                          <EditableField 
                            value={escala.substituto} 
                            fieldName="substituto" 
                            onSave={(f, v) => handleChange(escala.id, f, v)} 
                            fallback="-" 
                            options={diaGrupo.candidatosDisponiveis}
                          />
                        </div>
                      )}
                    </td>

                    {status === 'rascunho' && isFirstOfGroup && (
                      <td rowSpan={rowSpan} className="cell-acoes">
                        <button
                          onClick={() => onDeleteDia(escala.data)}
                          className="btn-remover-dia"
                          title="Remover este dia da escala"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              });
            })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
