import { Redirect } from "expo-router";
import { Loading } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { isAuthenticated, initializing } = useAuth();

  if (initializing) return <Loading />;
  // A tela de início é "minhas". O arquivo (tabs)/index continua sendo o das
  // Designações — não foi renomeado para não mexer em rota nenhuma —, então a
  // porta de entrada aponta direto para a tela certa.
  return <Redirect href={isAuthenticated ? "/(tabs)/minhas" : "/login"} />;
}
