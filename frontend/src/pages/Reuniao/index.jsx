import React, { useState, useEffect, useRef } from "react";
import {
  Gem,
  FileText,
  Heart,
  Globe,
  Upload,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Wheat,
  Users,
  LayoutTemplate,
} from "lucide-react";
import { Link } from "react-router-dom";
import "./styles.css";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/PageHeader";
import html2canvas from "html2canvas";
import Swal from "sweetalert2";

export default function Reuniao() {
  const { authFetch } = useAuth();
  const [reunioes, setReunioes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const fileInputRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    loadReunioes();
  }, []);

  const loadReunioes = async () => {
    try {
      setLoading(true);
      const res = await authFetch("/reunioes");
      if (res.ok) {
        const data = await res.json();
        setReunioes(data);
      } else {
        console.error("Failed to fetch meetings:", res.status, res.statusText);
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to load meetings");
      }
    } catch (error) {
      console.error("Erro ao carregar reuniões:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await authFetch("/reunioes/import", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await loadReunioes();
        Swal.fire({
          title: "Importado com Sucesso!",
          text: "Os dados da reunião foram salvos.",
          icon: "success",
          confirmButtonColor: "#538d35",
        });
      } else {
        const errorData = await res.json();
        console.error("Payload de erro recebido do backend:", errorData);
        throw new Error(
          errorData.error || errorData.message || "Falha na importação",
        );
      }
    } catch (error) {
      console.error("Erro na importação:", error);
      Swal.fire({
        title: "Erro na Importação",
        text: error.message,
        icon: "error",
        confirmButtonColor: "#d33",
      });
    } finally {
      setLoading(false);
      e.target.value = ""; // Limpar input
    }
  };

  const toggleWeek = (weekId) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekId]: !prev[weekId],
    }));
  };

  const exportAsImage = async (weekId) => {
    const element = document.getElementById(`week-content-${weekId}`);
    if (!element) return;

    try {
      const originalPadding = element.style.padding;
      const originalBorderRadius = element.style.borderRadius;
      const originalBoxShadow = element.style.boxShadow;

      element.style.padding = "10px";
      element.style.borderRadius = "8px";
      element.style.boxShadow = "none";

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `programacao-semana-${weekId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      // Restaurar estilização
      element.style.padding = originalPadding;
      element.style.borderRadius = originalBorderRadius;
      element.style.boxShadow = originalBoxShadow;
    } catch (error) {
      console.error("Erro ao exportar imagem:", error);
    }
  };

  const nomesMeses = [
    "",
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

  const deleteReuniao = async (id) => {
    const result = await Swal.fire({
      title: "Tem certeza?",
      text: "Deseja excluir toda a programação deste mês?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      const res = await authFetch(`/reunioes/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadReunioes();
      }
    } catch (error) {
      console.error("Erro ao excluir reunião:", error);
    } finally {
      setLoading(false);
    }
  };
  const renderParte = (titulo, fallbackHora, fallbackTexto = "-") => {
    if (!titulo)
      return (
        <>
          <span className="hora">{fallbackHora}</span> {fallbackTexto}
        </>
      );
    const match = titulo.match(/^(\d{2}:\d{2})\s+(.*)$/);
    if (match) {
      return (
        <>
          <span className="hora">{match[1]}</span> {match[2]}
        </>
      );
    }
    return (
      <>
        <span className="hora">{fallbackHora}</span> {titulo}
      </>
    );
  };

  const renderCantico = (canticoStr, fallbackHora) => {
    if (!canticoStr || canticoStr === "-")
      return (
        <>
          <span className="hora">{fallbackHora}</span> Cântico -
        </>
      );
    const [hora, num] = canticoStr.includes("|")
      ? canticoStr.split("|")
      : [fallbackHora, canticoStr];
    return (
      <>
        <span className="hora">{hora !== "null" ? hora : fallbackHora}</span>{" "}
        Cântico {num}
      </>
    );
  };

  return (
    <>
      <PageHeader
        title="Reuniões"
        description="Gerencie a programação das reuniões congregacionais"
        icon={Globe}
        color="blue"
      />
      <div className="reuniao-page">
        <div className="actions-bar">
          <Link to="/reunioes/v2" className="btn-v2">
            <LayoutTemplate size={18} /> Visualizar novo layout
          </Link>
          <button
            className="btn-import"
            onClick={handleImportClick}
            disabled={loading}
          >
            <Upload size={18} /> {loading ? "Processando..." : "Importar Excel"}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            style={{ display: "none" }}
          />
        </div>

        <div className="reunioes-container">
          {reunioes.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <p>Nenhuma reunião importada ainda.</p>
              <p className="sub-empty">
                Clique em "Importar Excel" para começar.
              </p>
            </div>
          )}

          {reunioes.map((reuniao) => (
            <div key={reuniao.id} className="month-card">
              <div className="month-header">
                <h2>
                  {nomesMeses[reuniao.mes]} {reuniao.ano}
                </h2>
                <button
                  className="btn-delete"
                  onClick={() => deleteReuniao(reuniao.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="weeks-list">
                {reuniao.semanas.map((semana) => (
                  <div key={semana.id} className="week-item">
                    <div
                      className="week-header-action"
                      onClick={() => toggleWeek(semana.id)}
                    >
                      <div className="week-info">
                        <FileText size={16} />
                        <span>{semana.faixaData}</span>
                      </div>
                      <div className="week-controls">
                        <button
                          className="btn-export-mini"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportAsImage(semana.id);
                          }}
                          title="Exportar como imagem"
                        >
                          <Download size={16} />
                        </button>
                        {expandedWeeks[semana.id] ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </div>
                    </div>

                    {expandedWeeks[semana.id] && (
                      <div
                        className="week-content-wrapper"
                        id={`week-content-${semana.id}`}
                      >
                        {/* ESTRUTURA VISUAL DA REUNIÃO (IDÊNTICA À ANTERIOR) */}
                        <div className="reuniao-wrapper internal-view">
                          <div className="reuniao-global-header">
                            <div className="jw-logo-box">
                              <Globe size={18} style={{ marginRight: "4px" }} />{" "}
                              JW.ORG
                            </div>
                            <div className="mes-semana">{semana.faixaData}</div>
                            <div className="congregacao-nome">
                              Congregação: Norte de Itapuã
                            </div>
                          </div>

                          <div className="secao-meio-semana">
                            <div className="cabecalho-detalhado">
                              <div className="data-leitura">
                                <strong>{semana.dataReuniao}</strong> |{" "}
                                {semana.leituraSemanal}
                                <div className="canticos-iniciais">
                                  <div className="linha-info">
                                    {renderCantico(
                                      semana.canticoInicial,
                                      "19:30",
                                    )}
                                  </div>
                                  <div className="linha-info">
                                    <span>19:35</span> Comentários Iniciais (1
                                    min)
                                  </div>
                                </div>
                              </div>
                              <div className="presidente-infos">
                                <div className="linha-atribuicao">
                                  <span className="label">Presidente:</span>
                                  <span className="nome">
                                    {semana.presidente || "A definir"}
                                  </span>
                                </div>
                                <div className="linha-atribuicao">
                                  <span className="label">
                                    Conselheiro da Sala B:
                                  </span>
                                  <span className="nome">
                                    {semana.conselheiroB || "A definir"}
                                  </span>
                                </div>
                                <div className="linha-atribuicao">
                                  <span className="label">Oração:</span>
                                  <span className="nome">
                                    {semana.presidente || "A definir"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* TESOUROS */}
                            <div className="bloco-reuniao tesouros">
                              <div className="bloco-header bg-tesouros">
                                <div className="bloco-titulo">
                                  <Gem size={18} fill="white" /> O TESOUROS DA
                                  PALAVRA DE DEUS
                                </div>
                                <div className="bloco-sala-b-header">
                                  Sala B
                                </div>
                                <div className="bloco-sala-principal-header">
                                  Salão Principal
                                </div>
                              </div>
                              <div className="bloco-body">
                                <div className="linha-designacao">
                                  <div className="desc">
                                    {renderParte(
                                      semana.tesouro1_titulo,
                                      "19:36",
                                    )}
                                  </div>
                                  <div className="sala-b"></div>
                                  <div className="sala-principal">
                                    {semana.tesouro1_irmao || "-"}
                                  </div>
                                </div>
                                <div className="linha-designacao">
                                  <div className="desc">
                                    {renderParte(
                                      semana.tesouro2_titulo,
                                      "19:46",
                                      "Joias espirituais (10 min)",
                                    )}
                                  </div>
                                  <div className="sala-b"></div>
                                  <div className="sala-principal">
                                    {semana.tesouro2_irmao || "A definir"}
                                  </div>
                                </div>
                                <div className="linha-designacao">
                                  <div className="desc">
                                    {renderParte(
                                      semana.tesouro3_titulo,
                                      "19:57",
                                      "Leitura da Bíblia (4 min)",
                                    )}
                                  </div>
                                  <div className="sala-b">
                                    {semana.tesouro3_salaB &&
                                    semana.tesouro3_salaB !== "-"
                                      ? semana.tesouro3_salaB
                                      : ""}
                                  </div>
                                  <div className="sala-principal">
                                    {semana.tesouro3_principal || "-"}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* MINISTÉRIO (Simplificado para o primeiro protótipo dinâmico) */}
                            <div className="bloco-reuniao ministerio">
                              <div className="bloco-header bg-ministerio">
                                <div className="bloco-titulo">
                                  <Wheat size={18} /> FAÇA SEU MELHOR NO
                                  MINISTÉRIO
                                </div>
                                <div className="bloco-sala-b-header">
                                  Sala B
                                </div>
                                <div className="bloco-sala-principal-header">
                                  Salão Principal
                                </div>
                              </div>
                              <div className="bloco-body">
                                <div className="linha-designacao duas-linhas">
                                  <div className="desc">
                                    {renderParte(
                                      semana.ministerio1_titulo,
                                      "20:02",
                                      "Iniciando conversas",
                                    )}
                                  </div>
                                  <div className="sala-b text-right">
                                    {semana.ministerio1_salaB &&
                                    semana.ministerio1_salaB !== "-"
                                      ? semana.ministerio1_salaB
                                      : ""}
                                  </div>
                                  <div className="sala-principal text-right">
                                    {semana.ministerio1_principal || "-"}
                                  </div>
                                </div>
                                {semana.ministerio2_titulo && (
                                  <div className="linha-designacao duas-linhas">
                                    <div className="desc">
                                      {renderParte(
                                        semana.ministerio2_titulo,
                                        "20:07",
                                      )}
                                    </div>
                                    <div className="sala-b text-right">
                                      {semana.ministerio2_salaB &&
                                      semana.ministerio2_salaB !== "-"
                                        ? semana.ministerio2_salaB
                                        : ""}
                                    </div>
                                    <div className="sala-principal text-right">
                                      {semana.ministerio2_principal || "-"}
                                    </div>
                                  </div>
                                )}
                                {semana.ministerio3_titulo && (
                                  <div className="linha-designacao duas-linhas">
                                    <div className="desc">
                                      {renderParte(
                                        semana.ministerio3_titulo,
                                        "20:12",
                                      )}
                                    </div>
                                    <div className="sala-b text-right">
                                      {semana.ministerio3_salaB &&
                                      semana.ministerio3_salaB !== "-"
                                        ? semana.ministerio3_salaB
                                        : ""}
                                    </div>
                                    <div className="sala-principal text-right">
                                      {semana.ministerio3_principal || "-"}
                                    </div>
                                  </div>
                                )}
                                {semana.ministerio4_titulo && (
                                  <div className="linha-designacao duas-linhas">
                                    <div className="desc">
                                      {renderParte(
                                        semana.ministerio4_titulo,
                                        "20:14",
                                      )}
                                    </div>
                                    <div className="sala-b text-right">
                                      {semana.ministerio4_salaB &&
                                      semana.ministerio4_salaB !== "-"
                                        ? semana.ministerio4_salaB
                                        : ""}
                                    </div>
                                    <div className="sala-principal text-right">
                                      {semana.ministerio4_principal || "-"}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* VIDA CRISTÃ */}
                            <div className="bloco-reuniao vida-crista">
                              <div className="bloco-header bg-vida-crista">
                                <div className="bloco-titulo">
                                  <Users size={18} fill="white" /> NOSSA VIDA
                                  CRISTÃ
                                </div>
                              </div>
                              <div className="bloco-body">
                                <div className="linha-info-solta">
                                  {renderCantico(semana.canticoMeio, "20:16")}
                                </div>
                                <div className="linha-designacao">
                                  <div className="desc">
                                    {renderParte(
                                      semana.vidaCrista1_titulo,
                                      "20:20",
                                    )}
                                  </div>
                                  <div className="sala-unica">
                                    {semana.vidaCrista1_irmao || "-"}
                                  </div>
                                </div>
                                {semana.vidaCrista2_titulo && (
                                  <div className="linha-designacao">
                                    <div className="desc">
                                      {renderParte(
                                        semana.vidaCrista2_titulo,
                                        "20:25",
                                      )}
                                    </div>
                                    <div className="sala-unica">
                                      {semana.vidaCrista2_irmao || "-"}
                                    </div>
                                  </div>
                                )}
                                <div className="linha-designacao">
                                  <div className="desc">
                                    <span className="hora">20:35</span> Estudo
                                    bíblico de congregação (30 min)
                                  </div>
                                  <div className="sala-unica">
                                    <span className="label-inline">
                                      Dirigente/Leitor:
                                    </span>{" "}
                                    {semana.estudoBiblico_dirigente || "-"} /{" "}
                                    {semana.estudoBiblico_leitor}
                                  </div>
                                </div>
                                <div className="linha-designacao">
                                  <div className="desc">
                                    <span className="hora">21:05</span>{" "}
                                    Comentários finais (3 min)
                                  </div>
                                  <div className="sala-unica">-</div>
                                </div>
                                <div className="linha-designacao no-border final-oracao">
                                  <div className="desc">
                                    {renderCantico(
                                      semana.canticoFinal,
                                      "21:08",
                                    )}
                                  </div>
                                  <div className="sala-unica">
                                    <span className="label-inline">
                                      Oração Final:
                                    </span>{" "}
                                    {semana.oracaoFinal || "A definir"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="divisor-secoes"></div>

                          <div className="secao-fim-semana">
                            <div className="fim-semana-header">
                              Reunião Congregacional - Final de Semana
                            </div>
                            <div className="fim-semana-detalhes">
                              <div className="linha-fim-semana">
                                <span className="label-fim">Presidente:</span>
                                <span className="valor-fim">
                                  {semana.fds_presidente || "A definir"}
                                </span>
                              </div>
                              <div className="linha-fim-semana">
                                <span className="label-fim">Tema:</span>
                                <span className="valor-fim">
                                  {semana.fds_tema || "-"}
                                </span>
                              </div>
                              <div className="linha-fim-semana duplo-fim">
                                <div className="esq-fim">
                                  <span className="label-fim">Orador:</span>
                                  <span className="valor-fim">
                                    {semana.fds_orador || "-"}
                                  </span>
                                </div>
                                <div className="dir-fim">
                                  <span className="label-fim">Cong:</span>
                                  <span className="valor-fim">
                                    {semana.fds_congregacao ||
                                      "Norte de Itapuã"}
                                  </span>
                                </div>
                              </div>
                              <div className="linha-fim-semana">
                                <span className="label-fim">
                                  Leitor da Sentinela:
                                </span>
                                <span className="valor-fim">
                                  {semana.fds_leitor || ""}
                                </span>
                              </div>
                            </div>
                          </div>

                          {semana.limpeza && (
                            <div
                              className="secao-fim-semana"
                              style={{ paddingTop: "0" }}
                            >
                              <div className="limpeza-header">
                                LIMPEZA SEMANAL
                              </div>
                              <div className="fim-semana-detalhes">
                                <div className="linha-fim-semana">
                                  <span className="label-fim">Designados:</span>
                                  <span className="valor-fim">
                                    {semana.limpeza}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
