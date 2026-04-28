import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("operator@demo.local");
  const [password, setPassword] = useState("operator123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/excecoes", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
      const from = (location.state as { from?: string } | undefined)?.from ?? "/excecoes";
      navigate(from, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Falha ao fazer login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="centered">
      <form className="card form" onSubmit={handleSubmit}>
        <h2>Entrar</h2>
        <p className="muted">Use as credenciais de demo para acessar o portal.</p>

        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
