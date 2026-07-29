import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Gem,
  FileText,
  Globe,
  Upload,
  Download,
  Printer,
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
// Carregado depois de styles.css de propósito: reescreve o visual do pôster com o
// layout A4 desenhado no Claude Design (design system Modernist).
import "./posterA4.css";
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
      const originalWidth = element.style.width;

      // Mesma largura fixa do PDF: sem isso o pôster saía com a largura da janela do
      // usuário, então a mesma semana gerava imagens diferentes em cada computador.
      element.style.transform = "none";
      element.classList.add("v2-export");

      const canvas = await html2canvas(element, {
        scale: 4, // Quadruplica a resolução nativa da tela para hiper qualidade
        useCORS: true,
        backgroundColor: "#FBF7EF",
      });
      element.classList.remove("v2-export");
      element.style.width = originalWidth;
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

  /**
   * Impressão direta pelo navegador.
   *
   * É o caminho de MAIOR qualidade: o navegador manda o texto para a impressora como
   * vetor, então sai nítido em qualquer resolução. O "Exportar PDF" continua existindo
   * porque gera um arquivo para compartilhar — mas ele é uma imagem do pôster, e imagem
   * sempre perde para texto no papel.
   *
   * A folha de estilo @media print (styles.css) esconde menu, botões e marca d'água e
   * deixa só o pôster.
   */
  const imprimirSemana = async (weekId) => {
    const jaAberta = expandedWeeks[weekId];
    if (!jaAberta) {
      setExpandedWeeks((prev) => ({ ...prev, [weekId]: true }));
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    // Só a semana escolhida vai para o papel; as outras saem do fluxo de impressão.
    const posters = document.querySelectorAll(".v2-exportable-poster");
    posters.forEach((p) => {
      if (p.id !== `v2-week-content-${weekId}`) p.classList.add("v2-nao-imprimir");
    });

    window.print();

    posters.forEach((p) => p.classList.remove("v2-nao-imprimir"));
    if (!jaAberta) setExpandedWeeks((prev) => ({ ...prev, [weekId]: false }));
  };

  const exportAsPdf = async (weekId) => {
    const element = document.getElementById(`v2-week-content-${weekId}`);
    if (!element) return;

    try {
      const originalTransform = element.style.transform;
      const originalPadding = element.style.padding;
      const originalWidth = element.style.width;

      // Layout deterministico (independe da largura da tela) e forca as 2 colunas.
      // A classe .v2-export aumenta a tipografia, esconde a marca d'agua e faz a coluna do
      // fim de semana ocupar toda a altura — ver o bloco "MODO EXPORTACAO" no styles.css.
      element.classList.add("v2-export");
      element.style.transform = "none";

      const canvas = await html2canvas(element, {
        // 794px de largura x 4 = 3176px numa folha A4 de 210mm, ou seja ~384 DPI.
        // Impressoras domesticas trabalham em 300-600 DPI; abaixo disso a impressora
        // interpola e a borda das letras sai macia. Com scale 3 dava ~290 DPI, ja no
        // limite, e com 2 (o valor original) dava ~190 e borrava de verdade.
        scale: 4,
        useCORS: true,
        backgroundColor: "#FBF7EF",
      });

      // Restaura o estilo depois que a foto for batida
      element.classList.remove("v2-export");
      element.style.transform = originalTransform;
      element.style.padding = originalPadding;
      element.style.width = originalWidth;

      // PNG em vez de JPEG. O JPEG comprime perdendo informacao em transicoes bruscas
      // de cor, que e exatamente o que e uma letra preta sobre fundo claro: mesmo em
      // 0.95 sobrava um halo em volta dos caracteres, e a impressora reproduz o halo.
      // O PNG e sem perdas, entao o texto sai com a borda limpa. O arquivo fica maior,
      // mas isso e um pdf de uma pagina para afixar - vale a troca.
      const imgData = canvas.toDataURL("image/png");

      // A orientacao acompanha a proporcao real do poster: como e um layout largo
      // de 2 colunas, isso resulta em paisagem e preenche a pagina (antes ficava
      // uma faixa pequena no topo de um A4 retrato).
      const isLandscape = canvas.width >= canvas.height;
      const pdf = new jsPDF(isLandscape ? "l" : "p", "mm", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // 2mm: o suficiente para o conteudo nao encostar na borda da folha, e ainda
      // dentro da area imprimivel de qualquer impressora comum. O poster ja traz o
      // proprio respiro interno (padding de 12/14px).
      const margin = 2;
      const availableWidth = pdfWidth - margin * 2;
      const availableHeight = pdfHeight - margin * 2;

      const imgRatio = canvas.width / canvas.height;
      const pageRatio = availableWidth / availableHeight;

      // Fit-to-contain: preenche o eixo que limita, sem distorcer nem cortar conteudo.
      let finalWidth, finalHeight;
      if (imgRatio > pageRatio) {
        finalWidth = availableWidth;
        finalHeight = availableWidth / imgRatio;
      } else {
        finalHeight = availableHeight;
        finalWidth = availableHeight * imgRatio;
      }

      const x = margin + (availableWidth - finalWidth) / 2;
      const y = margin + (availableHeight - finalHeight) / 2;

      // "SLOW" comprime melhor sem perder qualidade: o arquivo fica menor que com "FAST"
      // e a imagem continua a mesma. Vale o segundo a mais na geracao.
      pdf.addImage(
        imgData,
        "PNG",
        x,
        y,
        finalWidth,
        finalHeight,
        undefined,
        "SLOW",
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

  /**
   * Intervalo da semana no formato "27/07 - 02/08".
   *
   * A semana da reunião vai de segunda a domingo, e a única data confiável que temos é
   * `dataReuniao` (a reunião do meio de semana). A partir dela recuamos até a segunda e
   * avançamos seis dias — aritmética de Date, nunca de string, porque a semana atravessa
   * o mês com frequência (é justamente o caso do exemplo acima).
   */
  const faixaDaSemana = (dataReuniao) => {
    const m = String(dataReuniao || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;

    const meio = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (Number.isNaN(meio.getTime())) return null;

    const segunda = new Date(meio);
    // getDay(): 0 = domingo. Domingo pertence à semana que começou na segunda anterior.
    const diasDesdeSegunda = (meio.getDay() + 6) % 7;
    segunda.setDate(segunda.getDate() - diasDesdeSegunda);

    const domingo = new Date(segunda);
    domingo.setDate(domingo.getDate() + 6);

    const ddmm = (d) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    return `${ddmm(segunda)} - ${ddmm(domingo)}`;
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
                            <button
                              className="v2-btn-imprimir"
                              onClick={(e) => {
                                e.stopPropagation();
                                imprimirSemana(semana.id);
                              }}
                              title="Imprimir com qualidade máxima (texto vetorial)"
                            >
                              <Printer size={16} /> Imprimir
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
                            <div className="v2-brand-datas">
                              <span className="v2-brand-mes">
                                {nomesMeses[reuniao.mes].toUpperCase()} / {reuniao.ano}
                              </span>
                              {/* Sem o ano: ele já está na linha de cima. */}
                              <span className="v2-brand-semana">
                                {faixaDaSemana(semana.dataReuniao)}
                              </span>
                            </div>
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
                              {/* A data saiu daqui e foi para o cabeçalho, embaixo do mês.
                                  Sem ela, "Meio da Semana" cabe numa linha só. */}
                              <div className="v2-split-meta">
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
                                  <EditableField value={semana.presidente} fieldName="presidente" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="A definir" />
                                </span>
                              </div>
                              <div className="v2-pres-item">
                                <span className="v2-pres-label">
                                  Conselheiro B
                                </span>
                                <span className="v2-pres-value">
                                  <EditableField value={semana.conselheiroB} fieldName="conselheiroB" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                </span>
                              </div>
                              <div className="v2-pres-item">
                                <span className="v2-pres-label">
                                  Oração Inicial
                                </span>
                                <span className="v2-pres-value">
                                  <EditableField value={semana.oracaoInicial} fieldName="oracaoInicial" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
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
                                          <span className="v2-salab">
                                            B: <EditableField value={semana.tesouro3_salaB} fieldName="tesouro3_salaB" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                          </span>
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
                                          <span className="v2-salab">
                                            B: <EditableField value={semana.ministerio1_salaB} fieldName="ministerio1_salaB" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                          </span>
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
                                            <span className="v2-salab">
                                              B: <EditableField value={semana.ministerio2_salaB} fieldName="ministerio2_salaB" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                            </span>
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
                                            <span className="v2-salab">
                                              B: <EditableField value={semana.ministerio3_salaB} fieldName="ministerio3_salaB" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                            </span>
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
                                            <span className="v2-salab">
                                              B: <EditableField value={semana.ministerio4_salaB} fieldName="ministerio4_salaB" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                                            </span>
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

                          </div>

                          {/* ==================================== */}
                          {/* COLUNA 2: FIM DE SEMANA E LIMPEZA   */}
                          {/* ==================================== */}
                          <div className="v2-col v2-col-fim">
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
                                        </span>
                                        <span className="v2-cantico-texto">
                                          Cântico {cm.num}
                                        </span>
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
                                        </span>
                                        {/* Tudo num elemento só: solto, cada
                                            pedaço de texto virava um item do
                                            grid e a linha se despedaçava. */}
                                        <span className="v2-cantico-texto">
                                          Cântico {cf.num}{" "}
                                          <strong>
                                            Oração:{" "}
                                            <EditableField value={semana.oracaoFinal} fieldName="oracaoFinal" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="A definir" />
                                          </strong>
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
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

                          </div>
                        </div>

                        {/* Faixa de largura total, abaixo das duas colunas. */}
                        <div className="v2-limpeza-bar">
                          <div className="v2-limp-header">
                            🧹 LIMPEZA SEMANAL
                          </div>
                          <div className="v2-limp-body">
                            Grupo:{" "}
                            <strong>
                              <EditableField value={semana.limpeza} fieldName="limpeza" onSave={(f, v) => handleFieldUpdate(semana.id, f, v)} fallback="-" />
                            </strong>
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
