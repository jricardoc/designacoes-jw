import { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { FileText } from 'lucide-react';
import { useDesignacoes } from '../context/DesignacoesContext';
import TabelaPagina from './TabelaPagina';
import TabelaPDF from './TabelaPDF';
import Estatisticas from './Estatisticas';
import PageHeader from './PageHeader';
import '../App.css'; // Importando estilos do App

export default function Quadro() {
  const [downloading, setDownloading] = useState(false);
  const { titulo, subtitulo, grupos, loading } = useDesignacoes();

  // Aguardar carregamento dos dados
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        color: '#64748b'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p>Carregando designações...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const pagina1 = grupos?.slice(0, 4) || [];
  const pagina2 = grupos?.slice(4, 8) || [];

  // Função para gerar PDF - Usa componente TabelaPDF com layout portrait
  const handleDownloadPDF = async () => {
    setDownloading(true);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // A4 Portrait: 210mm x 297mm
      const pageWidth = 210;
      const pageHeight = 297;

      // --- PÁGINA 1 ---
      const pagina1Element = document.getElementById('tabela-pdf-1');
      const canvas1 = await html2canvas(pagina1Element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData1 = canvas1.toDataURL('image/jpeg', 0.92);
      // Ocupar 100% da página A4
      pdf.addImage(imgData1, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

      // --- PÁGINA 2 ---
      pdf.addPage();
      const pagina2Element = document.getElementById('tabela-pdf-2');
      const canvas2 = await html2canvas(pagina2Element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData2 = canvas2.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData2, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      pdf.save('quadro-designacoes-janeiro.pdf');

    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Por favor, tente novamente.');
    }

    setDownloading(false);
  };

  return (
    <>
      <PageHeader 
        title={titulo} 
        description="Clique em qualquer campo para editar. As alterações refletem automaticamente."
        icon={FileText}
        color="blue"
      >
        <button 
            className="btn-download" 
            onClick={handleDownloadPDF}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <span className="spinner"></span>
                Gerando PDF...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Baixar PDF
              </>
            )}
          </button>
      </PageHeader>

      <div className="container" style={{ padding: '0 2rem' }}>
        {/* Tabelas visíveis no site */}
        <section className="tabelas-section">
          <TabelaPagina dados={pagina1} id="tabela-pagina-1" />
          
          <div className="page-divider">
            <span>— Página 2 —</span>
          </div>
          
          <TabelaPagina dados={pagina2} id="tabela-pagina-2" />
        </section>

        {/* Estatísticas */}
        <Estatisticas />

        <footer className="footer">
          <p>Gerado automaticamente • Janeiro 2025</p>
        </footer>
      </div>

      {/* Componentes ocultos para geração do PDF (layout portrait) */}
      <TabelaPDF dados={pagina1} id="tabela-pdf-1" />
      <TabelaPDF dados={pagina2} id="tabela-pdf-2" />
    </>
  );
}
