import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { DesignacoesProvider } from './context/DesignacoesContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DesignacoesProvider>
      <App />
    </DesignacoesProvider>
  </StrictMode>,
)

