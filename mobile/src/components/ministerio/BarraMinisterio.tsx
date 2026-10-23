import { useState } from "react";
import { BarraAmbiente, type AbaAmbiente } from "@/components/layout/BarraAmbiente";
import { useTema } from "@/theme/TemaContext";
import { HorasSheet } from "./HorasSheet";
import { type Icone } from "./kit";
import { PlanoSheet } from "./PlanoSheet";
import { RevisitaSheet } from "./RevisitaSheet";
import { efeitosDe } from "./tema";
import { ViagemSheet } from "./ViagemSheet";

const ABAS: AbaAmbiente[] = [
  { chave: "index", rotulo: "Início", icone: "home-outline", iconeAtivo: "home", href: "/ministerio" },
  { chave: "agenda", rotulo: "Agenda", icone: "calendar-outline", iconeAtivo: "calendar", href: "/ministerio/agenda" },
  { chave: "contatos", rotulo: "Contatos", icone: "people-outline", iconeAtivo: "people", href: "/ministerio/contatos" },
  { chave: "progresso", rotulo: "Progresso", icone: "stats-chart-outline", iconeAtivo: "stats-chart", href: "/ministerio/progresso" },
];

type Folha = "contato" | "horas" | "plano" | "viagem";

const ATALHOS: { folha: Folha; rotulo: string; icone: Icone }[] = [
  { folha: "contato", rotulo: "Novo contato", icone: "person-add" },
  { folha: "horas", rotulo: "Lançar horas", icone: "time" },
  { folha: "plano", rotulo: "Planejar saída", icone: "calendar" },
  { folha: "viagem", rotulo: "Registrar viagem", icone: "car" },
];

/**
 * A barra do ambiente Ministério: Início, Agenda, Contatos e Progresso, e o "+" no meio com os
 * atalhos (novo contato, horas, plano de saída, viagem).
 */
export function BarraMinisterio() {
  const { esquema } = useTema();
  const [folha, setFolha] = useState<Folha | null>(null);

  return (
    <>
      <BarraAmbiente
        abas={ABAS}
        atalhos={ATALHOS.map((a) => ({ chave: a.folha, rotulo: a.rotulo, icone: a.icone, onPress: () => setFolha(a.folha) }))}
        vidro={efeitosDe(esquema)}
        rotuloMais="Adicionar: contato, horas, plano ou viagem"
      />
      <RevisitaSheet visible={folha === "contato"} onClose={() => setFolha(null)} />
      <HorasSheet visible={folha === "horas"} onClose={() => setFolha(null)} />
      <PlanoSheet visible={folha === "plano"} onClose={() => setFolha(null)} />
      <ViagemSheet visible={folha === "viagem"} onClose={() => setFolha(null)} />
    </>
  );
}
