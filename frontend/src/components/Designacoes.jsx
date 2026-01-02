import { FileText } from 'lucide-react';
import PageHeader from './PageHeader';
import ListaQuadros from './quadros/ListaQuadros';

export default function Designacoes() {
  return (
    <>
      <PageHeader 
        title="Designações" 
        description="Gerencie os quadros de designações mensais"
        icon={FileText}
        color="blue"
      />

      <div style={{ padding: '0 2rem' }}>
        <ListaQuadros />
      </div>
    </>
  );
}
