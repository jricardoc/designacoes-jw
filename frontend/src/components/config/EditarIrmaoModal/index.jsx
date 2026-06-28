import { useState, useEffect } from "react";
import {
  X,
  User,
  Check,
  Trash2,
  Calendar,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from '../../../context/AuthContext';

const FUNCOES = [
  { id: "microfone", label: "Microfone", color: "#6E7B57" },
  { id: "indicador", label: "Indicador", color: "#5E6B48" },
  { id: "audioVideo", label: "Áudio e Vídeo", color: "#6E7B57" },
  { id: "estacionamento", label: "Estacionamento", color: "#B06A43" },
  { id: "dirigente", label: "Dirigente", color: "#A8503B" },
];

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function EditarIrmaoModal({ irmao, onClose }) {
  const { authFetch } = useAuth();
  const [nome, setNome] = useState(irmao?.nome || "");
  const [funcoes, setFuncoes] = useState(irmao?.funcoes || []);
  const [nivelAudioVideo, setNivelAudioVideo] = useState(
    irmao?.nivelAudioVideo || "experiente",
  );
  const [ativo, setAtivo] = useState(irmao?.ativo ?? true);
  const [indisponibilidades, setIndisponibilidades] = useState([]);
  const [salvando, setSalvando] = useState(false);

  // Estados para Dirigente
  const [saidasCampo, setSaidasCampo] = useState([]);
  const [disponibilidadeDirigente, setDisponibilidadeDirigente] = useState([]);

  // Estado do calendario
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  // Carregar indisponibilidades e configurações de dirigente
  useEffect(() => {
    carregarSaidasCampo();
    
    if (irmao?.id) {
      carregarIndisponibilidades();
      carregarDisponibilidadeDirigente();
    }
  }, [irmao?.id]);

  const carregarIndisponibilidades = async () => {
    try {
      const response = await authFetch(`/indisponibilidades/irmao/${irmao.id}`);
      const data = await response.json();
      setIndisponibilidades(data);
    } catch (error) {
      console.error("Erro ao carregar indisponibilidades:", error);
    }
  };

  const carregarSaidasCampo = async () => {
    try {
      const response = await authFetch("/saidas-campo");
      let data = await response.json();
      
      const ordemDias = {
        "segunda": 1, "segunda-feira": 1,
        "terca": 2, "terça": 2, "terça-feira": 2,
        "quarta": 3, "quarta-feira": 3,
        "quinta": 4, "quinta-feira": 4,
        "sexta": 5, "sexta-feira": 5,
        "sabado": 6, "sábado": 6,
        "domingo": 7
      };

      data.sort((a, b) => {
        const diaA = (a.diaSemana || "").toLowerCase();
        const diaB = (b.diaSemana || "").toLowerCase();
        const dif = (ordemDias[diaA] || 99) - (ordemDias[diaB] || 99);
        if (dif === 0) {
          // Se mesmo dia, ordena pelo id ou horário
          return a.id - b.id;
        }
        return dif;
      });

      setSaidasCampo(data);
    } catch (error) {
      console.error("Erro ao carregar saídas de campo:", error);
    }
  };

  const carregarDisponibilidadeDirigente = async () => {
    try {
      const response = await authFetch(`/dirigentes/disponibilidade/${irmao.id}`);
      const data = await response.json();
      setDisponibilidadeDirigente(data.map(d => d.saidaCampoId));
    } catch (error) {
      console.error("Erro ao carregar disponibilidade de dirigente:", error);
    }
  };

  const toggleSaidaCampo = (saidaId) => {
    setDisponibilidadeDirigente(prev => 
      prev.includes(saidaId) 
        ? prev.filter(id => id !== saidaId)
        : [...prev, saidaId]
    );
  };

  // Gerar dias do mes corretamente
  const getDiasDoMes = () => {
    const primeiroDia = new Date(anoAtual, mesAtual, 1);
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const diaDaSemanaInicio = primeiroDia.getDay(); // 0 = Domingo

    const dias = [];

    // Adicionar espacos vazios para alinhar com dia da semana
    for (let i = 0; i < diaDaSemanaInicio; i++) {
      dias.push(null);
    }

    // Adicionar dias do mes
    for (let i = 1; i <= diasNoMes; i++) {
      dias.push(i);
    }

    return dias;
  };

  // Verificar se dia esta marcado como indisponivel
  const isDiaIndisponivel = (dia) => {
    if (!dia) return false;
    const mesStr = String(mesAtual + 1).padStart(2, "0");
    const diaStr = String(dia).padStart(2, "0");
    const dataFormatada = `${diaStr}/${mesStr}`;
    return indisponibilidades.some((i) => i.data === dataFormatada);
  };

  // Toggle dia indisponivel
  const toggleDia = async (dia) => {
    if (!dia || !irmao?.id) return;

    const mesStr = String(mesAtual + 1).padStart(2, "0");
    const diaStr = String(dia).padStart(2, "0");
    const dataFormatada = `${diaStr}/${mesStr}`;

    const indispExistente = indisponibilidades.find(
      (i) => i.data === dataFormatada,
    );

    if (indispExistente) {
      // Remover
      try {
        await authFetch(`/indisponibilidades/${indispExistente.id}`, {
          method: "DELETE",
        });
        setIndisponibilidades((prev) =>
          prev.filter((i) => i.id !== indispExistente.id),
        );
      } catch (error) {
        console.error("Erro ao remover:", error);
      }
    } else {
      // Adicionar
      try {
        const response = await authFetch("/indisponibilidades", {
          method: "POST",
          body: JSON.stringify({
            irmaoId: irmao.id,
            data: dataFormatada,
            motivo: "Compromisso pessoal",
          }),
        });
        const nova = await response.json();
        setIndisponibilidades((prev) => [...prev, nova]);
      } catch (error) {
        console.error("Erro ao adicionar:", error);
      }
    }
  };

  // Navegar entre meses
  const mesAnterior = () => {
    if (mesAtual === 0) {
      setMesAtual(11);
      setAnoAtual(anoAtual - 1);
    } else {
      setMesAtual(mesAtual - 1);
    }
  };

  const proximoMes = () => {
    if (mesAtual === 11) {
      setMesAtual(0);
      setAnoAtual(anoAtual + 1);
    } else {
      setMesAtual(mesAtual + 1);
    }
  };

  // Toggle funcao
  const toggleFuncao = (funcaoId) => {
    setFuncoes((prev) =>
      prev.includes(funcaoId)
        ? prev.filter((f) => f !== funcaoId)
        : [...prev, funcaoId],
    );
  };

  // Salvar irmao
  const salvar = async () => {
    if (!nome.trim()) {
      alert("Nome é obrigatório");
      return;
    }

    setSalvando(true);

    try {
      let irmaoId = irmao?.id;

      if (irmao?.id) {
        // Atualizar
        await authFetch(`/irmaos/${irmao.id}`, {
          method: "PUT",
          body: JSON.stringify({ nome, funcoes, ativo, nivelAudioVideo }),
        });
      } else {
        // Criar novo
        const res = await authFetch("/irmaos", {
          method: "POST",
          body: JSON.stringify({ nome, funcoes, nivelAudioVideo }),
        });
        const novoIrmao = await res.json();
        irmaoId = novoIrmao.id;
      }

      // Salvar disponibilidade de dirigente se a funcao foi selecionada
      if (funcoes.includes('dirigente') && irmaoId) {
        await authFetch('/dirigentes/disponibilidade', {
          method: 'PUT',
          body: JSON.stringify({
            irmaoId: irmaoId,
            saidasCampoIds: disponibilidadeDirigente
          })
        });
      }

      onClose(true);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar");
    }

    setSalvando(false);
  };

  // Deletar irmao
  const deletar = async () => {
    if (!irmao?.id) return;
    if (!confirm(`Excluir ${irmao.nome}? Essa ação não pode ser desfeita.`))
      return;

    try {
      await authFetch(`/irmaos/${irmao.id}`, { method: "DELETE" });
      onClose(true);
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  const dias = getDiasDoMes();

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
          borderRadius: "20px",
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "1px solid #E6DCC9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            background: "#FBF7EF",
            zIndex: 10,
            borderRadius: "20px 20px 0 0",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #B06A43 0%, #9A5A38 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={22} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
                {irmao ? "Editar Irmão" : "Novo Irmão"}
              </h2>
              {irmao && (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#8A8071" }}>
                  {indisponibilidades.length} indisponibilidades
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            style={{
              background: "#F6F0E4",
              border: "none",
              borderRadius: "10px",
              padding: "0.5rem",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#ECE3D3")}
            onMouseLeave={(e) => (e.target.style.background = "#F6F0E4")}
          >
            <X size={22} color="#8A8071" />
          </button>
        </div>

        <div style={{ padding: "1.5rem" }}>
          {/* Nome */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "600",
                fontSize: "0.9rem",
                color: "#3A352D",
              }}
            >
              Nome
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                border: "2px solid #E6DCC9",
                fontSize: "1rem",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#B06A43")}
              onBlur={(e) => (e.target.style.borderColor = "#E6DCC9")}
            />
          </div>

          {/* Funcoes */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "600",
                fontSize: "0.9rem",
                color: "#3A352D",
              }}
            >
              Funções
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {FUNCOES.map((funcao) => (
                <button
                  key={funcao.id}
                  onClick={() => toggleFuncao(funcao.id)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "20px",
                    border: `2px solid ${funcao.color}`,
                    background: funcoes.includes(funcao.id)
                      ? funcao.color
                      : "white",
                    color: funcoes.includes(funcao.id) ? "white" : funcao.color,
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    fontSize: "0.85rem",
                    boxShadow: funcoes.includes(funcao.id)
                      ? `0 4px 12px ${funcao.color}40`
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform =
                      "translateY(-2px) scale(1.05)";
                    e.currentTarget.style.boxShadow = `0 6px 16px ${funcao.color}50`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0) scale(1)";
                    e.currentTarget.style.boxShadow = funcoes.includes(
                      funcao.id,
                    )
                      ? `0 4px 12px ${funcao.color}40`
                      : "none";
                  }}
                >
                  {funcao.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Nivel Audio/Video caso tenha a funcao */}
          {funcoes.includes("audioVideo") && (
            <div
              style={{
                marginBottom: "1.25rem",
                padding: "1rem",
                background: "#F3EDE2",
                borderRadius: "12px",
                border: "1px solid #ECE3D3",
              }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: "0.75rem",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  color: "#3A352D",
                }}
              >
                Nível em Áudio e Vídeo
              </label>

              <div style={{ display: "flex", gap: "1rem" }}>
                <button
                  onClick={() => setNivelAudioVideo("experiente")}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    borderRadius: "10px",
                    border:
                      nivelAudioVideo === "experiente"
                        ? "2px solid #6E7B57"
                        : "2px solid transparent",
                    background:
                      nivelAudioVideo === "experiente" ? "#EAEFDC" : "white",
                    color:
                      nivelAudioVideo === "experiente" ? "#6d28d9" : "#8A8071",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  🚀 Experiente
                </button>
                <button
                  onClick={() => setNivelAudioVideo("treinando")}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    borderRadius: "10px",
                    border:
                      nivelAudioVideo === "treinando"
                        ? "2px solid #B06A43"
                        : "2px solid transparent",
                    background:
                      nivelAudioVideo === "treinando" ? "#F1E1D2" : "white",
                    color:
                      nivelAudioVideo === "treinando" ? "#78532A" : "#8A8071",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  ⏳ Treinando
                </button>
              </div>
            </div>
          )}

          {/* Seção de Disponibilidade para Dirigente */}
          {funcoes.includes("dirigente") && (
            <div
              style={{
                marginBottom: "1.25rem",
                padding: "1rem",
                background: "#F8EDE8",
                borderRadius: "12px",
                border: "1px solid #F0DED3",
              }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: "0.75rem",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  color: "#7A3D2C",
                }}
              >
                Disponibilidade para Saídas de Campo
              </label>
              <p style={{ fontSize: "0.8rem", color: "#9A4632", marginBottom: "1rem" }}>
                Selecione em quais saídas este irmão pode atuar como dirigente:
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem" }}>
                {saidasCampo.map((saida) => (
                  <label
                    key={saida.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.75rem",
                      background: "#FBF7EF",
                      borderRadius: "8px",
                      border: "1px solid #E3C9C0",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={disponibilidadeDirigente.includes(saida.id)}
                      onChange={() => toggleSaidaCampo(saida.id)}
                      style={{ transform: "scale(1.2)" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", color: "#7A3D2C", textTransform: "capitalize" }}>
                        {saida.diaSemana} - {saida.horario}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#7A3D2C" }}>
                        {saida.local}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          {irmao && (
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  cursor: "pointer",
                }}
              >
                <div
                  onClick={() => setAtivo(!ativo)}
                  style={{
                    width: "48px",
                    height: "26px",
                    borderRadius: "13px",
                    background: ativo ? "#5E6B48" : "#C6BAA0",
                    position: "relative",
                    transition: "background 0.2s",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "11px",
                      background: "#FBF7EF",
                      position: "absolute",
                      top: "2px",
                      left: ativo ? "24px" : "2px",
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </div>
                <span style={{ fontWeight: "500", color: "#3A352D" }}>
                  {ativo ? "Ativo" : "Inativo"}
                </span>
              </label>
            </div>
          )}

          {/* Calendario de Indisponibilidades (apenas se editando) */}
          {irmao && (
            <div
              style={{
                background: "#F3EDE2",
                borderRadius: "12px",
                padding: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1rem",
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.9rem",
                    color: "#3A352D",
                  }}
                >
                  <Calendar size={18} color="#B06A43" />
                  Indisponibilidades
                </h4>

                {/* Navegacao do mes */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem" /* Gap mais apertado pro mobile  */,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={mesAnterior}
                    style={{
                      background: "#FBF7EF",
                      border: "1px solid #E6DCC9",
                      borderRadius: "6px",
                      padding: "4px",
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span
                    style={{
                      fontWeight: "600",
                      fontSize: "0.85rem",
                      minWidth:
                        "80px" /* Reduzido para encaixar sem espremer os botões */,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {MESES[mesAtual]} {anoAtual}
                  </span>
                  <button
                    onClick={proximoMes}
                    style={{
                      background: "#FBF7EF",
                      border: "1px solid #E6DCC9",
                      borderRadius: "6px",
                      padding: "4px",
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Grid do calendario */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "4px",
                }}
              >
                {/* Dias da semana */}
                {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                  <div
                    key={i}
                    style={{
                      textAlign: "center",
                      fontWeight: "600",
                      color: "#A2977F",
                      fontSize: "0.7rem",
                      padding: "4px",
                    }}
                  >
                    {d}
                  </div>
                ))}

                {/* Dias do mes */}
                {dias.map((dia, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleDia(dia)}
                    disabled={!dia}
                    style={{
                      aspectRatio: "1",
                      borderRadius: "6px",
                      border: "none",
                      background: !dia
                        ? "transparent"
                        : isDiaIndisponivel(dia)
                          ? "linear-gradient(135deg, #A8503B 0%, #9A4632 100%)"
                          : "white",
                      color: isDiaIndisponivel(dia) ? "white" : "#3A352D",
                      fontWeight: "600",
                      fontSize: "0.8rem",
                      cursor: dia ? "pointer" : "default",
                      transition: "all 0.2s",
                      boxShadow:
                        dia && !isDiaIndisponivel(dia)
                          ? "0 1px 2px rgba(0,0,0,0.05)"
                          : dia && isDiaIndisponivel(dia)
                            ? "0 2px 8px rgba(239, 68, 68, 0.3)"
                            : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (dia) {
                        e.currentTarget.style.transform = "scale(1.15)";
                        e.currentTarget.style.boxShadow = isDiaIndisponivel(dia)
                          ? "0 4px 12px rgba(239, 68, 68, 0.5)"
                          : "0 4px 12px rgba(249, 115, 22, 0.3)";
                        if (!isDiaIndisponivel(dia)) {
                          e.currentTarget.style.borderColor = "#B06A43";
                          e.currentTarget.style.border = "2px solid #B06A43";
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (dia) {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.border = "none";
                        e.currentTarget.style.boxShadow = isDiaIndisponivel(dia)
                          ? "0 2px 8px rgba(239, 68, 68, 0.3)"
                          : "0 1px 2px rgba(0,0,0,0.05)";
                      }
                    }}
                  >
                    {dia}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  marginTop: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#8A8071",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "3px",
                      background: "#FBF7EF",
                      border: "1px solid #E6DCC9",
                    }}
                  />
                  Disponível
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "3px",
                      background: "#A8503B",
                    }}
                  />
                  Indisponível
                </div>
              </div>
            </div>
          )}

          {/* Acoes */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "space-between" /* mantem o flex afastado */,
              flexWrap:
                "wrap" /* Permite jogar a segunda div pra baixo sem estrangular */,
              alignItems: "center",
              marginTop: "1rem",
            }}
          >
            {irmao && (
              <button
                onClick={deletar}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1rem",
                  background: "#F6E7E0",
                  color: "#9A4632",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.target.style.background = "#F0DED3")}
                onMouseLeave={(e) => (e.target.style.background = "#F6E7E0")}
              >
                <Trash2 size={18} />
                Excluir
              </button>
            )}

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                flex: "1 1 auto" /* Cresce para ocupar linha se quebrar */,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => onClose(false)}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "#F6F0E4",
                  color: "#8A8071",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.target.style.background = "#ECE3D3")}
                onMouseLeave={(e) => (e.target.style.background = "#F6F0E4")}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1.5rem",
                  background: salvando
                    ? "#A2977F"
                    : "linear-gradient(135deg, #5E6B48 0%, #566239 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: "600",
                  cursor: salvando ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px -3px rgba(16, 185, 129, 0.4)",
                }}
              >
                <Check size={18} />
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
