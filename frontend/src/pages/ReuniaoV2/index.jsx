import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Gem,
  FileText,
  Globe,
  Upload,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Wheat,
  Users,
  CalendarDays,
  Clock,
  ArrowLeft,
} from "lucide-react";
import "./styles.css";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/PageHeader";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Swal from "sweetalert2";
import EditableField from "../../components/EditableField";

export default function ReuniaoV2() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [reunioes, setReunioes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState({});

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
        throw new Error("Failed to load meetings");
      }
    } catch (error) {
      console.error("Erro ao carregar reuniões:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWeek = (weekId) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekId]: !prev[weekId],
    }));
  };

  const handleFieldUpdate = async (semanaId, campo, valor) => {
    try {
      const res = await authFetch(`/reunioes/semanas/${semanaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo, valor }),
      });
      if (res.ok) {
        setReunioes((prev) =>
          prev.map((r) => ({
            ...r,
            semanas: r.semanas.map((s) =>
              s.id === semanaId ? { ...s, [campo]: valor } : s
            ),
          }))
        );
      } else {
        console.error("Falha ao atualizar campo");
      }
    } catch (error) {
      console.error("Erro:", error);
    }
  };

  const exportAsImage = async (weekId) => {
    // Temporarily open the accordion to capture content if collapsed (similar to PDF fix)
    const isTemporarilyOpened = !expandedWeeks[weekId];
    if (isTemporarilyOpened) {
      setExpandedWeeks((prev) => ({ ...prev, [weekId]: true }));
      // Wait for React to render the expanded DOM
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const element = document.getElementById(`v2-week-content-${weekId}`);
    if (!element) return;

    try {
      const originalTransform = element.style.transform;
      element.style.transform = "none";

      const canvas = await html2canvas(element, {
        scale: 4, // Quadruplica a resolução nativa da tela para hiper qualidade
        useCORS: true,
        backgroundColor: "#f4f7f6",
      });
      const link = document.createElement("a");
      link.download = `programacao-v2-${weekId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      element.style.transform = originalTransform;
    } catch (error) {
      console.error("Erro ao exportar imagem:", error);
    } finally {
      // Revert Accordion state if we forced it open
      if (isTemporarilyOpened) {
        setExpandedWeeks((prev) => ({ ...prev, [weekId]: false }));
      }
    }
  };

  const exportAsPdf = async (weekId) => {
    const element = document.getElementById(`v2-week-content-${weekId}`);
    if (!element) return;

    try {
      const originalTransform = element.style.transform;
      const originalPadding = element.style.padding;

      // Remove os "espaços brancos" extras (padding) do container antes do clique do documento
      element.style.transform = "none";
      element.style.padding = "0px";

      const canvas = await html2canvas(element, {
        scale: 1.5, // Reduzido para evitar lentidão e megabytes massivos
        useCORS: true,
        backgroundColor: "#f4f7f6",
      });

      // Restaura o estilo depois que a foto for batida
      element.style.transform = originalTransform;
      element.style.padding = originalPadding;

      // Usa JPEG para comprimir drasticamente o PDF
      const imgData = canvas.toDataURL("image/jpeg", 0.7);
      const pdf = new jsPDF("p", "mm", "a4"); // "p" para portrait (vertical)

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const marginX = 5;
      const marginY = 5; // Encostado no topo

      const availableWidth = pdfWidth - marginX * 2;
      const availableHeight = pdfHeight - marginY * 2;

      const imgProps = pdf.getImageProperties(imgData);
      const imgRatio = imgProps.width / imgProps.height;
      const pdfRatio = availableWidth / availableHeight;

      let finalWidth, finalHeight;
      if (imgRatio > pdfRatio) {
        finalWidth = availableWidth;
        finalHeight = availableWidth / imgRatio;
      } else {
        finalHeight = availableHeight;
        finalWidth = availableHeight * imgRatio;
      }

      // No X (A4 vertical) preenche as laterais, e no Y trava no Topo!
      const x = marginX + (availableWidth - finalWidth) / 2;
      const y = marginY; // Não centraliza verticalmente, cola no topo

      pdf.addImage(
        imgData,
        "JPEG",
        x,
        y,
        finalWidth,
        finalHeight,
        undefined,
        "FAST",
      );
      pdf.save(`programacao-v2-${weekId}.pdf`);
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      Swal.fire(
        "Erro",
        "Não foi possível gerar o PDF da programação.",
        "error",
      );
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

  const renderTitleTime = (titulo, defaultTime, fallbackText = null) => {
    if (!titulo || titulo === "-")
      return { time: defaultTime, text: fallbackText || "-" };
    const match = titulo.match(/^(\d{1,2}:\d{2})\s+(.*)$/);
    if (match) {
      return { time: match[1], text: match[2] };
    }
    return { time: defaultTime, text: titulo };
  };

  const renderCantico = (canticoStr, defaultTime) => {
    if (!canticoStr || canticoStr === "-")
      return { time: defaultTime, num: "-" };
    const [hora, num] = canticoStr.includes("|")
      ? canticoStr.split("|")
      : [defaultTime, canticoStr];
    return { time: hora !== "null" ? hora : defaultTime, num: num };
  };

  return (
    <>
      <PageHeader
        title="Reuniões (V2.0)"
        description="Layout premium e surreal para designações"
        icon={Globe}
        color="blue"
      />
      <div className="v2-page-container">
        <div className="v2-actions-bar">
          <button className="v2-btn-back" onClick={() => navigate("/reuniao")}>
            <ArrowLeft size={18} /> Voltar para o Clássico
          </button>
        </div>

        <div className="v2-reunioes-list">
          {reunioes.length === 0 && !loading && (
            <div className="v2-empty-state">
              <CalendarDays size={48} className="v2-empty-icon" />
              <p>Nenhuma reunião importada no banco.</p>
              <span>Vá para a visão clássica e importe o arquivo.</span>
            </div>
          )}

          {reunioes.map((reuniao) => (
            <div key={reuniao.id} className="v2-month-group">
              <h1 className="v2-month-title">
                {nomesMeses[reuniao.mes]}{" "}
                <span className="v2-year-highlight">{reuniao.ano}</span>
              </h1>

              <div className="v2-weeks-container">
                {reuniao.semanas.map((semana) => (
                  <div key={semana.id} className="v2-week-card">
                    <div
                      className={`v2-week-toggle ${expandedWeeks[semana.id] ? "active" : ""}`}
                      onClick={() => toggleWeek(semana.id)}
                    >
                      <div className="v2-week-dates">
                        <CalendarDays size={20} className="v2-icon-date" />
                        Semana: <strong>{semana.faixaData}</strong>
                      </div>
                      <div className="v2-controls">
                        {expandedWeeks[semana.id] && (
                          <>
                            <button
                              className="v2-btn-pdf"
                              onClick={(e) => {
                                e.stopPropagation();
                                exportAsPdf(semana.id);
                              }}
                              title="Fazer Download (PDF)"
                            >
                              <FileText size={16} /> Exportar PDF
                            </button>
                            <button
                              className="v2-btn-export"
                              onClick={(e) => {
                                e.stopPropagation();
                                exportAsImage(semana.id);
                              }}
                              title="Fazer Download (Poster)"
                            >
                              <Download size={16} /> Exportar Imagem
                            </button>
                          </>
                        )}
                        {expandedWeeks[semana.id] ? (
                          <ChevronUp size={24} />
                        ) : (
                          <ChevronDown size={24} />
                        )}
                      </div>
                    </div>

                    {expandedWeeks[semana.id] && (
                      <div
                        className="v2-exportable-poster"
                        id={`v2-week-content-${semana.id}`}
                      >
                        {/* HEADER DO POSTER */}
                        <div className="v2-poster-header">
                          <div className="v2-poster-brand">
                            <Globe size={24} />
                            <span>{nomesMeses[reuniao.mes].toUpperCase()} / {reuniao.ano}</span>
                          </div>
                          <div className="v2-poster-title">
                            <h2>Programação da Congregação</h2>
                            <h3>Norte de Itapuã</h3>
                          </div>
                        </div>

                        {/* DESKTOP COLUMNS: MEIO X FIM */}
                        <div className="v2-poster-grid">
                          {/* ==================================== */}
                          {/* COLUNA 1: REUNIÃO DO MEIO DA SEMANA  */}
                          {/* ==================================== */}
                          <div className="v2-col v2-col-meio">
                            <div className="v2-split-header">
                              <h4 className="v2-split-title">Meio da Semana</h4>
                              <div className="v2-split-meta">
                                <span className="v2-badge-date">
                                  {semana.dataReuniao}
                                </span>
                                <span className="v2-badge-reading">
                                  {semana.leituraSemanal}
                                </span>
                              </div>
                            </div>

                            <div className="v2-president-box">
                              <div className="v2-pres-item">
                                <span className="v2-pres-label">
                                  Presidente
                                </span>
                                <span className="v2-pres-value">
                                  {semana.presidente || "A definir"}
                                </span>
                              </div>
                              <div className="v2-pres-item">
                                <span className="v2-pres-label">
                                  Conselheiro B
                                </span>
                                <span className="v2-pres-value">
                                  {semana.conselheiroB || "-"}
                                </span>
                              </div>
                              <div className="v2-pres-item">
                                <span className="v2-pres-label">
                                  Oração Inicial
                                </span>
                                <span className="v2-pres-value">
                                  {semana.oracaoInicial ||
                                    semana.presidente ||
                                    "-"}
                                </span>
                              </div>
                            </div>

                            {/* INIT CÂNTICO */}
                            <div className="v2-cantico-row">
                              {(() => {
                                const cInit = renderCantico(
                                  semana.canticoInicial,
                                  "19:30",
                                );
                                return (
                                  <>
                                    <span className="v2-time">
                                      {cInit.time}
                                    </span>{" "}
                                    <span className="v2-desc">
                                      Cântico {cInit.num} e Comentários Iniciais
                                      (1min)
                                    </span>
                                  </>
                                );
                              })()}
                            </div>

                            {/* TESOUROS */}
                            <div className="v2-section v2-sec-tesouros">
                              <div className="v2-sec-title">
                                <Gem size={16} />{" "}
                                <span>TESOUROS DA PALAVRA</span>
                              </div>
                              <div className="v2-sec-body">
                                {/* T1 */}
                                <div className="v2-part-row">
                                  {(() => {
                                    const p = renderTitleTime(
                                      semana.tesouro1_titulo,
                                      "19:36",
                                    );
                                    return (
                                      <>
                                        <div className="v2-time">{p.time}</div>
                                        <div className="v2-desc">{p.text}</div>
                                        <div className="v2-assign">
                                          <span className="v2-principal">
                                            <EditableField value={semana.tesouro1_irmao} fieldName="tesouro1_irmao" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                          </span>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                                {/* T2 */}
                                <div className="v2-part-row">
                                  {(() => {
                                    const p = renderTitleTime(
                                      semana.tesouro2_titulo,
                                      "19:46",
                                      "Joias espirituais (10 min)",
                                    );
                                    return (
                                      <>
                                        <div className="v2-time">{p.time}</div>
                                        <div className="v2-desc">{p.text}</div>
                                        <div className="v2-assign">
                                          <span className="v2-principal">
                                            <EditableField value={semana.tesouro2_irmao} fieldName="tesouro2_irmao" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                          </span>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                                {/* T3 */}
                                <div className="v2-part-row">
                                  {(() => {
                                    const p = renderTitleTime(
                                      semana.tesouro3_titulo,
                                      "19:57",
                                      "Leitura da Bíblia (4 min)",
                                    );
                                    return (
                                      <>
                                        <div className="v2-time">{p.time}</div>
                                        <div className="v2-desc">{p.text}</div>
                                        <div className="v2-assign v2-multi">
                                          {semana.tesouro3_salaB &&
                                            semana.tesouro3_salaB !== "-" && (
                                              <span className="v2-salab">
                                                B: {semana.tesouro3_salaB}
                                              </span>
                                            )}
                                          <span className="v2-principal">
                                            <EditableField value={semana.tesouro3_principal} fieldName="tesouro3_principal" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                          </span>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* MINISTÉRIO */}
                            <div className="v2-section v2-sec-ministerio">
                              <div className="v2-sec-title">
                                <Wheat size={16} />{" "}
                                <span>FAÇA SEU MELHOR NO MINISTÉRIO</span>
                              </div>
                              <div className="v2-sec-body">
                                {/* M1 */}
                                <div className="v2-part-row">
                                  {(() => {
                                    const p = renderTitleTime(
                                      semana.ministerio1_titulo,
                                      "20:02",
                                      "Iniciando conversas",
                                    );
                                    return (
                                      <>
                                        <div className="v2-time">{p.time}</div>
                                        <div className="v2-desc">{p.text}</div>
                                        <div className="v2-assign v2-multi">
                                          {semana.ministerio1_salaB &&
                                            semana.ministerio1_salaB !==
                                              "-" && (
                                              <span className="v2-salab">
                                                B: {semana.ministerio1_salaB}
                                              </span>
                                            )}
                                          <span className="v2-principal">
                                            <EditableField value={semana.ministerio1_principal} fieldName="ministerio1_principal" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                          </span>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                                {/* M2 */}
                                {semana.ministerio2_titulo && (
                                  <div className="v2-part-row">
                                    {(() => {
                                      const p = renderTitleTime(
                                        semana.ministerio2_titulo,
                                        "20:07",
                                      );
                                      return (
                                        <>
                                          <div className="v2-time">
                                            {p.time}
                                          </div>
                                          <div className="v2-desc">
                                            {p.text}
                                          </div>
                                          <div className="v2-assign v2-multi">
                                            {semana.ministerio2_salaB &&
                                              semana.ministerio2_salaB !==
                                                "-" && (
                                                <span className="v2-salab">
                                                  B: {semana.ministerio2_salaB}
                                                </span>
                                              )}
                                            <span className="v2-principal">
                                              <EditableField value={semana.ministerio2_principal} fieldName="ministerio2_principal" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                            </span>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                                {/* M3 */}
                                {semana.ministerio3_titulo && (
                                  <div className="v2-part-row">
                                    {(() => {
                                      const p = renderTitleTime(
                                        semana.ministerio3_titulo,
                                        "20:12",
                                      );
                                      return (
                                        <>
                                          <div className="v2-time">
                                            {p.time}
                                          </div>
                                          <div className="v2-desc">
                                            {p.text}
                                          </div>
                                          <div className="v2-assign v2-multi">
                                            {semana.ministerio3_salaB &&
                                              semana.ministerio3_salaB !==
                                                "-" && (
                                                <span className="v2-salab">
                                                  B: {semana.ministerio3_salaB}
                                                </span>
                                              )}
                                            <span className="v2-principal">
                                              <EditableField value={semana.ministerio3_principal} fieldName="ministerio3_principal" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                            </span>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                                {/* M4 */}
                                {semana.ministerio4_titulo && (
                                  <div className="v2-part-row">
                                    {(() => {
                                      const p = renderTitleTime(
                                        semana.ministerio4_titulo,
                                        "20:14",
                                      );
                                      return (
                                        <>
                                          <div className="v2-time">
                                            {p.time}
                                          </div>
                                          <div className="v2-desc">
                                            {p.text}
                                          </div>
                                          <div className="v2-assign v2-multi">
                                            {semana.ministerio4_salaB &&
                                              semana.ministerio4_salaB !==
                                                "-" && (
                                                <span className="v2-salab">
                                                  B: {semana.ministerio4_salaB}
                                                </span>
                                              )}
                                            <span className="v2-principal">
                                              <EditableField value={semana.ministerio4_principal} fieldName="ministerio4_principal" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                            </span>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* VIDA CRISTÃ */}
                            <div className="v2-section v2-sec-vidacrista">
                              <div className="v2-sec-title">
                                <Users size={16} />{" "}
                                <span>NOSSA VIDA CRISTÃ</span>
                              </div>
                              <div className="v2-sec-body">
                                <div className="v2-cantico-meio">
                                  {(() => {
                                    const cm = renderCantico(
                                      semana.canticoMeio,
                                      "20:16",
                                    );
                                    return (
                                      <>
                                        <span className="v2-time">
                                          {cm.time}
                                        </span>{" "}
                                        Cântico {cm.num}
                                      </>
                                    );
                                  })()}
                                </div>

                                {/* V1 */}
                                <div className="v2-part-row">
                                  {(() => {
                                    const p = renderTitleTime(
                                      semana.vidaCrista1_titulo,
                                      "20:20",
                                    );
                                    return (
                                      <>
                                        <div className="v2-time">{p.time}</div>
                                        <div className="v2-desc">{p.text}</div>
                                        <div className="v2-assign">
                                          <span className="v2-principal">
                                            <EditableField value={semana.vidaCrista1_irmao} fieldName="vidaCrista1_irmao" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                          </span>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                                {/* V2 */}
                                {semana.vidaCrista2_titulo && (
                                  <div className="v2-part-row">
                                    {(() => {
                                      const p = renderTitleTime(
                                        semana.vidaCrista2_titulo,
                                        "20:25",
                                      );
                                      return (
                                        <>
                                          <div className="v2-time">
                                            {p.time}
                                          </div>
                                          <div className="v2-desc">
                                            {p.text}
                                          </div>
                                          <div className="v2-assign">
                                            <span className="v2-principal">
                                              <EditableField value={semana.vidaCrista2_irmao} fieldName="vidaCrista2_irmao" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                            </span>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}

                                {/* ESTUDO BIBLICO */}
                                {semana.estudoBiblico_dirigente !== "__DELETADO__" && (
                                  <div className="v2-part-row group-row">
                                    <div className="v2-time">20:35</div>
                                    <div className="v2-desc">
                                      Estudo Bíblico de Congregação (30 min)
                                    </div>
                                    <div className="v2-assign v2-estudo">
                                      <span className="v2-dir">
                                        Dirigente:{" "}
                                        <EditableField value={semana.estudoBiblico_dirigente} fieldName="estudoBiblico_dirigente" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                      </span>
                                      <span className="v2-lei">
                                        Leitor:{" "}
                                        <EditableField value={semana.estudoBiblico_leitor} fieldName="estudoBiblico_leitor" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                      </span>
                                    </div>
                                    <button className="btn-delete-row" title="Excluir linha" onClick={() => handleFieldUpdate(semana.id, 'estudoBiblico_dirigente', '__DELETADO__')}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}

                                <div className="v2-part-row">
                                  <div className="v2-time">21:05</div>
                                  <div className="v2-desc">
                                    Comentários finais (3 min)
                                  </div>
                                  <div className="v2-assign"> - </div>
                                </div>

                                <div className="v2-cantico-meio final">
                                  {(() => {
                                    const cf = renderCantico(
                                      semana.canticoFinal,
                                      "21:08",
                                    );
                                    return (
                                      <>
                                        <span className="v2-time">
                                          {cf.time}
                                        </span>{" "}
                                        Cântico {cf.num}{" "}
                                        <strong>
                                          | Oração:{" "}
                                          <EditableField value={semana.oracaoFinal} fieldName="oracaoFinal" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="A definir" />
                                        </strong>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* ==================================== */}
                          {/* COLUNA 2: FIM DE SEMANA E LIMPEZA   */}
                          {/* ==================================== */}
                          <div className="v2-col v2-col-fim">
                            <div className="v2-split-header fim">
                              <h4 className="v2-split-title">Fim de Semana</h4>
                            </div>

                            <div className="v2-fim-cards">
                              <div className="v2-fim-card">
                                <div className="v2-f-label">Presidente</div>
                                <div className="v2-f-value">
                                  <EditableField value={semana.fds_presidente} fieldName="fds_presidente" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                </div>
                              </div>
                              <div className="v2-fim-card theme">
                                <div className="v2-f-label">
                                  Tema do Discurso
                                </div>
                                <div className="v2-f-value">
                                  <EditableField value={semana.fds_tema} fieldName="fds_tema" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="A definir" />
                                </div>
                              </div>
                              <div className="v2-fim-card orador">
                                <div className="v2-f-label">Orador</div>
                                <div className="v2-f-value highlight">
                                  <EditableField value={semana.fds_orador} fieldName="fds_orador" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                </div>
                                <div className="v2-f-sub">
                                  Congregação:{" "}
                                  <EditableField value={semana.fds_congregacao} fieldName="fds_congregacao" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="Norte de Itapuã" />
                                </div>
                              </div>
                              <div className="v2-fim-card">
                                <div className="v2-f-label">
                                  Leitor da Sentinela
                                </div>
                                <div className="v2-f-value">
                                  <EditableField value={semana.fds_leitor} fieldName="fds_leitor" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                </div>
                              </div>
                            </div>

                            {semana.limpeza && (
                              <div className="v2-limpeza-card">
                                <div className="v2-limp-header">
                                  🧹 LIMPEZA SEMANAL
                                </div>
                                <div className="v2-limp-body">
                                  Grupo: <strong>{semana.limpeza}</strong>
                                </div>
                              </div>
                            )}
                          </div>
                          {/* MARCA D'ÁGUA DA DATA (Posicionada ABSOLUTA no Grid) */}
                          <div className="v2-watermark">
                            <div className="v2-wm-month">
                              {nomesMeses[reuniao.mes]}
                            </div>
                            <div className="v2-wm-days">
                              {semana.faixaData.replace(new RegExp(nomesMeses[reuniao.mes], 'i'), '').trim()}
                            </div>
                          </div>
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
