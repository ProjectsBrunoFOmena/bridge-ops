export type Role = "viewer" | "operator";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface ExceptionItem {
  id: string;
  status: string;
  error_code: string;
  error_message: string;
  created_at: string;
  resolved_at: string | null;
  reference: string;
}

export interface ExceptionDetail {
  id: string;
  status: string;
  error_code: string;
  error_message: string;
  lock_version: number;
  locked_by: string | null;
  locked_at: string | null;
  discard_reason: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  order: {
    id: string;
    reference: string;
    status: string;
    total_amount: string;
    customer: {
      id: string;
      name: string;
      document: string;
      email: string;
    };
    items: Array<{
      id: string;
      sku: string;
      quantity: number;
      unit_price: string;
      created_at: string;
    }>;
  };
  attempts: Array<{
    id: string;
    status: string;
    http_status: number | null;
    error_code: string | null;
    error_message: string | null;
    payload_snapshot: unknown;
    response_snapshot: unknown;
    correlation_id: string;
    created_at: string;
  }>;
  audit_logs: Array<{
    id: string;
    action: string;
    actor_id: string | null;
    actor_role: string | null;
    correlation_id: string;
    before_data: unknown;
    after_data: unknown;
    created_at: string;
  }>;
}
