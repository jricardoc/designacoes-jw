import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Settings, 
  LogOut, 
  FileText,
  Heart
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
  const { logout } = useAuth();

  const menuItems = [
    { name: 'Designações', icon: FileText, path: '/designacoes' },
    { name: 'Conta', icon: User, path: '/conta' },
    { name: 'Configurações', icon: Settings, path: '/config' },
  ];

  return (
    <div className="sidebar">
      {/* Topo / Logo (Oculto no mobile) */}
      <div className="logo-container">
        <div className="logo-box">
          JW
        </div>
        <span className="logo-text">
          Designações
        </span>
      </div>

      {/* Menu Navigation */}
      <nav className="nav-menu">
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => 
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <div className="nav-icon">
              <item.icon size={24} strokeWidth={1.5} />
            </div>
            <span className="nav-text">
              {item.name}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Footer com versão - Visivel apenas Desktop */}
      <div className="sidebar-footer">
        <div className="footer-content">
          <span className="footer-text">
            <Heart size={12} style={{ color: '#ef4444' }} /> Feito com amor
          </span>
          <span className="footer-version">v1.2.0</span>
        </div>
      </div>

      {/* Botão Sair */}
      <div className="logout-container">
        <button className="logout-btn" onClick={logout}>
          <div className="nav-icon">
            <LogOut size={24} strokeWidth={1.5} />
          </div>
          <span className="nav-text">
            Sair
          </span>
        </button>
      </div>
    </div>
  );
}
