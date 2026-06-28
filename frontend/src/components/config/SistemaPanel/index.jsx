import { useState, useEffect } from "react";
import {
  Building2,
  Send,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import Swal from "sweetalert2";

const T = {
  surface: "#FBF7EF",
  surfaceMuted: "#F6F0E4",
  border: "#ECE3D3",
  borderStrong: "#E6DCC9",
  text: "#2B2620",
  textSec: "#8A8071",
  muted: "#A2977F",
  primary: "#5E6B48",
  olive: "#6E7B57",
  divider: "#F1EAD9",
};

const DIAS = [
  { key: "segunda", label: "Seg" },
  { key: "terca", label: "Ter" },
  { key: "quarta", label: "Qua" },
  { key: "quinta", label: "Qui" },
  { key: "sexta", label: "Sex" },
  { key: "sabado", label: "Sáb" },
];
const DIA_ABBR = {
  segunda: "SEG", terca: "TER", quarta: "QUA", quinta: "QUI",
  sexta: "SEX", sabado: "SÁB", domingo: "DOM",
};

function splitLocal(local, turno) {
  const parts = (local || "").split(" - ");
  return { group: parts[0] || `Turno ${turno}`, host: parts.slice(1).join(" - ") };
}

const card = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: "20px",
  padding: "18px",
  marginBottom: "16px",
  boxShadow: "0 1px 2px rgba(43,38,32,0.03)",
};
const cardTitle = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  fontSize: "18px",
  fontWeight: 600,
  color: T.text,
};
const label = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: T.muted,
};
const input = {
  marginTop: "8px",
  width: "100%",
  height: "48px",
  border: `1px solid ${T.borderStrong}`,
  background: T.surfaceMuted,
  borderRadius: "14px",
  padding: "0 15px",
  fontSize: "15px",
  color: T.text,
  outline: "none",
};
const primaryBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  border: "none",
  borderRadius: "13px",
  background: T.primary,
  color: "#FBF7EF",
  fontWeight: 600,
  cursor: "pointer",
};

function SaidaModal({ saida, onClose, onSaved, authFetch }) {
  const [diaSemana, setDiaSemana] = useState(saida?.diaSemana || "segunda");
  const [horario, setHorario] = useState(saida?.horario || "08:45");
  const [local, setLocal] = useState(saida?.local || "");
  const [turno, setTurno] = useState(saida?.turno || 1);
  const [saving, setSaving] = useState(false);
  const editando = !!saida;

  const salvar = async () => {
    if (!local.trim() || !horario.trim()) {
      Swal.fire("Atenção", "Preencha local e horário.", "warning");
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({ diaSemana, horario: horario.trim(), local: local.trim(), turno });
      const res = editando
        ? await authFetch(`/saidas-campo/${saida.id}`, { method: "PUT", body })
        : await authFetch("/saidas-campo", { method: "POST", body });
      if (!res.ok) throw new Error("Falha ao salvar");
      onSaved();
    } catch {
      Swal.fire("Erro", "Não foi possível salvar a saída.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
      <div style={{ background: T.surface, borderRadius: "20px", width: "100%", maxWidth: "460px", padding: "1.5rem 1.75rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: T.text }}>{editando ? "Editar Saída" : "Nova Saída de Campo"}</h2>
          <button onClick={onClose} style={{ background: "#F1EAD9", border: "none", borderRadius: "10px", padding: "0.4rem", cursor: "pointer" }}><X size={20} color={T.textSec} /></button>
        </div>

        <label style={label}>Dia da semana</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
          {DIAS.map((d) => {
            const active = d.key === diaSemana;
            return (
              <button key={d.key} onClick={() => setDiaSemana(d.key)} style={{ padding: "8px 14px", borderRadius: "12px", border: `1px solid ${active ? T.primary : T.border}`, background: active ? T.primary : T.surfaceMuted, color: active ? "#FBF7EF" : T.textSec, fontWeight: 600, cursor: "pointer" }}>{d.label}</button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "14px" }}>
          <div style={{ width: "120px" }}>
            <label style={label}>Horário</label>
            <input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="08:45" style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Turno</label>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
              <button onClick={() => setTurno((t) => Math.max(1, t - 1))} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${T.border}`, background: T.surfaceMuted, cursor: "pointer", color: T.primary, fontSize: 20 }}>−</button>
              <span style={{ fontSize: "18px", fontWeight: 800, color: T.text, minWidth: "24px", textAlign: "center" }}>{turno}</span>
              <button onClick={() => setTurno((t) => t + 1)} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${T.border}`, background: T.surfaceMuted, cursor: "pointer", color: T.primary, fontSize: 20 }}>+</button>
            </div>
          </div>
        </div>

        <label style={{ ...label, marginTop: "14px" }}>Local</label>
        <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex-Combatentes - Casa do irmão João" style={input} />

        <div style={{ display: "flex", gap: "10px", marginTop: "1.5rem" }}>
          <button onClick={onClose} style={{ flex: 1, height: "46px", border: `1px solid ${T.borderStrong}`, background: T.surface, borderRadius: "13px", color: "#7A7060", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ ...primaryBtn, flex: 1.4, height: "46px" }}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

export default function SistemaPanel() {
  const { authFetch } = useAuth();
  const [config, setConfig] = useState(null);
  const [congName, setCongName] = useState("");
  const [saidas, setSaidas] = useState([]);
  const [modal, setModal] = useState({ open: false, saida: null });
  const [notif, setNotif] = useState(() => localStorage.getItem("notif_enabled") !== "0");
  const [savingCong, setSavingCong] = useState(false);

  const carregar = async () => {
    try {
      const [cRes, sRes] = await Promise.all([authFetch("/config"), authFetch("/saidas-campo")]);
      if (cRes.ok) {
        const c = await cRes.json();
        setConfig(c);
        setCongName(c.subtitulo || "");
      }
      if (sRes.ok) setSaidas(await sRes.json());
    } catch (e) {
      console.error("Erro ao carregar sistema:", e);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salvarCong = async () => {
    if (!congName.trim() || congName.trim() === config?.subtitulo) return;
    setSavingCong(true);
    try {
      const res = await authFetch("/config", {
        method: "PUT",
        body: JSON.stringify({ subtitulo: congName.trim() }),
      });
      if (res.ok) {
        setConfig((c) => ({ ...c, subtitulo: congName.trim() }));
        Swal.fire({ title: "Salvo!", icon: "success", timer: 1100, showConfirmButton: false });
      }
    } catch {
      Swal.fire("Erro", "Não foi possível salvar.", "error");
    } finally {
      setSavingCong(false);
    }
  };

  const excluirSaida = async (s) => {
    const r = await Swal.fire({
      title: "Excluir saída?",
      text: s.local,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#9A4632",
      cancelButtonColor: "#8A8071",
      confirmButtonText: "Excluir",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;
    const res = await authFetch(`/saidas-campo/${s.id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) carregar();
  };

  const toggleNotif = () => {
    const next = !notif;
    setNotif(next);
    localStorage.setItem("notif_enabled", next ? "1" : "0");
  };

  return (
    <>
    <div className="t-two-col" style={{ maxWidth: "1000px", alignItems: "start" }}>
      <div>
      {/* Congregação */}
      <div style={card}>
        <div style={cardTitle}>
          <Building2 size={18} color={T.olive} /> Congregação
        </div>
        <label style={{ ...label, marginTop: "14px" }}>Nome</label>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
          <input value={congName} onChange={(e) => setCongName(e.target.value)} style={{ ...input, flex: 1 }} />
          <button onClick={salvarCong} disabled={savingCong} style={{ ...primaryBtn, height: "48px", padding: "0 18px", marginTop: "8px" }}>
            {savingCong ? "..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Saídas de Campo */}
      <div style={{ ...card, paddingBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={cardTitle}>
            <Send size={17} color={T.olive} /> Saídas de Campo
          </div>
          <button onClick={() => setModal({ open: true, saida: null })} style={{ ...primaryBtn, height: "36px", padding: "0 14px", fontSize: "13.5px" }}>
            <Plus size={14} /> Nova
          </button>
        </div>
        <div style={{ fontSize: "12.5px", color: T.muted, marginTop: "5px" }}>{saidas.length} saída(s) cadastrada(s)</div>

        <div style={{ marginTop: "6px" }}>
          {saidas.map((o) => {
            const { group, host } = splitLocal(o.local, o.turno);
            return (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 2px", borderTop: `1px solid ${T.divider}` }}>
                <div style={{ width: "48px", textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#566239" }}>{DIA_ABBR[o.diaSemana] || o.diaSemana}</div>
                  <div style={{ fontSize: "11px", color: T.muted, marginTop: "1px" }}>{o.horario}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14.5px", fontWeight: 600, color: T.text }}>{group}</div>
                  {host ? <div style={{ fontSize: "12.5px", color: "#9A8F7D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{host}</div> : null}
                </div>
                <button onClick={() => setModal({ open: true, saida: o })} title="Editar" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "6px" }}><Pencil size={16} color="#C2B79D" /></button>
                <button onClick={() => excluirSaida(o)} title="Excluir" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "6px" }}><Trash2 size={16} color="#C2877D" /></button>
              </div>
            );
          })}
          {saidas.length === 0 ? (
            <div style={{ textAlign: "center", color: "#B0A48E", fontSize: "14px", padding: "20px 0" }}>Nenhuma saída cadastrada.</div>
          ) : null}
        </div>
      </div>

      </div>
      <div>
      {/* Preferências */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: `1px solid ${T.divider}` }}>
          <div style={{ fontSize: "15px", fontWeight: 500, color: T.text }}>Notificações</div>
          <button onClick={toggleNotif} aria-label="Notificações" style={{ width: "46px", height: "28px", borderRadius: "999px", border: "none", cursor: "pointer", background: notif ? T.primary : "#D8CEBC", position: "relative", transition: "background .15s ease" }}>
            <span style={{ position: "absolute", top: "3px", left: notif ? "21px" : "3px", width: "22px", height: "22px", borderRadius: "999px", background: "#FBF7EF", transition: "left .15s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
          <div style={{ fontSize: "15px", fontWeight: 500, color: T.text }}>Tema</div>
          <span style={{ fontSize: "13px", color: T.muted }}>Terroso claro</span>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: "12px", color: "#B7AC97", marginTop: "20px" }}>
        Quadro de Designações · Versão 2.4.0
      </div>
      </div>
    </div>

      {modal.open ? (
        <SaidaModal
          saida={modal.saida}
          authFetch={authFetch}
          onClose={() => setModal({ open: false, saida: null })}
          onSaved={() => {
            setModal({ open: false, saida: null });
            carregar();
          }}
        />
      ) : null}
    </>
  );
}
