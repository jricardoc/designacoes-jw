import { useState, useEffect } from "react";
import { X, Calendar, Wand2, Check } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export default function NovoQuadroModal({
  isOpen,
  onClose,
  onSuccess,
  quadrosExistentes = [],
}) {
  const { authFetch } = useAuth();
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [autoPreenchimento, setAutoPreenchimento] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  // Regras de automatizacao
  const [regras, setRegras] = useState({
    respeitarIndisponibilidades: true,
    evitarRepeticoes: true,
    distribuicaoIgualitaria: true,
    designarTodos: true,
    regraAudioVideo: true,
  });

  // Verificar se mes/ano ja existe
  const jaExiste = quadrosExistentes.some(
    (q) => q.mes === mes && q.ano === ano,
  );

  const toggleRegra = (regra) => {
    setRegras((prev) => ({ ...prev, [regra]: !prev[regra] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");

    if (jaExiste) {
      setErro("Já existe um quadro para esse mês/ano");
      return;
    }

    setLoading(true);

    try {
      const response = await authFetch("/quadros", {
        method: "POST",
        body: JSON.stringify({
          mes,
          ano,
          autoPreenchimento,
          regras: autoPreenchimento ? regras : null,
        }),
      });

      if (response.ok) {
        const novoQuadro = await response.json();
        onSuccess?.(novoQuadro);
        onClose();
      } else {
        const data = await response.json();
        setErro(data.error || "Erro ao criar quadro");
      }
    } catch (error) {
      setErro("Erro de conexão");
    }

    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "#FBF7EF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "480px",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #E6DCC9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: "600",
              color: "#2B2620",
            }}
          >
            Novo Quadro de Designações
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.5rem",
              borderRadius: "8px",
            }}
          >
            <X size={20} color="#8A8071" />
          </button>
        </div>

        {/* Conteudo */}
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          {/* Mes e Ano */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "500",
                  color: "#3A352D",
                }}
              >
                Mês
              </label>
              <select
                value={mes}
                onChange={(e) => setMes(parseInt(e.target.value))}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #DCD0B9",
                  fontSize: "1rem",
                }}
              >
                {MESES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "500",
                  color: "#3A352D",
                }}
              >
                Ano
              </label>
              <input
                type="number"
                value={ano}
                onChange={(e) => setAno(parseInt(e.target.value))}
                min={2024}
                max={2030}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #DCD0B9",
                  fontSize: "1rem",
                }}
              />
            </div>
          </div>

          {jaExiste && (
            <div
              style={{
                padding: "0.75rem",
                background: "#F1E1D2",
                borderRadius: "8px",
                marginBottom: "1rem",
                color: "#92400e",
                fontSize: "0.9rem",
              }}
            >
              ⚠️ Já existe um quadro para esse mês/ano
            </div>
          )}

          {/* Toggle Auto-preenchimento */}
          <div
            style={{
              padding: "1rem",
              background: autoPreenchimento ? "#E9EFDC" : "#F3EDE2",
              borderRadius: "12px",
              marginBottom: "1rem",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "28px",
                  borderRadius: "14px",
                  background: autoPreenchimento ? "#5E6B48" : "#DCD0B9",
                  position: "relative",
                  transition: "background 0.2s",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "12px",
                    background: "#FBF7EF",
                    position: "absolute",
                    top: "2px",
                    left: autoPreenchimento ? "22px" : "2px",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                />
              </div>
              <input
                type="checkbox"
                checked={autoPreenchimento}
                onChange={(e) => setAutoPreenchimento(e.target.checked)}
                style={{ display: "none" }}
              />
              <div>
                <div
                  style={{
                    fontWeight: "600",
                    color: "#2B2620",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <Wand2
                    size={18}
                    color={autoPreenchimento ? "#5E6B48" : "#8A8071"}
                  />
                  Preenchimento Automático
                </div>
                <div style={{ fontSize: "0.85rem", color: "#8A8071" }}>
                  Designar irmãos automaticamente usando regras inteligentes
                </div>
              </div>
            </label>
          </div>

          {/* Regras (visível apenas se auto-preenchimento ativo) */}
          {autoPreenchimento && (
            <div
              style={{
                padding: "1rem",
                background: "#F3EDE2",
                borderRadius: "12px",
                marginBottom: "1.5rem",
              }}
            >
              <h4
                style={{
                  margin: "0 0 1rem",
                  fontSize: "0.9rem",
                  color: "#8A8071",
                  fontWeight: "600",
                }}
              >
                Regras de Preenchimento
              </h4>

              {[
                {
                  key: "respeitarIndisponibilidades",
                  label: "Respeitar Indisponibilidades",
                  desc: "Não designar irmãos em dias que estão ocupados",
                },
                {
                  key: "evitarRepeticoes",
                  label: "Evitar Repetições",
                  desc: "Não colocar o mesmo irmão em dias seguidos",
                },
                {
                  key: "distribuicaoIgualitaria",
                  label: "Distribuição Igualitária",
                  desc: "Balancear quantidade de designações",
                },
                {
                  key: "designarTodos",
                  label: "Designar Todos",
                  desc: "Garantir que todos tenham ao menos 1 designação",
                },
              ].map((regra) => (
                <label
                  key={regra.key}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "0.75rem",
                    cursor: "pointer",
                    borderRadius: "8px",
                    marginBottom: "0.5rem",
                    background: regras[regra.key] ? "#E9EFDC" : "white",
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "4px",
                      border: regras[regra.key]
                        ? "2px solid #5E6B48"
                        : "2px solid #DCD0B9",
                      background: regras[regra.key] ? "#5E6B48" : "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    {regras[regra.key] && <Check size={14} color="white" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={regras[regra.key]}
                    onChange={() => toggleRegra(regra.key)}
                    style={{ display: "none" }}
                  />
                  <div>
                    <div style={{ fontWeight: "500", color: "#2B2620" }}>
                      {regra.label}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#8A8071" }}>
                      {regra.desc}
                    </div>
                  </div>
                </label>
              ))}

              {/* Regra Audio e Video - Checkbox */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  cursor: "pointer",
                  borderRadius: "8px",
                  marginTop: "0.5rem",
                  background: regras.regraAudioVideo ? "#EEF0E3" : "white",
                  border: "1px solid #bfdbfe",
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "4px",
                    border: regras.regraAudioVideo
                      ? "2px solid #6E7B57"
                      : "2px solid #DCD0B9",
                    background: regras.regraAudioVideo ? "#6E7B57" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {regras.regraAudioVideo && <Check size={14} color="white" />}
                </div>
                <input
                  type="checkbox"
                  checked={regras.regraAudioVideo}
                  onChange={() => toggleRegra("regraAudioVideo")}
                  style={{ display: "none" }}
                />
                <div>
                  <div
                    style={{
                      fontWeight: "500",
                      color: "#566239",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    🎬 Regra Audio e Vídeo
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#6E7B57",
                      lineHeight: "1.4",
                    }}
                  >
                    1 experiente + 1 treinando
                  </div>
                </div>
              </label>
            </div>
          )}

          {erro && (
            <div
              style={{
                padding: "0.75rem",
                background: "#F6E7E0",
                borderRadius: "8px",
                marginBottom: "1rem",
                color: "#9A4632",
                fontSize: "0.9rem",
              }}
            >
              {erro}
            </div>
          )}

          {/* Botoes */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "0.875rem",
                borderRadius: "10px",
                border: "1px solid #DCD0B9",
                background: "#FBF7EF",
                fontWeight: "600",
                cursor: "pointer",
                color: "#3A352D",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || jaExiste}
              style={{
                flex: 1,
                padding: "0.875rem",
                borderRadius: "10px",
                border: "none",
                background:
                  loading || jaExiste
                    ? "#DCD0B9"
                    : "linear-gradient(135deg, #6E7B57 0%, #566239 100%)",
                color: "white",
                fontWeight: "600",
                cursor: loading || jaExiste ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Criando..." : "Criar Quadro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
