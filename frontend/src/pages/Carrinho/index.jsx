import React, { useState } from "react";
import PageHeader from "../../components/PageHeader";
import {
  BookOpen,
  MapPin,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle,
  Info,
} from "lucide-react";
import "./styles.css";

const MOCK_AGENDAMENTOS = [
  {
    id: 1,
    data: "2026-03-07",
    diaSemana: "Sábado, 07 de Março",
    turnos: [
      {
        id: 101,
        local: "Estação Mussurunga",
        horario: "08h às 10h",
        responsavel: "João Silva",
        companheiros: ["Pedro Alves", "Marcos Paulo"],
        status: "Confirmado",
      },
      {
        id: 102,
        local: "Ponto de Ônibus Central",
        horario: "10h às 12h",
        responsavel: "Maria Costa",
        companheiros: ["Ana Souza"],
        status: "Lembrete Enviado",
      },
    ],
  },
  {
    id: 2,
    data: "2026-03-08",
    diaSemana: "Domingo, 08 de Março",
    turnos: [
      {
        id: 103,
        local: "Praça de Itapuã",
        horario: "08h às 10h",
        responsavel: "Ricardo Mendes",
        companheiros: ["Felipe", "Lucas"],
        status: "Confirmado",
      },
    ],
  },
];

export default function Carrinho() {
  const [agendamentos, setAgendamentos] = useState(MOCK_AGENDAMENTOS);

  return (
    <div className="carrinho-page">
      <PageHeader
        title="Carrinho"
        description="Painel de agendamentos e horários do carrinho de publicações."
        icon={BookOpen}
      />

      {/* KPIs Mockados */}
      <div className="carrinho-kpis">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper blue">
            <Calendar size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Hoje</span>
            <span className="kpi-value">02</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrapper green">
            <CheckCircle size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Esta Semana</span>
            <span className="kpi-value">14</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrapper purple">
            <MapPin size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Locais Ativos</span>
            <span className="kpi-value">03</span>
          </div>
        </div>
      </div>

      <div className="carrinho-content">
        <div className="carrinho-info-banner">
          <Info size={20} className="info-icon" />
          <p>
            <strong>Aviso:</strong> Esta tela exibe dados de exemplo (Mock) para
            os agendamentos realizados pelo WhatsApp. A integração com o
            Supabase será finalizada em breve.
          </p>
        </div>

        <div className="agendamentos-list">
          {agendamentos.map((dia) => (
            <div key={dia.id} className="dia-group">
              <h2 className="dia-titulo">
                <Calendar size={20} className="dia-icon" />
                {dia.diaSemana}
              </h2>

              <div className="turnos-grid">
                {dia.turnos.map((turno) => (
                  <div key={turno.id} className="turno-card">
                    <div className="turno-header">
                      <div className="turno-local">
                        <MapPin size={16} />
                        <span>{turno.local}</span>
                      </div>
                      <span
                        className={`turno-status ${turno.status === "Confirmado" ? "status-success" : "status-warning"}`}
                      >
                        {turno.status}
                      </span>
                    </div>

                    <div className="turno-horario">
                      <Clock size={16} />
                      <strong>{turno.horario}</strong>
                    </div>

                    <div className="turno-participantes">
                      <div className="participante responsavel">
                        <User size={16} />
                        <div>
                          <span className="p-badge">Dirigente</span>
                          <span className="p-nome">{turno.responsavel}</span>
                        </div>
                      </div>

                      {turno.companheiros.length > 0 && (
                        <div className="participante companheiros">
                          <Users size={16} />
                          <div>
                            <span className="p-badge">Companheiros</span>
                            <span className="p-nome">
                              {turno.companheiros.join(", ")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
