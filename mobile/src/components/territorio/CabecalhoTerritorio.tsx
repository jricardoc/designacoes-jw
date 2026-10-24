import { CabecalhoAmbiente } from "@/components/layout/Ambientes";

/** O topo das abas do Território (o mesmo do Estudo pessoal, em Ambientes). */
export function CabecalhoTerritorio({ sobreOMapa }: { sobreOMapa?: boolean }) {
  return <CabecalhoAmbiente atual="territorio" sobreOMapa={sobreOMapa} />;
}
