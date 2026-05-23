import React from 'react';
import './styles.css';

const MESES_NOME = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * Agrupa os dias em semanas (Segunda a Sábado).
 * Detecta a troca de semana quando aparece uma Segunda-Feira após outro dia.
 */
function agruparPorSemana(dados) {
  const semanas = [];
  let semanaAtual = [];

  for (const diaGrupo of dados) {
    // Se o dia é Segunda-Feira e já temos itens na semana atual, fecha a semana
    if (diaGrupo.escalas[0]?.dia === 'Segunda-Feira' && semanaAtual.length > 0) {
      semanas.push(semanaAtual);
      semanaAtual = [];
    }
    semanaAtual.push(diaGrupo);
  }

  // Push da última semana
  if (semanaAtual.length > 0) {
    semanas.push(semanaAtual);
  }

  return semanas;
}

export default function TabelaDirigentesPDF({ dados, quadro, id, semanaInicial = 1 }) {
  const semanas = agruparPorSemana(dados);

  return (
    <div className="pdf-container" id={id}>
      <div className="pdf-header">
        <h1 className="pdf-title">ESCALA DE DIRIGENTES DE CAMPO</h1>
        <h2 className="pdf-subtitle">{MESES_NOME[quadro.mes]?.toUpperCase()} {quadro.ano}</h2>
      </div>

      <table className="tabela-pdf">
        <thead>
          <tr>
            <th className="col-data">DATA</th>
            <th className="col-dia">DIA</th>
            <th className="col-local">LOCAL</th>
            <th className="col-horario">HORÁRIO</th>
            <th className="col-principal">DIRIGENTE PRINCIPAL</th>
            <th className="col-substituto">SUBSTITUTO</th>
          </tr>
        </thead>
        <tbody>
          {semanas.map((semana, semanaIdx) => (
            <React.Fragment key={semanaIdx}>
              <tr>
                <td colSpan="6" className="semana-title-row">
                  SEMANA {semanaInicial + semanaIdx}
                </td>
              </tr>
              {semana.map((diaGrupo, diaIdx) => {
              return diaGrupo.escalas.map((escala, index) => {
                const isFirstOfGroup = index === 0;
                const isLastOfGroup = index === diaGrupo.escalas.length - 1;
                const rowSpan = diaGrupo.escalas.length;

                // Separador de semana: borda grossa após o último dia da semana (exceto a última)
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
                    <td className="cell-horario">{escala.saidaCampo.horario}</td>
                    <td className="cell-nome">{escala.principal || ''}</td>
                    <td className="cell-nome">{escala.substituto || ''}</td>
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
