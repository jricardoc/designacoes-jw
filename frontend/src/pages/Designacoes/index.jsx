import { FileText } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import ListaQuadros from "../../components/quadros/ListaQuadros";
import DashboardGlobal from "../../components/DashboardGlobal";

export default function Designacoes() {
  return (
    <>
      <PageHeader
        title="Designações"
        description="Gerencie os quadros de designações mensais"
        icon={FileText}
        color="blue"
      />

      <div style={{ padding: "1.5rem 2rem" }}>
        <ListaQuadros />
        <DashboardGlobal />
      </div>
    </>
  );
}
