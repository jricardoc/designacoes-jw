import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Trophy,
  ArrowDownCircle,
  Users,
  LayoutDashboard,
  Mic,
  ShieldAlert,
  Video,
  Car,
} from "lucide-react";
import "./styles.css";

export default function DashboardGlobal() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  const carregarEstatisticas = async () => {
    try {
      setLoading(true);
      const res = await authFetch("/estatisticas");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Erro ao carregar estatisticas globais:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-global-loader">
        <div className="spinner"></div>
        <p>Calculando estatísticas globais...</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <section className="dashboard-global-container fade-in-up">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">
            <LayoutDashboard className="dashboard-icon pulse-icon" size={28} />
            Estatísticas Globais
          </h2>
          <p className="dashboard-subtitle">
            Baseado em {stats.totalQuadros} quadros e{" "}
            {stats.totalDesignacoesAtribuidas} designações totais
          </p>
        </div>
        <div className="dashboard-badge">
          <Users size={18} />
          {stats.totalIrmaosAtivos} Irmãos Ativos
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Top 5 Geral */}
        <div className="dashboard-card primary-card">
          <div className="card-header">
            <Trophy className="card-icon trophy" size={24} />
            <h3>Mais Designados (Global)</h3>
          </div>
          <div className="card-body">
            {stats.top5Geral?.map((irmao, index) => {
              const maxQtd = stats.top5Geral[0]?.qtd || 1;
              const percentage = (irmao.qtd / maxQtd) * 100;

              return (
                <div key={irmao.nome} className="stat-row">
                  <div className="stat-info">
                    <span className="stat-rank">#{index + 1}</span>
                    <span className="stat-name">{irmao.nome}</span>
                    <span className="stat-count">{irmao.qtd} vezes</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className={`progress-bar-fill rank-${index + 1}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Melhores por Funcao */}
        <div className="dashboard-card secondary-card">
          <div className="card-header">
            <ShieldAlert className="card-icon function" size={24} />
            <h3>Destaques por Função</h3>
          </div>
          <div className="card-body roles-grid">
            <div className="role-card">
              <div className="role-icon-wrapper mic">
                <Mic size={20} />
              </div>
              <div className="role-details">
                <span className="role-title">Rei do Microfone</span>
                <span className="role-winner">
                  {stats.rankFuncoes?.microfone?.nome || "N/A"}
                </span>
                <span className="role-count">
                  {stats.rankFuncoes?.microfone?.qtd || 0}x
                </span>
              </div>
            </div>

            <div className="role-card">
              <div className="role-icon-wrapper ind">
                <ShieldAlert size={20} />
              </div>
              <div className="role-details">
                <span className="role-title">Indicador Ouro</span>
                <span className="role-winner">
                  {stats.rankFuncoes?.indicador?.nome || "N/A"}
                </span>
                <span className="role-count">
                  {stats.rankFuncoes?.indicador?.qtd || 0}x
                </span>
              </div>
            </div>

            <div className="role-card">
              <div className="role-icon-wrapper av">
                <Video size={20} />
              </div>
              <div className="role-details">
                <span className="role-title">Mestre do A&V</span>
                <span className="role-winner">
                  {stats.rankFuncoes?.audioVideo?.nome || "N/A"}
                </span>
                <span className="role-count">
                  {stats.rankFuncoes?.audioVideo?.qtd || 0}x
                </span>
              </div>
            </div>

            <div className="role-card">
              <div className="role-icon-wrapper car">
                <Car size={20} />
              </div>
              <div className="role-details">
                <span className="role-title">Estacionamento</span>
                <span className="role-winner">
                  {stats.rankFuncoes?.estacionamento?.nome || "N/A"}
                </span>
                <span className="role-count">
                  {stats.rankFuncoes?.estacionamento?.qtd || 0}x
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Menos Designados */}
        <div className="dashboard-card danger-card">
          <div className="card-header">
            <ArrowDownCircle className="card-icon arrow-down" size={24} />
            <h3>Menos Designados Historicamente</h3>
          </div>
          <div className="card-body">
            {stats.menosEscaladosGeral?.map((irmao, index) => {
              const maxQtd = stats.top5Geral[0]?.qtd || 1;
              // Usar o topo geral para que a barra seja minuscula indicando pouco serviço
              let percentage = (irmao.qtd / maxQtd) * 100;
              if (percentage < 5) percentage = 5; // min visual

              return (
                <div key={irmao.nome} className="stat-row">
                  <div className="stat-info">
                    <span className="stat-name">{irmao.nome}</span>
                    <span className="stat-count low-count">
                      {irmao.qtd} vezes
                    </span>
                  </div>
                  <div className="progress-bar-bg danger-bg">
                    <div
                      className="progress-bar-fill danger-fill"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
