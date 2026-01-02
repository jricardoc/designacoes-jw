import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import Designacoes from './components/Designacoes';
import QuadroView from './components/QuadroView';
import Conta from './components/Conta';
import Configuracoes from './components/Configuracoes';

// Componente de loading
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #0a1929 100%)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(255,255,255,0.2)',
          borderTop: '4px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }} />
        <p style={{ color: 'white', fontSize: '1.1rem' }}>Carregando...</p>
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

// Componente para proteger rotas privadas e aplicar Layout
function RotaProtegida({ children, usarLayout = true }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (usarLayout) {
    return (
      <Layout>
        {children}
      </Layout>
    );
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Lista de Quadros */}
          <Route 
            path="/designacoes" 
            element={
              <RotaProtegida>
                <Designacoes />
              </RotaProtegida>
            } 
          />

          {/* Visualizar/Editar Quadro */}
          <Route 
            path="/quadro/:id" 
            element={
              <RotaProtegida usarLayout={false}>
                <QuadroView />
              </RotaProtegida>
            } 
          />

          <Route 
            path="/conta" 
            element={
              <RotaProtegida>
                <Conta />
              </RotaProtegida>
            } 
          />

          <Route 
            path="/config" 
            element={
              <RotaProtegida>
                <Configuracoes />
              </RotaProtegida>
            } 
          />

          {/* Redirecionamento padrao */}
          <Route path="/" element={<Navigate to="/designacoes" replace />} />
          <Route path="*" element={<Navigate to="/designacoes" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
