import { router } from "expo-router";
import { useState } from "react";
import { useMarcarLeitura } from "@/api/hooks/useEstudo";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import { BarraAmbiente, type AbaAmbiente } from "@/components/layout/BarraAmbiente";
import { useTema } from "@/theme/TemaContext";
import { useLeitura } from "./comum";
import { AssuntoSheet } from "./folhas";
import { vidroEstudo } from "./tema";

const ABAS: AbaAmbiente[] = [
  { chave: "index", rotulo: "Hoje", icone: "today-outline", iconeAtivo: "today", href: "/estudo" },
  { chave: "leitura", rotulo: "Leitura", icone: "book-outline", iconeAtivo: "book", href: "/estudo/leitura" },
  { chave: "assuntos", rotulo: "Estudo", icone: "bulb-outline", iconeAtivo: "bulb", href: "/estudo/assuntos" },
  { chave: "rotina", rotulo: "Rotina", icone: "alarm-outline", iconeAtivo: "alarm", href: "/estudo/rotina" },
];

/** A barra do Estudo pessoal. O "+" começa o estudo, marca a leitura de hoje ou anota um assunto. */
export function BarraEstudo() {
  const { esquema } = useTema();
  const { estado, leitura } = useLeitura();
  const marcar = useMarcarLeitura();
  const { feito } = useCelebracao();
  const [assunto, setAssunto] = useState(false);

  const marcarHoje = () => {
    const t = leitura?.proximo?.trecho;
    // Sem programa começado (ou já no fim), a leitura de hoje se escolhe no programa.
    if (!estado || !t || (estado.perfil.plano !== "reuniao" && estado.perfil.plano !== "livre" && !estado.perfil.inicio)) {
      router.push("/estudo/programa");
      return;
    }
    marcar.mutate({ plano: estado.perfil.plano, itens: [t.id] });
    feito({ titulo: "Leitura marcada", detalhe: t.titulo, icone: "checkmark-done" });
  };

  return (
    <>
      <BarraAmbiente
        abas={ABAS}
        atalhos={[
          { chave: "estudar", rotulo: "Começar estudo", icone: "play", onPress: () => router.push("/estudo/sessao") },
          { chave: "ler", rotulo: "Marcar a leitura de hoje", icone: "checkmark-done", onPress: marcarHoje },
          { chave: "anotar", rotulo: "Anotar assunto ou pergunta", icone: "create", onPress: () => setAssunto(true) },
        ]}
        vidro={vidroEstudo(esquema)}
        rotuloMais="Atalhos: começar estudo, marcar a leitura de hoje ou anotar um assunto"
      />
      <AssuntoSheet visible={assunto} onClose={() => setAssunto(false)} />
    </>
  );
}
