import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Loading } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { HREF_AMBIENTE, lerAmbiente, type Ambiente } from "@/utils/ambiente";
import { podeUsarPioneiro } from "@/utils/permissoes";

export default function Index() {
  const { isAuthenticated, initializing, usuario } = useAuth();
  // O app abre no último ambiente usado (Servir Mais, Ministério, Território ou Estudo).
  const [ambiente, setAmbiente] = useState<Ambiente | null>(null);
  useEffect(() => {
    lerAmbiente().then(setAmbiente);
  }, []);

  if (initializing || !ambiente) return <Loading />;
  if (!isAuthenticated) return <Redirect href="/login" />;
  // A tela de início do Servir Mais é "minhas". O arquivo (tabs)/index continua sendo o das
  // Designações — não foi renomeado para não mexer em rota nenhuma —, então a porta de entrada
  // aponta direto para a tela certa.
  if (ambiente === "territorio" || ambiente === "estudo") return <Redirect href={HREF_AMBIENTE[ambiente]} />;
  return <Redirect href={ambiente === "ministerio" && podeUsarPioneiro(usuario) ? HREF_AMBIENTE.ministerio : HREF_AMBIENTE.servir} />;
}
