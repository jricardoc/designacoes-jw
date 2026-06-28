import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  FileText,
  ArrowLeft,
  Download,
  Check,
  Archive,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import TabelaQuadro from "../../components/TabelaQuadro";
import TabelaPDF from "../../components/TabelaPDF";
import HistoricoPanel from "../../components/quadros/HistoricoPanel";
import { useToast, ToastContainer } from "../../components/Toast";
import ConfirmModal from "../../components/ConfirmModal";
import EstatisticasIrmaoModal from "../../components/EstatisticasIrmaoModal";
import "./styles.css";

const MESES = [
  "",
  "JANEIRO",
  "FEVEREIRO",
  "MARCO",
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

const STATUS_CONFIG = {
  rascunho: { label: "Rascunho", color: "#B06A43", bg: "#F1E1D2" },
  publicado: { label: "Publicado", color: "#5E6B48", bg: "#E2E7D2" },
  arquivado: { label: "Arquivado", color: "#8A8071", bg: "#F6F0E4" },
};

export default function QuadroView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const historicoRef = useRef(null);
  const { toasts, addToast, removeToast } = useToast();

  const [quadro, setQuadro] = useState(null);
  const [irmaos, setIrmaos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false });
  const [irmaoModalAberto, setIrmaoModalAberto] = useState(null);

  const openModal = (config) => setModalConfig({ ...config, isOpen: true });
  const closeModal = () =>
    setModalConfig((prev) => ({ ...prev, isOpen: false }));

  const carregarQuadro = async () => {
    try {
      const [responseQuadro, responseIrmaos] = await Promise.all([
        authFetch(`/quadros/${id}`),
        authFetch("/irmaos"),
      ]);

      if (responseQuadro.ok && responseIrmaos.ok) {
        const dataQuadro = await responseQuadro.json();
        const dataIrmaos = await responseIrmaos.json();
        setQuadro(dataQuadro);
        setIrmaos(dataIrmaos);
      } else {
        navigate("/designacoes");
      }
    } catch (error) {
      console.error("Erro:", error);
      navigate("/designacoes");
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarQuadro();
  }, [id]);

  // Funcao para atualizar historico
  const atualizarHistorico = () => {
    if (historicoRef.current && historicoRef.current.refresh) {
      historicoRef.current.refresh();
    }
  };

  // Atualizar designacao
  const updateDesignacao = async (data, funcao, campo, valor) => {
    // Atualizar local primeiro
    setQuadro((prev) => ({
      ...prev,
      designacoes: prev.designacoes.map((d) => {
        if (d.data === data && d.funcao === funcao) {
          return { ...d, [campo]: valor };
        }
        return d;
      }),
    }));

    // Salvar no backend
    try {
      const response = await authFetch("/quadros/designacao", {
        method: "PUT",
        body: JSON.stringify({
          quadroId: parseInt(id),
          data,
          funcao,
          campo,
          valor,
        }),
      });

      if (response.ok) {
        addToast("Designacao atualizada com sucesso!", "success");
        // Atualizar historico
        atualizarHistorico();
      } else {
        addToast("Erro ao salvar designacao", "error");
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      addToast("Erro de conexao ao salvar", "error");
    }
  };

  // Alterar status
  const alterarStatus = async (novoStatus) => {
    try {
      const response = await authFetch(`/quadros/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: novoStatus }),
      });

      if (response.ok) {
        setQuadro((prev) => ({ ...prev, status: novoStatus }));
        const statusLabel = STATUS_CONFIG[novoStatus]?.label || novoStatus;
        addToast(`Quadro ${statusLabel.toLowerCase()} com sucesso!`, "success");
        // Atualizar historico
        atualizarHistorico();
      } else {
        addToast("Erro ao alterar status", "error");
      }
    } catch (error) {
      console.error("Erro:", error);
      addToast("Erro de conexao", "error");
    }
  };

  // Gerar PDF
  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = 210;
      const pageHeight = 297;

      // Pagina 1
      // Paginas dinamicas
      const totalPaginas = document.querySelectorAll(
        '[id^="tabela-pdf-"]',
      ).length;

      for (let i = 1; i <= totalPaginas; i++) {
        const element = document.getElementById(`tabela-pdf-${i}`);
        if (element) {
          if (i > 1) pdf.addPage();

          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#FBF7EF",
            logging: false,
          });

          const imgData = canvas.toDataURL("image/jpeg", 0.92);
          pdf.addImage(
            imgData,
            "JPEG",
            0,
            0,
            pageWidth,
            pageHeight,
            undefined,
            "FAST",
          );
        }
      }

      // Salvar PDF de forma robusta
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      // Tratar possiveis erros de indice
      const nomeMes = MESES[quadro.mes]
        ? MESES[quadro.mes].toLowerCase()
        : "mes";
      link.download = `quadro-designacoes-${nomeMes}-${quadro.ano}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast("PDF gerado com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      addToast("Erro ao gerar PDF", "error");
    }
    setDownloading(false);
  };

  // Excluir Dia
  const handleDeleteDia = (data) => {
    openModal({
      title: "Excluir dia",
      message: `Tem certeza que deseja excluir todas as designações do dia ${data}? Escreva o motivo abaixo:`,
      type: "danger",
      showInput: true,
      inputPlaceholder: "Ex: Reunião cancelada devido ao congresso",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      onConfirm: async (motivo) => {
        try {
          const response = await authFetch("/quadros/dias", {
            method: "DELETE",
            body: JSON.stringify({
              quadroId: parseInt(id),
              data,
              motivo,
            }),
          });

          if (response.ok) {
            addToast("Dia excluído com sucesso!", "success");
            // Atualizar historico e recarregar quadro
            atualizarHistorico();
            carregarQuadro();
            closeModal();
          } else {
            addToast("Erro ao excluir dia", "error");
          }
        } catch (error) {
          console.error(error);
          addToast("Erro de conexão", "error");
        }
      },
    });
  };

  // Confirmar Exclusao Quadro
  const confirmDeleteQuadro = () => {
    openModal({
      title: "Excluir Quadro",
      message: `Deseja excluir o quadro de ${MESES[quadro.mes]} ${quadro.ano}? Esta ação não pode ser desfeita.`,
      type: "danger",
      confirmText: "Sim, excluir",
      onConfirm: async () => {
        try {
          const response = await authFetch(`/quadros/${id}`, {
            method: "DELETE",
          });
          if (response.ok) {
            addToast("Quadro excluído com sucesso!", "success");
            setTimeout(() => navigate("/designacoes"), 500);
          } else {
            addToast("Erro ao excluir quadro", "error");
          }
        } catch (error) {
          addToast("Erro de conexão", "error");
        }
      },
    });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <div
          style={{
            flex: 1,
            marginLeft: "70px",
            padding: "3rem",
            textAlign: "center",
            color: "#8A8071",
          }}
        >
          Carregando quadro...
        </div>
      </div>
    );
  }

  if (!quadro) {
    return null;
  }

  // Agrupar designacoes por data
  const grupos = Object.values(
    quadro.designacoes.reduce((acc, d) => {
      if (!acc[d.data]) {
        acc[d.data] = { data: d.data, dia: d.dia, funcoes: [] };
      }
      acc[d.data].funcoes.push(d);
      return acc;
    }, {}),
  ).sort((a, b) => {
    const [diaA, mesA] = a.data.split("/").map(Number);
    const [diaB, mesB] = b.data.split("/").map(Number);
    return mesA * 100 + diaA - (mesB * 100 + diaB);
  });

  // Paginacao dinamica
  const ITEMS_PER_PAGE = 9;
  const paginas = [];
  for (let i = 0; i < grupos.length; i += ITEMS_PER_PAGE) {
    paginas.push(grupos.slice(i, i + ITEMS_PER_PAGE));
  }

  const pagina1 = paginas.length > 0 ? paginas[0] : [];
  const statusConfig = STATUS_CONFIG[quadro.status];

  return (
    <div className="quadro-container">
      <Sidebar />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="quadro-main">
        {/* Header */}
        <div className="quadro-header">
          {/* Voltar */}
          <Link
            to="/designacoes"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              fontSize: "0.9rem",
              marginBottom: "1rem",
              transition: "color 0.2s",
            }}
          >
            <ArrowLeft size={18} />
            Voltar para Quadros
          </Link>

          {/* Titulo e acoes */}
          <div className="header-actions-row">
            <div className="header-title-group">
              <div className="header-icon-box">
                <FileText size={28} />
              </div>
              <div className="header-info-content">
                <h1 className="header-title">
                  {quadro.titulo}
                  <span
                    className="header-status-badge"
                    style={{
                      background: statusConfig.bg,
                      color: statusConfig.color,
                    }}
                  >
                    {statusConfig.label}
                  </span>
                </h1>
                <p className="header-subtitle">
                  {quadro.designacoes.length} designações
                </p>
              </div>
            </div>

            {/* Acoes */}
            <div className="header-buttons-wrapper">
              {quadro.status === "rascunho" && (
                <button
                  onClick={() => alterarStatus("publicado")}
                  className="btn-acao btn-publicar"
                >
                  <Check size={18} />
                  <span>Publicar</span>
                </button>
              )}

              <button
                onClick={handleDownloadPDF}
                disabled={downloading || quadro.status === "rascunho"}
                title={
                  quadro.status === "rascunho"
                    ? "Publique o quadro para baixar o PDF"
                    : "Baixar PDF"
                }
                className="btn-acao btn-pdf"
                style={{
                  opacity:
                    downloading || quadro.status === "rascunho" ? 0.6 : 1,
                  filter:
                    quadro.status === "rascunho" ? "grayscale(100%)" : "none",
                }}
              >
                <Download size={18} />
                <span>{downloading ? "PDF..." : "PDF"}</span>
              </button>

              <button
                onClick={confirmDeleteQuadro}
                className="btn-acao btn-excluir"
              >
                <Trash2 size={18} />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>

        {/* Conteudo */}
        <div className="quadro-content">
          <div className="quadro-grid">
            {/* Tabelas (Coluna da esquerda) */}
            <div className="quadro-tabelas">
              {paginas.map((dadosPagina, index) => (
                <div key={index}>
                  {/* Tabela Interativa (Visivel) */}
                  <div className="tabela-wrapper">
                    <TabelaQuadro
                      dados={dadosPagina}
                      quadro={quadro}
                      updateDesignacao={updateDesignacao}
                      onHistoricoUpdate={atualizarHistorico}
                      onDeleteDia={handleDeleteDia}
                      id={`tabela-view-${index + 1}`}
                    />
                  </div>

                  {/* Versao para PDF (Oculta mas renderizada para captura) */}
                  <div
                    style={{ position: "absolute", left: "-9999px", top: 0 }}
                  >
                    <TabelaPDF
                      dados={dadosPagina}
                      quadro={quadro}
                      id={`tabela-pdf-${index + 1}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar com Estatisticas e Historico (Coluna da direita) */}
            <div className="quadro-sidebar-direita">
              {/* Estatisticas */}
              <div className="estatisticas-panel">
                <h3 className="estatisticas-title">📊 Estatísticas do Mês</h3>

                {(() => {
                  // Calcular quantas vezes cada irmao aparece
                  const contagem = {};
                  quadro.designacoes.forEach((d) => {
                    if (d.irmao1) {
                      contagem[d.irmao1] = (contagem[d.irmao1] || 0) + 1;
                    }
                    if (d.irmao2) {
                      contagem[d.irmao2] = (contagem[d.irmao2] || 0) + 1;
                    }
                  });

                  const ordenado = Object.entries(contagem).sort(
                    (a, b) => b[1] - a[1],
                  );
                  const semDesignacao = ordenado.length === 0;

                  if (semDesignacao) {
                    return (
                      <div
                        className="estatistica-footer"
                        style={{ borderTop: "none" }}
                      >
                        Nenhuma designação definida
                      </div>
                    );
                  }

                  const maxDesignacoes = Math.max(
                    ...ordenado.map(([_, v]) => v),
                  );

                  // Calcular irmaos ativos que nao foram designados
                  const irmaosAtivos = irmaos
                    .filter((i) => i.ativo)
                    .map((i) => i.nome);
                  const nomesDesignados = Object.keys(contagem);
                  const naoDesignados = irmaosAtivos.filter(
                    (nome) => !nomesDesignados.includes(nome),
                  );

                  return (
                    <div className="estatisticas-list">
                      {ordenado.map(([nome, count]) => (
                        <div
                          key={nome}
                          className={`estatistica-item clickable ${count === maxDesignacoes ? "top-rank" : ""}`}
                          onClick={() => setIrmaoModalAberto(nome)}
                          title={`Ver detalhes de ${nome}`}
                        >
                          <div className="estatistica-nome">{nome}</div>
                          <div
                            className={`estatistica-badge ${count === 0 ? "badge-zero" : "badge-normal"}`}
                          >
                            {count}x
                          </div>
                        </div>
                      ))}

                      {naoDesignados.length === 0 ? (
                        <div
                          className="estatistica-footer"
                          style={{
                            color: "#5E6B48",
                            fontWeight: "600",
                            borderTop: "1px solid #E6DCC9",
                            paddingTop: "0.75rem",
                            marginTop: "0.5rem",
                          }}
                        >
                          ✅ Todos os {irmaosAtivos.length} irmãos ativos foram
                          designados neste mês!
                        </div>
                      ) : (
                        <div
                          className="estatistica-footer"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            alignItems: "flex-start",
                            textAlign: "left",
                            borderTop: "1px solid #E6DCC9",
                            paddingTop: "0.75rem",
                            marginTop: "0.5rem",
                          }}
                        >
                          <div>
                            <strong>
                              Total: {nomesDesignados.length} irmãos designados
                            </strong>
                          </div>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "#8A8071",
                              lineHeight: "1.4",
                            }}
                          >
                            <strong>
                              Ainda não designados ({naoDesignados.length}):
                            </strong>
                            <br />
                            {naoDesignados.join(", ")}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <HistoricoPanel ref={historicoRef} quadroId={parseInt(id)} />
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        {...modalConfig}
      />

      <EstatisticasIrmaoModal
        isOpen={!!irmaoModalAberto}
        onClose={() => setIrmaoModalAberto(null)}
        irmaoNome={irmaoModalAberto}
        quadro={quadro}
      />
    </div>
  );
}
