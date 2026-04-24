import { Pool } from "pg";

const pool = new Pool({
  host: "db",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB
});

const ERP_BASE_URL = `http://erp-mock:${process.env.ERP_MOCK_PORT ?? "3001"}`;
const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 3);
const RETRY_INTERVAL_SECONDS = Number(process.env.RETRY_INTERVAL_SECONDS ?? 20);
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);

async function processOneEvent(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const eventResult = await client.query(
      `SELECT * FROM outbox_events
       WHERE status = 'pending' AND available_at <= NOW()
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1`
    );
    const event = eventResult.rows[0];
    if (!event) {
      await client.query("COMMIT");
      return;
    }

    await client.query("UPDATE outbox_events SET status = 'processing' WHERE id = $1", [event.id]);
    const orderId: string = event.aggregate_id;

    const orderData = await client.query(
      `SELECT o.id, o.reference, c.name, c.document, c.email,
              json_agg(json_build_object('sku', i.sku, 'quantity', i.quantity, 'unitPrice', i.unit_price)) AS items
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN order_items i ON i.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id, c.name, c.document, c.email`,
      [orderId]
    );

    if (orderData.rowCount === 0) {
      await client.query("UPDATE outbox_events SET status = 'failed' WHERE id = $1", [event.id]);
      await client.query("COMMIT");
      return;
    }

    const payload = orderData.rows[0];
    const attempt = await client.query(
      `INSERT INTO integration_attempts (order_id, status, payload_snapshot, correlation_id)
       VALUES ($1, 'pending', $2::jsonb, $3)
       RETURNING id`,
      [orderId, JSON.stringify(payload), event.correlation_id]
    );

    const response = await fetch(`${ERP_BASE_URL}/integrations/orders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": event.correlation_id
      },
      body: JSON.stringify(payload)
    });
    const responseBody = await response.json();

    if (response.ok) {
      await client.query(
        `UPDATE integration_attempts
         SET status = 'success', http_status = $2, response_snapshot = $3::jsonb
         WHERE id = $1`,
        [attempt.rows[0].id, response.status, JSON.stringify(responseBody)]
      );
      await client.query("UPDATE orders SET status = 'integrado', updated_at = NOW() WHERE id = $1", [orderId]);
      await client.query("UPDATE outbox_events SET status = 'done', processed_at = NOW() WHERE id = $1", [event.id]);
      await client.query("COMMIT");
      return;
    }

    const isTemporary = response.status === 503;
    await client.query(
      `UPDATE integration_attempts
       SET status = $2, http_status = $3, error_code = $4, error_message = $5, response_snapshot = $6::jsonb
       WHERE id = $1`,
      [
        attempt.rows[0].id,
        isTemporary ? "timeout" : "failed",
        response.status,
        responseBody.code ?? "UNKNOWN",
        responseBody.message ?? "Erro ao integrar",
        JSON.stringify(responseBody)
      ]
    );
    await client.query("UPDATE orders SET status = 'com_excecao', updated_at = NOW() WHERE id = $1", [orderId]);

    if (isTemporary && event.retries < MAX_RETRIES) {
      await client.query(
        `UPDATE outbox_events
         SET status = 'pending', retries = retries + 1, available_at = NOW() + make_interval(secs => $2)
         WHERE id = $1`,
        [event.id, RETRY_INTERVAL_SECONDS]
      );
    } else {
      const errorCode = isTemporary ? "TIMEOUT_SIMULADO" : (responseBody.code ?? "UNKNOWN");
      await client.query(
        `INSERT INTO exceptions (order_id, attempt_id, status, error_code, error_message)
         VALUES ($1, $2, 'aberta', $3, $4)`,
        [orderId, attempt.rows[0].id, errorCode, responseBody.message ?? "Falha de integracao"]
      );
      await client.query("UPDATE outbox_events SET status = 'failed', processed_at = NOW() WHERE id = $1", [event.id]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Falha no processamento do worker", error);
  } finally {
    client.release();
  }
}

setInterval(() => {
  void processOneEvent();
}, POLL_INTERVAL_MS);

console.log("Worker iniciado.");
