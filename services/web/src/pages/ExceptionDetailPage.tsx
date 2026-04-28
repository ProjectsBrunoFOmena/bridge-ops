import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError, apiFetch } from "../lib/api";
import type { ExceptionDetail } from "../types";

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function statusClassName(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "resolvida") return "status-pill status-resolvida";
  if (normalized === "em_analise") return "status-pill status-em-analise";
  if (normalized === "aberta") return "status-pill status-aberta";
  if (normalized === "descartada") return "status-pill status-descartada";
  return "status-pill";
}

export function ExceptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, logout } = useAuth();
  const [detail, setDetail] = useState<ExceptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetail() {
      if (!token || !id) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<ExceptionDetail>(`/exceptions/${id}`, { token });
        setDetail(response);
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.status === 401) {
          logout();
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar detalhe.");
      } finally {
        setLoading(false);
      }
    }

    void loadDetail();
  }, [id, logout, token]);

  if (loading) {
    return (
      <section className="card">
        <p className="muted">Carregando detalhe da excecao...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card">
        <p className="error">{error}</p>
        <Link to="/excecoes">Voltar para excecoes</Link>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="card">
        <p className="muted">Excecao nao encontrada.</p>
        <Link to="/excecoes">Voltar para excecoes</Link>
      </section>
    );
  }

  return (
    <section className="stack">
      <article className="card">
        <p>
          <Link to="/excecoes">← Voltar para excecoes</Link>
        </p>
        <h2>Excecao {detail.id}</h2>
        <p>
          <strong>Status:</strong> <span className={statusClassName(detail.status)}>{detail.status}</span>
        </p>
        <p>
          <strong>Erro:</strong> {detail.error_code} - {detail.error_message}
        </p>
        <p>
          <strong>Pedido:</strong> {detail.order.reference} ({detail.order.status})
        </p>
        <p>
          <strong>Cliente:</strong> {detail.order.customer.name} ({detail.order.customer.email})
        </p>
        <p>
          <strong>Motivo do descarte:</strong> {detail.discard_reason ?? "-"}
        </p>
        <p>
          <strong>Resolvida em:</strong>{" "}
          {detail.resolved_at ? new Date(detail.resolved_at).toLocaleString("pt-BR") : "-"}
        </p>
      </article>

      <article className="card">
        <h3>Itens do pedido</h3>
        {detail.order.items.length === 0 ? (
          <p className="muted">Sem itens cadastrados.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Quantidade</th>
                <th>Preco unitario</th>
              </tr>
            </thead>
            <tbody>
              {detail.order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.sku}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit_price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      <article className="card">
        <h3>Tentativas de integracao</h3>
        {detail.attempts.length === 0 ? (
          <p className="muted">Nenhuma tentativa encontrada.</p>
        ) : (
          detail.attempts.map((attempt) => (
            <div className="detail-block" key={attempt.id}>
              <p>
                <strong>{attempt.status}</strong> - HTTP {attempt.http_status ?? "-"} -{" "}
                {new Date(attempt.created_at).toLocaleString("pt-BR")}
              </p>
              <p>Correlation ID: {attempt.correlation_id}</p>
              <details>
                <summary>Payload</summary>
                <pre>{formatJson(attempt.payload_snapshot)}</pre>
              </details>
              <details>
                <summary>Resposta</summary>
                <pre>{formatJson(attempt.response_snapshot)}</pre>
              </details>
            </div>
          ))
        )}
      </article>

      <article className="card">
        <h3>Auditoria</h3>
        {detail.audit_logs.length === 0 ? (
          <p className="muted">Nenhum evento de auditoria para esta excecao.</p>
        ) : (
          detail.audit_logs.map((log) => (
            <div className="detail-block" key={log.id}>
              <p>
                <strong>{log.action}</strong> - {new Date(log.created_at).toLocaleString("pt-BR")}
              </p>
              <p>
                Actor: {log.actor_id ?? "-"} ({log.actor_role ?? "-"})
              </p>
              <p>Correlation ID: {log.correlation_id}</p>
              <details>
                <summary>Before</summary>
                <pre>{formatJson(log.before_data)}</pre>
              </details>
              <details>
                <summary>After</summary>
                <pre>{formatJson(log.after_data)}</pre>
              </details>
            </div>
          ))
        )}
      </article>
    </section>
  );
}
