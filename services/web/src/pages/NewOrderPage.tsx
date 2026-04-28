import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { ApiError, apiFetch } from "../lib/api";

interface CustomerPayload {
  name: string;
  document: string;
  email: string;
}

interface CustomerResponse extends CustomerPayload {
  id: string;
}

interface OrderPayload {
  customerId: string;
  reference: string;
  items: Array<{
    sku: string;
    quantity: number;
    unitPrice: number;
  }>;
}

interface OrderResponse {
  id: string;
  status: string;
  reference: string;
}

export function NewOrderPage() {
  const { token, logout } = useAuth();
  const [customer, setCustomer] = useState<CustomerPayload>({
    name: "",
    document: "",
    email: ""
  });
  const [customerId, setCustomerId] = useState("");
  const [reference, setReference] = useState("");
  const [sku, setSku] = useState("ERR-001");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(100);
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const created = await apiFetch<CustomerResponse>("/customers", {
        method: "POST",
        token,
        body: JSON.stringify(customer)
      });
      setCustomerId(created.id);
      setMessage(`Cliente criado com sucesso. ID: ${created.id}`);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        logout();
        return;
      }
      setError(submitError instanceof Error ? submitError.message : "Falha ao criar cliente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);

    const payload: OrderPayload = {
      customerId,
      reference,
      items: [{ sku, quantity, unitPrice }]
    };

    try {
      const created = await apiFetch<OrderResponse>("/orders", {
        method: "POST",
        token,
        body: JSON.stringify(payload)
      });
      setOrderId(created.id);
      setMessage(`Pedido ${created.reference} criado com sucesso. ID: ${created.id}`);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        logout();
        return;
      }
      setError(submitError instanceof Error ? submitError.message : "Falha ao criar pedido.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmOrder() {
    if (!token || !orderId) {
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await apiFetch<{ message: string }>(`/orders/${orderId}/confirm`, {
        method: "POST",
        token
      });
      setMessage(`${response.message}. Aguarde alguns segundos e consulte a lista de excecoes.`);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        logout();
        return;
      }
      setError(
        submitError instanceof Error ? submitError.message : "Falha ao confirmar pedido para integracao."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="stack">
      <article className="card">
        <h2>1) Criar cliente</h2>
        <form className="form" onSubmit={handleCreateCustomer}>
          <label htmlFor="name">Nome</label>
          <input
            id="name"
            value={customer.name}
            onChange={(event) => setCustomer((prev) => ({ ...prev, name: event.target.value }))}
            required
          />

          <label htmlFor="document">Documento</label>
          <input
            id="document"
            value={customer.document}
            onChange={(event) => setCustomer((prev) => ({ ...prev, document: event.target.value }))}
            required
          />

          <label htmlFor="customerEmail">E-mail</label>
          <input
            id="customerEmail"
            type="email"
            value={customer.email}
            onChange={(event) => setCustomer((prev) => ({ ...prev, email: event.target.value }))}
            required
          />

          <button type="submit" disabled={loading}>
            Criar cliente
          </button>
        </form>
      </article>

      <article className="card">
        <h2>2) Criar pedido (forcar falha)</h2>
        <form className="form" onSubmit={handleCreateOrder}>
          <label htmlFor="customerId">Customer ID</label>
          <input
            id="customerId"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            required
          />

          <label htmlFor="reference">Referencia</label>
          <input
            id="reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="PED-0001"
            required
          />

          <label htmlFor="sku">SKU (use ERR-001 para falha)</label>
          <input id="sku" value={sku} onChange={(event) => setSku(event.target.value)} required />

          <label htmlFor="quantity">Quantidade</label>
          <input
            id="quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            required
          />

          <label htmlFor="unitPrice">Preco unitario</label>
          <input
            id="unitPrice"
            type="number"
            min={0}
            step="0.01"
            value={unitPrice}
            onChange={(event) => setUnitPrice(Number(event.target.value))}
            required
          />

          <button type="submit" disabled={loading}>
            Criar pedido
          </button>
        </form>
      </article>

      <article className="card">
        <h2>3) Confirmar pedido para integracao</h2>
        <p className="muted">
          Com o pedido criado, confirme para enfileirar no worker e gerar excecao em caso de falha.
        </p>
        <label htmlFor="orderId">Order ID</label>
        <input
          id="orderId"
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          placeholder="Cole o ID do pedido aqui"
        />
        <button type="button" onClick={() => void handleConfirmOrder()} disabled={loading || !orderId}>
          Confirmar pedido
        </button>
      </article>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
