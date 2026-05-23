import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useState, useEffect } from "react";
import {
  User,
  Settings,
  LogOut,
  FileText,
  Heart,
  Users,
  BookOpen,
  Compass,
} from "lucide-react";
import "./styles.css";

export default function Sidebar() {
  const { logout } = useAuth();
  const location = useLocation();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e) => {
      if (
        e.target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      ) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = (e) => {
      // Pequeno timer para o caso do usuário logo focar em outro input seguido
      setTimeout(() => {
        if (
          !document.activeElement ||
          !["INPUT", "TEXTAREA", "SELECT"].includes(
            document.activeElement.tagName,
          )
        ) {
          setIsKeyboardOpen(false);
        }
      }, 50);
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  const menuItems = [
    { name: "Designações", icon: FileText, path: "/designacoes" },
    { name: "Dirigentes", icon: Compass, path: "/dirigentes" },
    { name: "Reunião", icon: Users, path: "/reuniao" },
    { name: "Carrinho", icon: BookOpen, path: "/carrinho" },
    { name: "Conta", icon: User, path: "/conta" },
    { name: "Configurações", icon: Settings, path: "/config" },
  ];

  // Identifica o índice da aba atual para animar o Pill Indicator no mobile
  const activeIndex = menuItems.findIndex((item) =>
    location.pathname.startsWith(item.path),
  );

  return (
    <div className={`sidebar ${isKeyboardOpen ? "keyboard-open" : ""}`}>
      {/* Topo / Logo (Oculto no mobile) */}
      <div className="logo-container">
        <div className="logo-box">JW</div>
        <span className="logo-text">Designações</span>
      </div>

      {/* Menu Navigation */}
      <nav className="nav-menu">
        {activeIndex !== -1 && (
          <div
            className="nav-indicator"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
        )}
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <div className="nav-icon">
              <item.icon size={24} strokeWidth={1.5} />
            </div>
            <span className="nav-text">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer com versão - Visivel apenas Desktop */}
      <div className="sidebar-footer">
        <div className="footer-content">
          <span className="footer-text">
            <Heart size={12} style={{ color: "#ef4444" }} /> Feito com amor
          </span>
          <span className="footer-version">v1.4.0</span>
        </div>
      </div>

      {/* Botão Sair */}
      <div className="logout-container">
        <button className="logout-btn" onClick={logout}>
          <div className="nav-icon">
            <LogOut size={24} strokeWidth={1.5} />
          </div>
          <span className="nav-text">Sair</span>
        </button>
      </div>
    </div>
  );
}
