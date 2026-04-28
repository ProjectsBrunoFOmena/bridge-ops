import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { ExceptionsPage } from "./pages/ExceptionsPage";
import { NewOrderPage } from "./pages/NewOrderPage";
import { useAuth } from "./auth/AuthContext";
import { ExceptionDetailPage } from "./pages/ExceptionDetailPage";

function Unauthorized() {
  return (
    <section className="card">
      <h2>Acesso restrito</h2>
      <p>Este recurso esta disponivel apenas para usuarios com perfil operator.</p>
    </section>
  );
}

function OperatorOnlyRoute() {
  const { isOperator } = useAuth();
  return isOperator ? <NewOrderPage /> : <Unauthorized />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/excecoes" replace />} />
          <Route path="/excecoes" element={<ExceptionsPage />} />
          <Route path="/excecoes/:id" element={<ExceptionDetailPage />} />
          <Route path="/novo-pedido" element={<OperatorOnlyRoute />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
