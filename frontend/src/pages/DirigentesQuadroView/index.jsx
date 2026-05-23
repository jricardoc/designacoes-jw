import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  Compass,
  ArrowLeft,
  Download,
  Check,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import TabelaDirigentes from "../../components/TabelaDirigentes";
import TabelaDirigentesPDF from "../../components/TabelaDirigentesPDF";
import { useToast, ToastContainer } from "../../components/Toast";
import ConfirmModal from "../../components/ConfirmModal";
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
  rascunho: { label: "Rascunho", color: "#f59e0b", bg: "#fef3c7" },
  publicado: { label: "Publicado", color: "#10b981", bg: "#d1fae5" },
  arquivado: { label: "Arquivado", color: "#64748b", bg: "#f1f5f9" },
};

export default function DirigentesQuadroView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const [quadro, setQuadro] = useState(null);
  const [irmaosDirigentes, setIrmaosDirigentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false });

  const openModal = (config) => setModalConfig({ ...config, isOpen: true });
  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));

  const carregarQuadro = async () => {
    try {
      const [responseQuadro, responseIrmaos] = await Promise.all([
        authFetch(`/dirigentes/quadros/${id}`),
        authFetch("/irmaos"), // Para pegar a lista de irmãos e filtrar os dirigentes
      ]);

      if (responseQuadro.ok && responseIrmaos.ok) {
        const dataQuadro = await responseQuadro.json();
        const dataIrmaos = await responseIrmaos.json();
        
        setQuadro(dataQuadro);
        setIrmaosDirigentes(dataIrmaos.filter(i => i.funcoes && i.funcoes.includes('dirigente') && i.ativo));
      } else {
        navigate("/dirigentes");
      }
    } catch (error) {
      console.error("Erro:", error);
      navigate("/dirigentes");
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarQuadro();
  }, [id]);

  // Atualizar dirigente
  const updateEscala = async (escalaId, campo, valor) => {
    // Atualizar local primeiro
    setQuadro((prev) => ({
      ...prev,
      escalas: prev.escalas.map((d) => {
        if (d.id === escalaId) {
          return { ...d, [campo]: valor };
        }
        return d;
      }),
    }));

    // Salvar no backend
    try {
      const response = await authFetch("/dirigentes/escala", {
        method: "PUT",
        body: JSON.stringify({
          escalaId,
          campo,
          valor,
        }),
      });

      if (response.ok) {
        addToast("Escala atualizada com sucesso!", "success");
      } else {
        addToast("Erro ao salvar escala", "error");
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      addToast("Erro de conexao ao salvar", "error");
    }
  };

  // Alterar status
  const alterarStatus = async (novoStatus) => {
    try {
      const response = await authFetch(`/dirigentes/quadros/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: novoStatus }),
      });

      if (response.ok) {
        setQuadro((prev) => ({ ...prev, status: novoStatus }));
        const statusLabel = STATUS_CONFIG[novoStatus]?.label || novoStatus;
        addToast(`Quadro ${statusLabel.toLowerCase()} com sucesso!`, "success");
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

      const totalPaginas = document.querySelectorAll('[id^="tabela-pdf-"]').length;

      for (let i = 1; i <= totalPaginas; i++) {
        const element = document.getElementById(`tabela-pdf-${i}`);
        if (element) {
          if (i > 1) pdf.addPage();

          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
          });

          const imgData = canvas.toDataURL("image/jpeg", 0.92);
          pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
        }
      }

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const nomeMes = MESES[quadro.mes] ? MESES[quadro.mes].toLowerCase() : "mes";
      link.download = `escala-dirigentes-${nomeMes}-${quadro.ano}.pdf`;

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
      title: "Remover dia da escala",
      message: `Tem certeza que deseja remover todas as saídas do dia ${data}?`,
      type: "danger",
      confirmText: "Sim, Remover",
      cancelText: "Cancelar",
      onConfirm: async () => {
        try {
          const response = await authFetch("/dirigentes/escala/dia", {
            method: "DELETE",
            body: JSON.stringify({
              quadroId: parseInt(id),
              data,
            }),
          });

          if (response.ok) {
            addToast("Dia removido com sucesso!", "success");
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
      title: "Excluir Escala",
      message: `Deseja excluir a escala de dirigentes de ${MESES[quadro.mes]} ${quadro.ano}? Esta ação não pode ser desfeita.`,
      type: "danger",
      confirmText: "Sim, excluir",
      onConfirm: async () => {
        try {
          const response = await authFetch(`/dirigentes/quadros/${id}`, {
            method: "DELETE",
          });
          if (response.ok) {
            addToast("Escala excluída com sucesso!", "success");
            setTimeout(() => navigate("/dirigentes"), 500);
          } else {
            addToast("Erro ao excluir escala", "error");
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
        <div style={{ flex: 1, marginLeft: "70px", padding: "3rem", textAlign: "center", color: "#64748b" }}>
          Carregando escala...
        </div>
      </div>
    );
  }

  if (!quadro) {
    return null;
  }

  // Agrupar escalas por data
  // Para isso, criamos um array de dias.
  const grupos = Object.values(
    quadro.escalas.reduce((acc, d) => {
      if (!acc[d.data]) {
        acc[d.data] = { 
          data: d.data, 
          dia: d.dia, 
          escalas: [],
          // Só pegamos todos os dirigentes para o dropdown.
          // O ideal seria filtrar por dirigentes disponíveis naquela saída, mas para simplificar
          // aqui e permitir que se coloque qualquer dirigente caso precisem, vamos mandar todos os dirigentes ativos
          // ou se tiver a lógica pronta, extrair.
          candidatosDisponiveis: irmaosDirigentes.map(i => i.nome)
        };
      }
      acc[d.data].escalas.push(d);
      return acc;
    }, {})
  ).sort((a, b) => {
    const [diaA, mesA] = a.data.split("/").map(Number);
    const [diaB, mesB] = b.data.split("/").map(Number);
    return mesA * 100 + diaA - (mesB * 100 + diaB);
  });

  // Paginação dinâmica para o PDF/Visualização
  const ITEMS_PER_PAGE = 12; // 12 dias = exatamente 2 semanas completas por página
  const paginas = [];
  for (let i = 0; i < grupos.length; i += ITEMS_PER_PAGE) {
    paginas.push(grupos.slice(i, i + ITEMS_PER_PAGE));
  }

  const statusConfig = STATUS_CONFIG[quadro.status];

  // Estatísticas
  const contagem = {};
  quadro.escalas.forEach((d) => {
    if (d.principal) contagem[d.principal] = (contagem[d.principal] || 0) + 1;
    if (d.substituto) contagem[d.substituto] = (contagem[d.substituto] || 0) + 1;
  });

  const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  return (
    <div className="quadro-container">
      <Sidebar />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="quadro-main">
        {/* Header */}
        <div className="quadro-header">
          <Link to="/dirigentes" className="link-voltar">
            <ArrowLeft size={18} />
            Voltar para Dirigentes
          </Link>

          <div className="header-actions-row">
            <div className="header-title-group">
              <div className="header-icon-box" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                <Compass size={28} />
              </div>
              <div className="header-info-content">
                <h1 className="header-title">
                  {quadro.titulo}
                  <span
                    className="header-status-badge"
                    style={{ background: statusConfig.bg, color: statusConfig.color }}
                  >
                    {statusConfig.label}
                  </span>
                </h1>
                <p className="header-subtitle">
                  {quadro.escalas.length} saídas programadas
                </p>
              </div>
            </div>

            <div className="header-buttons-wrapper">
              {quadro.status === "rascunho" && (
                <button onClick={() => alterarStatus("publicado")} className="btn-acao btn-publicar">
                  <Check size={18} />
                  <span>Publicar</span>
                </button>
              )}

              <button
                onClick={handleDownloadPDF}
                disabled={downloading || quadro.status === "rascunho"}
                title={quadro.status === "rascunho" ? "Publique o quadro para baixar o PDF" : "Baixar PDF"}
                className="btn-acao btn-pdf"
                style={{
                  opacity: downloading || quadro.status === "rascunho" ? 0.6 : 1,
                  filter: quadro.status === "rascunho" ? "grayscale(100%)" : "none",
                }}
              >
                <Download size={18} />
                <span>{downloading ? "PDF..." : "PDF"}</span>
              </button>

              <button onClick={confirmDeleteQuadro} className="btn-acao btn-excluir">
                <Trash2 size={18} />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="quadro-content">
          <div className="quadro-grid">
            {/* Tabelas */}
            <div className="quadro-tabelas">
              {paginas.map((dadosPagina, index) => (
                <div key={index}>
                  <div className="tabela-wrapper">
                    <TabelaDirigentes
                      dados={dadosPagina}
                      quadro={quadro}
                      updateEscala={updateEscala}
                      onDeleteDia={handleDeleteDia}
                      id={`tabela-view-${index + 1}`}
                      semanaInicial={(index * 2) + 1}
                    />
                  </div>

                  <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
                    <TabelaDirigentesPDF
                      dados={dadosPagina}
                      quadro={quadro}
                      id={`tabela-pdf-${index + 1}`}
                      semanaInicial={(index * 2) + 1}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar com Estatísticas */}
            <div className="quadro-sidebar-direita">
              <div className="estatisticas-panel">
                <h3 className="estatisticas-title">📊 Escalas do Mês</h3>
                
                {ordenado.length === 0 ? (
                  <div className="estatistica-footer" style={{ borderTop: "none" }}>
                    Nenhuma designação definida
                  </div>
                ) : (
                  <div className="estatisticas-list">
                    {ordenado.map(([nome, count]) => (
                      <div key={nome} className="estatistica-item">
                        <div className="estatistica-nome">{nome}</div>
                        <div className="estatistica-badge badge-normal">{count}x</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        {...modalConfig}
      />
    </div>
  );
}
