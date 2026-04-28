import { createCorrelationId } from "./correlation";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

interface ApiFetchOptions extends RequestInit {
  token?: string | null;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  finalHeaders.set("x-correlation-id", createCorrelationId());

  if (!finalHeaders.has("content-type") && rest.body) {
    finalHeaders.set("content-type", "application/json");
  }
  if (token) {
    finalHeaders.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      (payload as { detail?: string; message?: string } | null)?.detail ??
      (payload as { message?: string } | null)?.message ??
      "Erro inesperado";
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}
