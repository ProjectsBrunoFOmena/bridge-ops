import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError, apiFetch } from "../lib/api";
import type { ExceptionItem } from "../types";
import { ConfirmModal } from "../components/ConfirmModal";

type ActionKind = "reprocess" | "discard";

interface AnalyzeResponse {
  id: string;
  status: string;
  lockVersion?: number;
  lock_version?: number;
}

interface PendingAction {
  exceptionId: string;
  action: ActionKind;
}

function statusClassName(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "resolvida") return "status-pill status-resolvida";
  if (normalized === "em_analise") return "status-pill status-em-analise";
  if (normalized === "aberta") return "status-pill status-aberta";
  if (normalized === "descartada") return "status-pill status-descartada";
  return "status-pill";
}

export function ExceptionsPage() {
  const { token, isOperator, logout } = useAuth();
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [errorCodeFilter, setErrorCodeFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [discardReason, setDiscardReason] = useState("");
  const [lockVersions, setLockVersions] = useState<Record<string, number>>({});

  const statusOptions = useMemo(() => ["aberta", "em_analise", "resolvida", "descartada"], []);

  async function loadExceptions() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const query = new URLSearchParams();
      if (statusFilter) {
        query.set("status", statusFilter);
      }
      if (errorCodeFilter) {
        query.set("errorCode", errorCodeFilter);
      }
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const data = await apiFetch<ExceptionItem[]>(`/exceptions${suffix}`, { token });
      setExceptions(data);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        logout();
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar excecoes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExceptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, errorCodeFilter, token]);

  async function handleAnalyze(exceptionId: string) {
    if (!token) {
      return;
    }
    setError(null);
    setMessage(null);

    try {
      const response = await apiFetch<AnalyzeResponse>(`/exceptions/${exceptionId}/analyze`, {
        method: "POST",
        token
      });
      const lockVersion = response.lockVersion ?? response.lock_version;
      if (typeof lockVersion === "number") {
        setLockVersions((prev) => ({ ...prev, [exceptionId]: lockVersion }));
      }
      setMessage("Excecao assumida para analise.");
      await loadExceptions();
    } catch (analyzeError) {
      if (analyzeError instanceof ApiError && analyzeError.status === 401) {
        logout();
        return;
      }
      setError(analyzeError instanceof Error ? analyzeError.message : "Falha ao assumir analise.");
    }
  }

  async function executeAction() {
    if (!token || !pendingAction) {
      return;
    }

    const { exceptionId, action } = pendingAction;
    const lockVersion = lockVersions[exceptionId];
    if (typeof lockVersion !== "number") {
      setError("Execute 'Entrar em analise' antes de reprocessar ou descartar.");
      setPendingAction(null);
      return;
    }

    try {
      if (action === "reprocess") {
        await apiFetch<{ message: string }>(`/exceptions/${exceptionId}/reprocess`, {
          method: "POST",
          token,
          body: JSON.stringify({ lockVersion })
        });
        setMessage("Reprocessamento enfileirado com sucesso.");
      } else {
        if (!discardReason.trim()) {
          setError("Motivo de descarte e obrigatorio.");
          return;
        }
        await apiFetch<{ id: string; status: string }>(`/exceptions/${exceptionId}/discard`, {
          method: "POST",
          token,
          body: JSON.stringify({ lockVersion, reason: discardReason.trim() })
        });
        setMessage("Excecao descartada com sucesso.");
      }

      setPendingAction(null);
      setDiscardReason("");
      await loadExceptions();
    } catch (actionError) {
      if (actionError instanceof ApiError && actionError.status === 401) {
        logout();
        return;
      }
      setError(actionError instanceof Error ? actionError.message : "Falha ao executar acao.");
    }
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadExceptions();
  }

  return (
    <section className="card">
      <div className="section-header">
        <h2>Excecoes de integracao</h2>
        <button type="button" onClick={() => void loadExceptions()} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <form className="inline-form" onSubmit={handleFilterSubmit}>
        <div>
          <label htmlFor="statusFilter">Status</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="errorCodeFilter">Codigo de erro</label>
          <input
            id="errorCodeFilter"
            value={errorCodeFilter}
            onChange={(event) => setErrorCodeFilter(event.target.value)}
            placeholder="SKU_DESCONHECIDO"
          />
        </div>

        <button type="submit">Filtrar</button>
      </form>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted">Carregando excecoes...</p>
      ) : exceptions.length === 0 ? (
        <p className="muted">Nenhuma excecao encontrada para os filtros informados.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Referencia</th>
              <th>Status</th>
              <th>Codigo</th>
              <th>Mensagem</th>
              <th>Criado em</th>
              <th>Resolvida em</th>
              <th>{isOperator ? "Acoes" : "Detalhe"}</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((item) => (
              <tr key={item.id}>
                <td>{item.reference}</td>
                <td>
                  <span className={statusClassName(item.status)}>{item.status}</span>
                </td>
                <td>{item.error_code}</td>
                <td>{item.error_message}</td>
                <td>{new Date(item.created_at).toLocaleString("pt-BR")}</td>
                <td>{item.resolved_at ? new Date(item.resolved_at).toLocaleString("pt-BR") : "-"}</td>
                {isOperator && (
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => void handleAnalyze(item.id)}>
                        Entrar em analise
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setPendingAction({ exceptionId: item.id, action: "reprocess" });
                        }}
                      >
                        Reprocessar
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          setError(null);
                          setPendingAction({ exceptionId: item.id, action: "discard" });
                        }}
                      >
                        Descartar
                      </button>
                      <Link className="button-link" to={`/excecoes/${item.id}`}>
                        Ver detalhe
                      </Link>
                    </div>
                  </td>
                )}
                {!isOperator && (
                  <td>
                    <Link className="button-link" to={`/excecoes/${item.id}`}>
                      Ver detalhe
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmModal
        isOpen={pendingAction?.action === "reprocess"}
        title="Confirmar reprocessamento"
        message="Deseja realmente reprocessar esta excecao?"
        confirmLabel="Sim, reprocessar"
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void executeAction()}
      />

      <ConfirmModal
        isOpen={pendingAction?.action === "discard"}
        title="Confirmar descarte"
        message="O descarte e irreversivel neste MVP. Informe o motivo para continuar."
        confirmLabel="Descartar excecao"
        onCancel={() => {
          setPendingAction(null);
          setDiscardReason("");
        }}
        onConfirm={() => void executeAction()}
        extraContent={
          <div>
            <label htmlFor="discardReason">Motivo do descarte</label>
            <textarea
              id="discardReason"
              value={discardReason}
              onChange={(event) => setDiscardReason(event.target.value)}
              rows={3}
            />
          </div>
        }
      />
    </section>
  );
}
