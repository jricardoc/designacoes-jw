// Ordem correta das funcoes
const ORDEM_FUNCAO = [
  "Microfone Volante",
  "Indicador",
  "Audio e Video",
  "Estacionamento",
];

const MESES_CURTO = [
  "",
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

const MESES_LONGO = [
  "",
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

// Componente especifico para PDF - Layout PORTRAIT
export default function TabelaPDF({ dados, quadro, id }) {
  const mes = MESES_CURTO[quadro?.mes] || "JAN";
  const mesLongo = MESES_LONGO[quadro?.mes] || "JANEIRO";

  // Titulo fixo
  const titulo = `Quadro de Designações ${mesLongo} ${quadro?.ano || 2026}`;

  // Ordenar funcoes na ordem correta
  const ordenarFuncoes = (funcoes) => {
    return [...funcoes].sort((a, b) => {
      const idxA = ORDEM_FUNCAO.indexOf(a.funcao);
      const idxB = ORDEM_FUNCAO.indexOf(b.funcao);
      return idxA - idxB;
    });
  };

  return (
    <div
      id={id}
      style={{
        background: "#FBF7EF",
        width: "210mm",
        height: "297mm",
        padding: "4mm",
        boxSizing: "border-box",
        fontFamily: "Roboto, Inter, sans-serif",
        position: "absolute",
        left: "-9999px",
        top: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header - Compactado para caber 5 dias */}
      <div
        style={{
          background: "linear-gradient(135deg, #5E6B48 0%, #566239 100%)",
          padding: "4mm 10mm",
          borderRadius: "3mm",
          textAlign: "center",
          marginBottom: "1.5mm",
        }}
      >
        <h2
          style={{
            color: "white",
            fontSize: "6mm",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {titulo}
        </h2>
      </div>

      {/* Header da tabela */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "25mm 25mm 1fr 1fr 1fr",
          background: "#2B2620",
          color: "white",
          fontWeight: 600,
          fontSize: "3.5mm",
          textTransform: "uppercase",
          borderRadius: "2mm 2mm 0 0",
        }}
      >
        <div style={{ padding: "2mm 3mm", textAlign: "center" }}>Data</div>
        <div style={{ padding: "2mm 3mm", textAlign: "center" }}>Dia</div>
        <div style={{ padding: "2mm 3mm", textAlign: "center" }}>Função</div>
        <div style={{ padding: "2mm 3mm", textAlign: "center" }}>Irmão 01</div>
        <div style={{ padding: "2mm 3mm", textAlign: "center" }}>Irmão 02</div>
      </div>

      {/* Conteudo - Esticar flexivelmente para ocupar toda a pagina */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {dados.map((diaData, diaIndex) => {
          const funcoesOrdenadas = ordenarFuncoes(diaData.funcoes);

          return (
            <div
              key={diaData.data}
              style={{
                display: "grid",
                gridTemplateColumns: "25mm 25mm 1fr",
                background: diaIndex % 2 === 0 ? "#F6F0E4" : "white",
                borderBottom: "0.5mm solid #E6DCC9",
                flex: 1,
              }}
            >
              {/* Coluna Data */}
              <div
                style={{
                  background: "#5E6B48",
                  color: "white",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "1mm",
                  borderRight: "1mm solid #566239",
                }}
              >
                <span
                  style={{ fontSize: "8mm", fontWeight: 800, lineHeight: 1 }}
                >
                  {diaData.data.split("/")[0]}
                </span>
                <span
                  style={{ fontSize: "3mm", fontWeight: 600, opacity: 0.9 }}
                >
                  {mes}
                </span>
              </div>

              {/* Coluna Dia */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "1mm",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    padding: "1.5mm 3mm",
                    borderRadius: "10mm",
                    fontSize: "3mm",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    background:
                      diaData.dia === "Domingo" ? "#B06A43" : "#5E6B48",
                    color: diaData.dia === "Domingo" ? "#78350f" : "#064e3b",
                  }}
                >
                  {diaData.dia}
                </span>
              </div>

              {/* Coluna Funcoes */}
              <div
                style={{ display: "flex", flexDirection: "column", flex: 1 }}
              >
                {funcoesOrdenadas.map((funcao, idx) => (
                  <div
                    key={funcao.funcao}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      padding: "0.5mm 2mm",
                      borderBottom:
                        idx < funcoesOrdenadas.length - 1
                          ? "0.3mm solid #E6DCC9"
                          : "none",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0",
                          fontSize: "3mm",
                          fontWeight: 800,
                          color: "#000",
                          textTransform: "uppercase",
                        }}
                      >
                        {funcao.funcao}
                      </span>
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        fontWeight: 600,
                        color: "#3A352D",
                        fontSize: "4mm",
                      }}
                    >
                      {funcao.irmao1 || "-"}
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        fontWeight: 600,
                        color: "#3A352D",
                        fontSize: "4mm",
                      }}
                    >
                      {funcao.irmao2 || "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
