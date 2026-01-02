import Sidebar from './Sidebar';
import './Layout.css';

export default function Layout({ children }) {
  return (
    <div className="layout-container">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
