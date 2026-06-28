import { useMemo, useState } from "react";
import {
  X,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import Swal from "sweetalert2";

/**
 * Modal de revisão das indisponibilidades detectadas após importar a programação.
 *
 * Props:
 *  - preview: { confirmados: [{ irmaoId, nome, datas: [{ data, count, partes }] }],
 *               ambiguos:   [{ nomeOriginal, data, partes, candidatos: [{ id, nome }] }] }
 *  - onClose: () => void
 *  - onApplied: (qtd) => void   // chamado após aplicar com sucesso
 */
export default function ImportarIndisponibilidadeModal({
  preview,
  onClose,
  onApplied,
}) {
  const { authFetch } = useAuth();
  const confirmados = preview?.confirmados || [];
  const ambiguos = preview?.ambiguos || [];

  // Chave por (irmão + data) — unidade que vira um registro de indisponibilidade.
  const chave = (irmaoId, data) => `${irmaoId}__${data}`;

  // Só os matches de alta confiança vêm pré-marcados; as sugestões (média) ficam
  // desmarcadas para o usuário conferir.
  const [marcados, setMarcados] = useState(() => {
    const init = {};
    confirmados.forEach((c) =>
      c.datas.forEach((d) => {
        init[chave(c.irmaoId, d.data)] = d.confianca === "alta";
      }),
    );
    return init;
  });

  // Para ambíguos: candidato escolhido por (nome + data). '' = nenhum.
  const [ambEscolha, setAmbEscolha] = useState({});
  const [saving, setSaving] = useState(false);

  const totalSelecionados = useMemo(
    () => Object.values(marcados).filter(Boolean).length,
    [marcados],
  );

  const toggle = (irmaoId, data) =>
    setMarcados((prev) => ({
      ...prev,
      [chave(irmaoId, data)]: !prev[chave(irmaoId, data)],
    }));

  const setTodos = (valor) =>
    setMarcados(() => {
      const next = {};
      confirmados.forEach((c) =>
        c.datas.forEach((d) => {
          next[chave(c.irmaoId, d.data)] = valor;
        }),
      );
      return next;
    });

  const aplicar = async () => {
    const registros = [];
    confirmados.forEach((c) =>
      c.datas.forEach((d) => {
        if (marcados[chave(c.irmaoId, d.data)]) {
          registros.push({ irmaoId: c.irmaoId, data: d.data });
        }
      }),
    );
    ambiguos.forEach((a) => {
      const escolhido = ambEscolha[`${a.nomeOriginal}__${a.data}`];
      if (escolhido) {
        registros.push({ irmaoId: parseInt(escolhido, 10), data: a.data });
      }
    });

    if (registros.length === 0) {
      onClose();
      return;
    }

    try {
      setSaving(true);
      const res = await authFetch("/reunioes/indisponibilidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registros }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao aplicar indisponibilidades");
      }
      const data = await res.json();
      onApplied?.(data.criados ?? registros.length);
      Swal.fire({
        title: "Indisponibilidades atualizadas!",
        text: `${data.criados ?? registros.length} marcação(ões) salva(s).`,
        icon: "success",
        confirmButtonColor: "#538d35",
      });
      onClose();
    } catch (error) {
      Swal.fire({
        title: "Erro",
        text: error.message,
        icon: "error",
        confirmButtonColor: "#d33",
      });
    } finally {
      setSaving(false);
    }
  };

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "1rem",
  };

  const sheet = {
    background: "#FBF7EF",
    borderRadius: "20px",
    width: "100%",
    maxWidth: "640px",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
  };

  const headerBar = {
    padding: "1.25rem 1.75rem",
    borderBottom: "1px solid #E6DCC9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "sticky",
    top: 0,
    background: "#FBF7EF",
    zIndex: 10,
  };

  return (
    <div style={overlay}>
      <div style={sheet}>
        <div style={headerBar}>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "1.2rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <CalendarClock size={22} color="#538d35" />
              Atualizar indisponibilidades
            </h2>
            <p style={{ margin: "0.3rem 0 0", color: "#8A8071", fontSize: "0.88rem" }}>
              Irmãos com partes na programação importada. Confirme quem deve ficar
              indisponível nessas datas.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#F6F0E4",
              border: "none",
              borderRadius: "10px",
              padding: "0.5rem",
              cursor: "pointer",
            }}
          >
            <X size={22} color="#8A8071" />
          </button>
        </div>

        <div style={{ padding: "1.25rem 1.75rem" }}>
          {confirmados.length === 0 && ambiguos.length === 0 ? (
            <div style={{ textAlign: "center", color: "#8A8071", padding: "1.5rem 0" }}>
              <Users size={40} color="#C6BAA0" />
              <p style={{ marginTop: "0.75rem" }}>
                Nenhum irmão cadastrado foi encontrado na programação importada.
              </p>
            </div>
          ) : (
            <>
              {confirmados.length > 0 && (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: "#2B2620",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <CheckCircle2 size={18} color="#538d35" />
                      Encontrados ({confirmados.length})
                    </span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => setTodos(true)} style={miniBtn}>
                        Todos
                      </button>
                      <button onClick={() => setTodos(false)} style={miniBtn}>
                        Nenhum
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: "0 0 0.6rem", color: "#8A8071", fontSize: "0.78rem" }}>
                    Verdes já vêm marcados (nome bateu certinho). As{" "}
                    <span style={{ color: "#92400e", fontWeight: 600 }}>sugestões</span>{" "}
                    (tracejado) bateram por parte do nome — passe o mouse para ver o nome
                    da programação e confirme as corretas.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {confirmados.map((c) => (
                      <div
                        key={c.irmaoId}
                        style={{
                          border: "1px solid #E6DCC9",
                          borderRadius: "12px",
                          padding: "0.75rem 0.9rem",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#2B2620", marginBottom: "0.5rem" }}>
                          {c.nome}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                          {c.datas.map((d) => {
                            const ativo = !!marcados[chave(c.irmaoId, d.data)];
                            const sugestao = d.confianca !== "alta";
                            const tip = sugestao
                              ? `Sugestão (confira) — encontrado como "${(d.origem || []).join('", "')}". Partes: ${d.partes.join(", ")}`
                              : d.partes.join(", ");
                            return (
                              <button
                                key={d.data}
                                onClick={() => toggle(c.irmaoId, d.data)}
                                title={tip}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.4rem",
                                  padding: "0.4rem 0.7rem",
                                  borderRadius: "999px",
                                  border: ativo
                                    ? "1.5px solid #538d35"
                                    : sugestao
                                      ? "1.5px dashed #9A5A38"
                                      : "1.5px solid #E6DCC9",
                                  background: ativo ? "#eef7ea" : "white",
                                  color: ativo
                                    ? "#2f6b1e"
                                    : sugestao
                                      ? "#92400e"
                                      : "#8A8071",
                                  fontWeight: 600,
                                  fontSize: "0.82rem",
                                  cursor: "pointer",
                                }}
                              >
                                {ativo ? (
                                  <CheckCircle2 size={14} color="#538d35" />
                                ) : (
                                  <span
                                    style={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: "50%",
                                      border: sugestao
                                        ? "1.5px solid #9A5A38"
                                        : "1.5px solid #C6BAA0",
                                    }}
                                  />
                                )}
                                {d.data}
                                {sugestao ? (
                                  <span style={{ opacity: 0.9 }}>· sugestão</span>
                                ) : (
                                  <span style={{ opacity: 0.7 }}>
                                    · {d.count} parte{d.count > 1 ? "s" : ""}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {ambiguos.length > 0 && (
                <div style={{ marginTop: "1.25rem" }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: "#92400e",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      marginBottom: "0.6rem",
                    }}
                  >
                    <AlertTriangle size={18} color="#9A5A38" />
                    Precisa de atenção ({ambiguos.length})
                  </span>
                  <p style={{ margin: "0 0 0.6rem", color: "#92400e", fontSize: "0.82rem" }}>
                    Nomes que combinam com mais de um irmão. Escolha o correto (ou deixe
                    em branco para ignorar).
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {ambiguos.map((a) => {
                      const k = `${a.nomeOriginal}__${a.data}`;
                      return (
                        <div
                          key={k}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                            flexWrap: "wrap",
                            background: "#FBF4E6",
                            border: "1px solid #E7CDA8",
                            borderRadius: "10px",
                            padding: "0.6rem 0.75rem",
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "#78350f" }}>
                            {a.nomeOriginal}
                          </span>
                          <span style={{ color: "#a16207", fontSize: "0.82rem" }}>
                            {a.data}
                          </span>
                          <select
                            value={ambEscolha[k] || ""}
                            onChange={(e) =>
                              setAmbEscolha((prev) => ({ ...prev, [k]: e.target.value }))
                            }
                            style={{
                              marginLeft: "auto",
                              padding: "0.45rem 0.6rem",
                              borderRadius: "8px",
                              border: "1.5px solid #E7CDA8",
                              fontSize: "0.85rem",
                              background: "#FBF7EF",
                            }}
                          >
                            <option value="">Ignorar</option>
                            {a.candidatos.map((cand) => (
                              <option key={cand.id} value={cand.id}>
                                {cand.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: "1rem 1.75rem",
            borderTop: "1px solid #E6DCC9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            bottom: 0,
            background: "#FBF7EF",
          }}
        >
          <span style={{ color: "#8A8071", fontSize: "0.85rem" }}>
            {totalSelecionados} data(s) selecionada(s)
          </span>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "0.65rem 1.1rem",
                borderRadius: "10px",
                border: "1.5px solid #E6DCC9",
                background: "#FBF7EF",
                color: "#5C5446",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Agora não
            </button>
            <button
              onClick={aplicar}
              disabled={saving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.65rem 1.3rem",
                borderRadius: "10px",
                border: "none",
                background: "#538d35",
                color: "white",
                fontWeight: 700,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <Loader2 size={18} className="spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              Aplicar selecionados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const miniBtn = {
  padding: "0.35rem 0.7rem",
  borderRadius: "8px",
  border: "1.5px solid #E6DCC9",
  background: "#FBF7EF",
  color: "#5C5446",
  fontWeight: 600,
  fontSize: "0.78rem",
  cursor: "pointer",
};
