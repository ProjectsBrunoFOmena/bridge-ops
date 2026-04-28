import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AppLayout() {
  const { user, isOperator, logout } = useAuth();

  return (
    <div className="layout">
      <header className="header">
        <div>
          <h1>Portal de Excecoes</h1>
          <p className="subtitle">Operacao de falhas de integracao pedidos x ERP</p>
        </div>
        <div className="header-actions">
          <span className="user-pill">
            {user?.email} ({user?.role})
          </span>
          <button className="ghost" type="button" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      <nav className="nav">
        <NavLink to="/excecoes">Excecoes</NavLink>
        {isOperator && <NavLink to="/novo-pedido">Novo pedido</NavLink>}
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
